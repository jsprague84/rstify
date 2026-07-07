pub mod cleanup;
pub mod email;
pub mod outgoing_webhooks;
pub mod scheduled;
pub mod ssrf;
pub mod webhooks;

use scheduled::BroadcastFn;
use sqlx::SqlitePool;
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::task::JoinHandle;
use tokio_util::sync::CancellationToken;

#[derive(Clone)]
pub struct JobRunner {
    pool: SqlitePool,
    cancel: CancellationToken,
    broadcast: Option<BroadcastFn>,
    upload_dir: Option<String>,
    /// Handles of the spawned job loops, so shutdown can wait for them to finish
    /// instead of dropping them and killing in-flight work.
    handles: Arc<Mutex<Vec<JoinHandle<()>>>>,
}

impl JobRunner {
    pub fn new(pool: SqlitePool) -> Self {
        Self {
            pool,
            cancel: CancellationToken::new(),
            broadcast: None,
            upload_dir: None,
            handles: Arc::new(Mutex::new(Vec::new())),
        }
    }

    /// The runner's cancellation token, so ad-hoc loops spawned elsewhere can
    /// share it and stop when the runner shuts down.
    pub fn cancel_token(&self) -> CancellationToken {
        self.cancel.clone()
    }

    /// Set the broadcast callback for scheduled message delivery.
    pub fn with_broadcast(mut self, broadcast: BroadcastFn) -> Self {
        self.broadcast = Some(broadcast);
        self
    }

    /// Set the upload directory so the attachment cleanup job can sweep orphaned
    /// files left behind when messages (and their attachment rows) are deleted.
    pub fn with_upload_dir(mut self, upload_dir: String) -> Self {
        self.upload_dir = Some(upload_dir);
        self
    }

    pub async fn start(&self) {
        let mut handles = self.handles.lock().await;

        let pool = self.pool.clone();
        let cancel = self.cancel.clone();
        let broadcast = self.broadcast.clone();
        handles.push(tokio::spawn(async move {
            scheduled::run_scheduled_delivery(pool, cancel, broadcast).await;
        }));

        let pool = self.pool.clone();
        let cancel = self.cancel.clone();
        let upload_dir = self.upload_dir.clone();
        handles.push(tokio::spawn(async move {
            cleanup::run_attachment_cleanup(pool, upload_dir, cancel).await;
        }));

        let pool = self.pool.clone();
        let cancel = self.cancel.clone();
        handles.push(tokio::spawn(async move {
            cleanup::run_message_cleanup(pool, cancel).await;
        }));

        let pool = self.pool.clone();
        let cancel = self.cancel.clone();
        handles.push(tokio::spawn(async move {
            cleanup::run_retention_cleanup(pool, cancel).await;
        }));

        let pool = self.pool.clone();
        let cancel = self.cancel.clone();
        handles.push(tokio::spawn(async move {
            cleanup::run_delivery_log_cleanup(pool, cancel).await;
        }));
    }

    /// Cancel all job loops and wait for them to finish (bounded by a timeout so a
    /// stuck job can't block process exit). Each loop already selects on the
    /// cancel token, so cancellation interrupts its sleep and it exits promptly.
    pub async fn shutdown(&self) {
        self.cancel.cancel();
        let drained: Vec<JoinHandle<()>> = {
            let mut handles = self.handles.lock().await;
            handles.drain(..).collect()
        };
        let result = tokio::time::timeout(std::time::Duration::from_secs(10), async {
            for handle in drained {
                let _ = handle.await;
            }
        })
        .await;
        if result.is_err() {
            tracing::warn!("Background jobs did not stop within 10s; exiting anyway");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn shutdown_cancels_and_joins_promptly() {
        // In-memory pool; every job loop selects on the cancel token before doing
        // any query, so no schema is needed.
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        let runner = JobRunner::new(pool);
        runner.start().await;

        // Shutting down immediately must cancel all loops and join well under the
        // internal 10s timeout — proving it doesn't hang waiting on a sleeping job.
        let started = std::time::Instant::now();
        runner.shutdown().await;
        assert!(
            started.elapsed() < std::time::Duration::from_secs(3),
            "shutdown took too long: {:?}",
            started.elapsed()
        );
    }
}
