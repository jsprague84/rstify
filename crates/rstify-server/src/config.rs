use std::env;
use tracing::warn;

pub struct Config {
    pub listen_addr: String,
    pub database_url: String,
    pub jwt_secret: String,
    pub upload_dir: String,
    pub cors_origins: Vec<String>,
    pub rate_limit_max: u32,
    pub rate_limit_rps: f64,
    pub max_message_size: usize,
    pub jwt_expiry_hours: u64,
    pub request_timeout_secs: u64,
}

impl Config {
    pub fn from_env() -> Self {
        let jwt_secret = env::var("JWT_SECRET").unwrap_or_else(|_| {
            warn!("JWT_SECRET not set — using insecure default. Set JWT_SECRET in production!");
            "change-me-in-production".to_string()
        });

        if jwt_secret.len() < 32 {
            warn!(
                "JWT_SECRET is only {} bytes — recommend at least 32 bytes for production security",
                jwt_secret.len()
            );
        }

        let cors_origins: Vec<String> = env::var("CORS_ORIGINS")
            .map(|s| s.split(',').map(|o| o.trim().to_string()).collect())
            .unwrap_or_default();

        Self {
            listen_addr: env::var("LISTEN_ADDR").unwrap_or_else(|_| "0.0.0.0:8080".to_string()),
            database_url: env::var("DATABASE_URL")
                .unwrap_or_else(|_| "sqlite://rstify.db".to_string()),
            jwt_secret,
            upload_dir: env::var("UPLOAD_DIR").unwrap_or_else(|_| "./uploads".to_string()),
            cors_origins,
            rate_limit_max: env::var("RATE_LIMIT_BURST")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(60),
            rate_limit_rps: env::var("RATE_LIMIT_RPS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(10.0),
            max_message_size: env::var("MAX_MESSAGE_SIZE")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(65536),
            jwt_expiry_hours: env::var("JWT_EXPIRY_HOURS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(24),
            request_timeout_secs: env::var("REQUEST_TIMEOUT_SECS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(30),
        }
    }
}
