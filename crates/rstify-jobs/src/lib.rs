pub mod cleanup;
pub mod email;
pub mod outgoing_webhooks;
pub mod scheduled;
pub mod ssrf;
pub mod webhooks;

use scheduled::BroadcastFn;
use sqlx::SqlitePool;
use tokio_util::sync::CancellationToken;

#[derive(Clone)]
pub struct JobRunner {
    pool: SqlitePool,
    cancel: CancellationToken,
    broadcast: Option<BroadcastFn>,
    upload_dir: Option<String>,
}

impl JobRunner {
    pub fn new(pool: SqlitePool) -> Self {
        Self {
            pool,
            cancel: CancellationToken::new(),
            broadcast: None,
            upload_dir: None,
        }
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
        let pool = self.pool.clone();
        let cancel = self.cancel.clone();
        let broadcast = self.broadcast.clone();
        tokio::spawn(async move {
            scheduled::run_scheduled_delivery(pool, cancel, broadcast).await;
        });

        let pool = self.pool.clone();
        let cancel = self.cancel.clone();
        let upload_dir = self.upload_dir.clone();
        tokio::spawn(async move {
            cleanup::run_attachment_cleanup(pool, upload_dir, cancel).await;
        });

        let pool = self.pool.clone();
        let cancel = self.cancel.clone();
        tokio::spawn(async move {
            cleanup::run_message_cleanup(pool, cancel).await;
        });

        let pool = self.pool.clone();
        let cancel = self.cancel.clone();
        tokio::spawn(async move {
            cleanup::run_retention_cleanup(pool, cancel).await;
        });

        let pool = self.pool.clone();
        let cancel = self.cancel.clone();
        tokio::spawn(async move {
            cleanup::run_delivery_log_cleanup(pool, cancel).await;
        });
    }

    pub fn shutdown(&self) {
        self.cancel.cancel();
    }
}
