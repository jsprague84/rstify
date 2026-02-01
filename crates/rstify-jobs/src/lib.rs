pub mod cleanup;
pub mod email;
pub mod outgoing_webhooks;
pub mod scheduled;
pub mod webhooks;

use scheduled::BroadcastFn;
use sqlx::SqlitePool;
use tokio_util::sync::CancellationToken;

#[derive(Clone)]
pub struct JobRunner {
    pool: SqlitePool,
    cancel: CancellationToken,
    broadcast: Option<BroadcastFn>,
}

impl JobRunner {
    pub fn new(pool: SqlitePool) -> Self {
        Self {
            pool,
            cancel: CancellationToken::new(),
            broadcast: None,
        }
    }

    /// Set the broadcast callback for scheduled message delivery.
    pub fn with_broadcast(mut self, broadcast: BroadcastFn) -> Self {
        self.broadcast = Some(broadcast);
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
        tokio::spawn(async move {
            cleanup::run_attachment_cleanup(pool, cancel).await;
        });

        let pool = self.pool.clone();
        let cancel = self.cancel.clone();
        tokio::spawn(async move {
            cleanup::run_message_cleanup(pool, cancel).await;
        });
    }

    pub fn shutdown(&self) {
        self.cancel.cancel();
    }
}
