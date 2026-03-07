use rstify_db::repositories::{
    SqliteApplicationRepo, SqliteClientRepo, SqliteMessageRepo, SqliteTopicRepo, SqliteUserRepo,
};
use sqlx::SqlitePool;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

use crate::fcm::FcmClient;
use crate::websocket::manager::ConnectionManager;

#[derive(Default)]
pub struct Metrics {
    pub http_requests_total: AtomicU64,
    pub messages_created_total: AtomicU64,
}

impl Metrics {
    pub fn inc_requests(&self) {
        self.http_requests_total.fetch_add(1, Ordering::Relaxed);
    }
    pub fn inc_messages(&self) {
        self.messages_created_total.fetch_add(1, Ordering::Relaxed);
    }
}

#[derive(Clone)]
pub struct AppState {
    pub user_repo: SqliteUserRepo,
    pub app_repo: SqliteApplicationRepo,
    pub client_repo: SqliteClientRepo,
    pub topic_repo: SqliteTopicRepo,
    pub message_repo: SqliteMessageRepo,
    pub jwt_secret: String,
    pub upload_dir: String,
    pub connections: Arc<ConnectionManager>,
    pub pool: SqlitePool,
    pub fcm: Option<Arc<FcmClient>>,
    pub metrics: Arc<Metrics>,
}

impl AppState {
    pub fn new(pool: SqlitePool, jwt_secret: String, upload_dir: String) -> Self {
        Self {
            user_repo: SqliteUserRepo::new(pool.clone()),
            app_repo: SqliteApplicationRepo::new(pool.clone()),
            client_repo: SqliteClientRepo::new(pool.clone()),
            topic_repo: SqliteTopicRepo::new(pool.clone()),
            message_repo: SqliteMessageRepo::new(pool.clone()),
            jwt_secret,
            upload_dir,
            connections: Arc::new(ConnectionManager::new()),
            pool,
            fcm: None,
            metrics: Arc::new(Metrics::default()),
        }
    }

    pub fn with_fcm(mut self, fcm: FcmClient) -> Self {
        self.fcm = Some(Arc::new(fcm));
        self
    }
}
