pub mod cleanup;
pub mod scheduled;
pub mod webhooks;

use sqlx::SqlitePool;
use tokio_util::sync::CancellationToken;

#[derive(Clone)]
pub struct JobRunner {
    pool: SqlitePool,
    cancel: CancellationToken,
}

impl JobRunner {
    pub fn new(pool: SqlitePool) -> Self {
        Self {
            pool,
            cancel: CancellationToken::new(),
        }
    }

    pub async fn start(&self) {
        let pool = self.pool.clone();
        let cancel = self.cancel.clone();
        tokio::spawn(async move {
            scheduled::run_scheduled_delivery(pool, cancel).await;
        });

        let pool = self.pool.clone();
        let cancel = self.cancel.clone();
        tokio::spawn(async move {
            cleanup::run_attachment_cleanup(pool, cancel).await;
        });
    }

    pub fn shutdown(&self) {
        self.cancel.cancel();
    }
}
