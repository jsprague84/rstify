use std::env;
use tracing::warn;

pub struct Config {
    pub listen_addr: String,
    pub database_url: String,
    pub jwt_secret: String,
    pub upload_dir: String,
}

impl Config {
    pub fn from_env() -> Self {
        let jwt_secret = env::var("JWT_SECRET").unwrap_or_else(|_| {
            warn!("JWT_SECRET not set — using insecure default. Set JWT_SECRET in production!");
            "change-me-in-production".to_string()
        });

        Self {
            listen_addr: env::var("LISTEN_ADDR").unwrap_or_else(|_| "0.0.0.0:8080".to_string()),
            database_url: env::var("DATABASE_URL")
                .unwrap_or_else(|_| "sqlite://rstify.db".to_string()),
            jwt_secret,
            upload_dir: env::var("UPLOAD_DIR").unwrap_or_else(|_| "./uploads".to_string()),
        }
    }
}
