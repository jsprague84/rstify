use rstify_db::repositories::{
    SqliteApplicationRepo, SqliteClientRepo, SqliteMessageRepo, SqliteTopicRepo, SqliteUserRepo,
    SqliteWebhookVariableRepo,
};
use sqlx::SqlitePool;
use std::sync::atomic::{AtomicI32, AtomicU64, Ordering};
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
    pub webhook_variable_repo: SqliteWebhookVariableRepo,
    pub jwt_secret: String,
    pub upload_dir: String,
    pub max_upload_size: usize,
    pub connections: Arc<ConnectionManager>,
    pub pool: SqlitePool,
    pub fcm: Option<Arc<FcmClient>>,
    pub metrics: Arc<Metrics>,
    pub inbox_threshold: Arc<AtomicI32>,
    pub email_config: Option<rstify_jobs::email::EmailConfig>,
}

impl AppState {
    pub fn new(
        pool: SqlitePool,
        jwt_secret: String,
        upload_dir: String,
        max_upload_size: usize,
    ) -> Self {
        Self {
            user_repo: SqliteUserRepo::new(pool.clone()),
            app_repo: SqliteApplicationRepo::new(pool.clone()),
            client_repo: SqliteClientRepo::new(pool.clone()),
            topic_repo: SqliteTopicRepo::new(pool.clone()),
            message_repo: SqliteMessageRepo::new(pool.clone()),
            webhook_variable_repo: SqliteWebhookVariableRepo::new(pool.clone()),
            jwt_secret,
            upload_dir,
            max_upload_size,
            connections: Arc::new(ConnectionManager::new()),
            pool,
            fcm: None,
            metrics: Arc::new(Metrics::default()),
            inbox_threshold: Arc::new(AtomicI32::new(5)),
            email_config: None,
        }
    }

    pub fn with_fcm(mut self, fcm: FcmClient) -> Self {
        self.fcm = Some(Arc::new(fcm));
        self
    }

    pub fn with_email_config(mut self, config: rstify_jobs::email::EmailConfig) -> Self {
        self.email_config = Some(config);
        self
    }
}
