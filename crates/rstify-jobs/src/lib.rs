pub mod cleanup;
pub mod scheduled;
pub mod webhooks;

use sqlx::SqlitePool;
use std::sync::Arc;
use tokio::sync::Notify;

#[derive(Clone)]
pub struct JobRunner {
    pool: SqlitePool,
    shutdown: Arc<Notify>,
}

impl JobRunner {
    pub fn new(pool: SqlitePool) -> Self {
        Self {
            pool,
            shutdown: Arc::new(Notify::new()),
        }
    }

    pub async fn start(&self) {
        let pool = self.pool.clone();
        let shutdown = self.shutdown.clone();

        tokio::spawn(async move {
            scheduled::run_scheduled_delivery(pool.clone(), shutdown.clone()).await;
        });

        let pool = self.pool.clone();
        let shutdown = self.shutdown.clone();
        tokio::spawn(async move {
            cleanup::run_attachment_cleanup(pool, shutdown).await;
        });
    }

    pub fn shutdown(&self) {
        self.shutdown.notify_waiters();
    }
}
