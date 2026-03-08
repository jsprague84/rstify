use rstify_db::repositories::{
    SqliteApplicationRepo, SqliteClientRepo, SqliteMessageRepo, SqliteMqttBridgeRepo,
    SqliteTopicRepo, SqliteUserRepo, SqliteWebhookVariableRepo,
};
use rstify_mqtt::bridge::BridgeManager;
use sqlx::SqlitePool;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::sync::Mutex;

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
    pub mqtt_bridge_repo: SqliteMqttBridgeRepo,
    pub webhook_variable_repo: SqliteWebhookVariableRepo,
    pub jwt_secret: String,
    pub upload_dir: String,
    pub max_upload_size: usize,
    pub connections: Arc<ConnectionManager>,
    pub pool: SqlitePool,
    pub fcm: Option<Arc<FcmClient>>,
    pub metrics: Arc<Metrics>,
    pub bridge_manager: Option<Arc<Mutex<BridgeManager>>>,
}

impl AppState {
    /// Default max upload size: 25 MiB. Override with RSTIFY_MAX_ATTACHMENT_SIZE env var.
    const DEFAULT_MAX_UPLOAD: usize = 25 * 1024 * 1024;

    pub fn new(pool: SqlitePool, jwt_secret: String, upload_dir: String) -> Self {
        let max_upload_size = std::env::var("RSTIFY_MAX_ATTACHMENT_SIZE")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(Self::DEFAULT_MAX_UPLOAD);

        Self {
            user_repo: SqliteUserRepo::new(pool.clone()),
            app_repo: SqliteApplicationRepo::new(pool.clone()),
            client_repo: SqliteClientRepo::new(pool.clone()),
            topic_repo: SqliteTopicRepo::new(pool.clone()),
            message_repo: SqliteMessageRepo::new(pool.clone()),
            mqtt_bridge_repo: SqliteMqttBridgeRepo::new(pool.clone()),
            webhook_variable_repo: SqliteWebhookVariableRepo::new(pool.clone()),
            jwt_secret,
            upload_dir,
            max_upload_size,
            connections: Arc::new(ConnectionManager::new()),
            pool,
            fcm: None,
            metrics: Arc::new(Metrics::default()),
            bridge_manager: None,
        }
    }

    pub fn with_fcm(mut self, fcm: FcmClient) -> Self {
        self.fcm = Some(Arc::new(fcm));
        self
    }

    pub fn with_bridge_manager(mut self, bm: Arc<Mutex<BridgeManager>>) -> Self {
        self.bridge_manager = Some(bm);
        self
    }
}
