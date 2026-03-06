use rstify_db::repositories::{
    SqliteApplicationRepo, SqliteClientRepo, SqliteMessageRepo, SqliteTopicRepo, SqliteUserRepo,
};
use sqlx::SqlitePool;
use std::sync::Arc;

use crate::fcm::FcmClient;
use crate::websocket::manager::ConnectionManager;

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
        }
    }

    pub fn with_fcm(mut self, fcm: FcmClient) -> Self {
        self.fcm = Some(Arc::new(fcm));
        self
    }
}
