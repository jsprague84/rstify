use std::env;
use std::fmt;

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

#[derive(Debug)]
pub struct ConfigError {
    pub field: String,
    pub message: String,
}

impl fmt::Display for ConfigError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "config error for `{}`: {}", self.field, self.message)
    }
}

impl std::error::Error for ConfigError {}

// ---------------------------------------------------------------------------
// Sub-config structs
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct ServerConfig {
    pub listen_addr: String,
    pub upload_dir: String,
    pub max_attachment_size: usize,
}

#[derive(Debug, Clone)]
pub struct DatabaseConfig {
    pub url: String,
}

#[derive(Debug, Clone)]
pub struct AuthConfig {
    pub jwt_secret: String,
}

#[derive(Debug, Clone)]
pub struct MqttConfig {
    pub listen_addr: String,
    pub ws_listen_addr: Option<String>,
    pub require_auth: bool,
    pub max_payload_size: usize,
    pub max_connections: usize,
}

#[derive(Debug, Clone)]
pub struct FcmConfig {
    pub project_id: String,
    pub service_account_path: String,
}

#[derive(Debug, Clone)]
pub struct SmtpConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub from: String,
}

#[derive(Debug, Clone)]
pub struct RateLimitConfig {
    pub burst: u32,
    pub rps: f64,
}

#[derive(Debug, Clone)]
pub struct CorsConfig {
    pub origins: Vec<String>,
}

// ---------------------------------------------------------------------------
// Top-level Config
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct Config {
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub auth: AuthConfig,
    pub mqtt: Option<MqttConfig>,
    pub fcm: Option<FcmConfig>,
    pub smtp: Option<SmtpConfig>,
    pub rate_limit: RateLimitConfig,
    pub cors: CorsConfig,
}

impl Config {
    /// Build a Config from environment variables.
    pub fn from_env() -> Result<Config, ConfigError> {
        Self::from_map(|key| env::var(key).ok())
    }

    /// Build a Config from an arbitrary lookup function (for testability).
    pub fn from_map<F>(lookup: F) -> Result<Config, ConfigError>
    where
        F: Fn(&str) -> Option<String>,
    {
        // --- Auth (required) ---
        let jwt_secret = lookup("JWT_SECRET").ok_or_else(|| ConfigError {
            field: "JWT_SECRET".into(),
            message: "JWT_SECRET is required".into(),
        })?;
        if jwt_secret.len() < 32 {
            return Err(ConfigError {
                field: "JWT_SECRET".into(),
                message: format!(
                    "JWT_SECRET must be at least 32 bytes, got {}",
                    jwt_secret.len()
                ),
            });
        }

        // --- Server ---
        let listen_addr = lookup("LISTEN_ADDR").unwrap_or_else(|| "0.0.0.0:8080".into());
        let upload_dir = lookup("UPLOAD_DIR").unwrap_or_else(|| "./uploads".into());
        let max_attachment_size =
            parse_optional::<usize>(&lookup, "RSTIFY_MAX_ATTACHMENT_SIZE", 25 * 1024 * 1024)?;

        // --- Database ---
        let database_url = lookup("DATABASE_URL").unwrap_or_else(|| "sqlite://rstify.db".into());

        // --- Rate limit ---
        let burst = parse_optional::<u32>(&lookup, "RATE_LIMIT_BURST", 60)?;
        let rps = parse_optional::<f64>(&lookup, "RATE_LIMIT_RPS", 10.0)?;

        // --- CORS ---
        let origins: Vec<String> = lookup("CORS_ORIGINS")
            .map(|s| {
                s.split(',')
                    .map(|o| o.trim().to_string())
                    .filter(|o| !o.is_empty())
                    .collect()
            })
            .unwrap_or_default();

        // --- MQTT (optional, enabled when MQTT_ENABLED=true/1) ---
        let mqtt = {
            let enabled = lookup("MQTT_ENABLED")
                .map(|v| v == "true" || v == "1")
                .unwrap_or(false);
            if enabled {
                let mqtt_listen_addr =
                    lookup("MQTT_LISTEN_ADDR").unwrap_or_else(|| "0.0.0.0:1883".into());
                let ws_listen_addr = lookup("MQTT_WS_LISTEN_ADDR");
                let require_auth = lookup("MQTT_REQUIRE_AUTH")
                    .map(|v| v != "false" && v != "0")
                    .unwrap_or(true);
                let max_payload_size = parse_optional::<usize>(&lookup, "MQTT_MAX_PAYLOAD", 20480)?;
                let max_connections =
                    parse_optional::<usize>(&lookup, "MQTT_MAX_CONNECTIONS", 1000)?;

                Some(MqttConfig {
                    listen_addr: mqtt_listen_addr,
                    ws_listen_addr,
                    require_auth,
                    max_payload_size,
                    max_connections,
                })
            } else {
                None
            }
        };

        // --- FCM (optional, present when both FCM_PROJECT_ID and FCM_SERVICE_ACCOUNT_PATH set) ---
        let fcm = match (lookup("FCM_PROJECT_ID"), lookup("FCM_SERVICE_ACCOUNT_PATH")) {
            (Some(project_id), Some(service_account_path)) => Some(FcmConfig {
                project_id,
                service_account_path,
            }),
            _ => None,
        };

        // --- SMTP (optional, present when SMTP_HOST is set) ---
        let smtp = if let Some(host) = lookup("SMTP_HOST") {
            let port = parse_optional::<u16>(&lookup, "SMTP_PORT", 587)?;
            let username = lookup("SMTP_USER").unwrap_or_default();
            let password = lookup("SMTP_PASS").unwrap_or_default();
            let from = lookup("SMTP_FROM").unwrap_or_else(|| format!("rstify@{}", host));
            Some(SmtpConfig {
                host,
                port,
                username,
                password,
                from,
            })
        } else {
            None
        };

        Ok(Config {
            server: ServerConfig {
                listen_addr,
                upload_dir,
                max_attachment_size,
            },
            database: DatabaseConfig { url: database_url },
            auth: AuthConfig { jwt_secret },
            mqtt,
            fcm,
            smtp,
            rate_limit: RateLimitConfig { burst, rps },
            cors: CorsConfig { origins },
        })
    }
}

/// Parse an optional numeric env var, returning a ConfigError on invalid values
/// instead of silently falling back to a default.
fn parse_optional<T>(
    lookup: &dyn Fn(&str) -> Option<String>,
    key: &str,
    default: T,
) -> Result<T, ConfigError>
where
    T: std::str::FromStr,
    T::Err: fmt::Display,
{
    match lookup(key) {
        None => Ok(default),
        Some(val) => val.parse::<T>().map_err(|e| ConfigError {
            field: key.into(),
            message: format!("invalid value '{}': {}", val, e),
        }),
    }
}

// ===========================================================================
// Tests
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    /// Helper: build a lookup function from a HashMap.
    fn make_lookup(map: HashMap<&str, &str>) -> impl Fn(&str) -> Option<String> {
        let owned: HashMap<String, String> = map
            .into_iter()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect();
        move |key: &str| owned.get(key).cloned()
    }

    fn minimal_valid_map() -> HashMap<&'static str, &'static str> {
        let mut m = HashMap::new();
        m.insert("JWT_SECRET", "this-is-a-secret-that-is-at-least-32-bytes!");
        m
    }

    // --- Minimal valid config (only JWT_SECRET, everything else defaults) ---
    #[test]
    fn test_minimal_valid_config() {
        let config = Config::from_map(make_lookup(minimal_valid_map())).unwrap();

        assert_eq!(config.server.listen_addr, "0.0.0.0:8080");
        assert_eq!(config.server.upload_dir, "./uploads");
        assert_eq!(config.server.max_attachment_size, 25 * 1024 * 1024);
        assert_eq!(config.database.url, "sqlite://rstify.db");
        assert_eq!(
            config.auth.jwt_secret,
            "this-is-a-secret-that-is-at-least-32-bytes!"
        );
        assert!(config.mqtt.is_none());
        assert!(config.fcm.is_none());
        assert!(config.smtp.is_none());
        assert_eq!(config.rate_limit.burst, 60);
        assert_eq!(config.rate_limit.rps, 10.0);
        assert!(config.cors.origins.is_empty());
    }

    // --- Missing JWT_SECRET fails ---
    #[test]
    fn test_missing_jwt_secret_fails() {
        let err = Config::from_map(make_lookup(HashMap::new())).unwrap_err();
        assert_eq!(err.field, "JWT_SECRET");
        assert!(err.message.contains("required"));
    }

    // --- JWT_SECRET too short fails ---
    #[test]
    fn test_jwt_secret_too_short_fails() {
        let mut m = HashMap::new();
        m.insert("JWT_SECRET", "too-short");
        let err = Config::from_map(make_lookup(m)).unwrap_err();
        assert_eq!(err.field, "JWT_SECRET");
        assert!(err.message.contains("at least 32 bytes"));
    }

    // --- Invalid RATE_LIMIT_BURST fails ---
    #[test]
    fn test_invalid_rate_limit_burst_fails() {
        let mut m = minimal_valid_map();
        m.insert("RATE_LIMIT_BURST", "not-a-number");
        let err = Config::from_map(make_lookup(m)).unwrap_err();
        assert_eq!(err.field, "RATE_LIMIT_BURST");
        assert!(err.message.contains("invalid value"));
    }

    // --- MQTT config present when enabled ---
    #[test]
    fn test_mqtt_config_present_when_enabled() {
        let mut m = minimal_valid_map();
        m.insert("MQTT_ENABLED", "true");
        let config = Config::from_map(make_lookup(m)).unwrap();
        let mqtt = config.mqtt.unwrap();
        assert_eq!(mqtt.listen_addr, "0.0.0.0:1883");
        assert!(mqtt.ws_listen_addr.is_none());
        assert!(mqtt.require_auth);
        assert_eq!(mqtt.max_payload_size, 20480);
        assert_eq!(mqtt.max_connections, 1000);
    }

    // --- MQTT config absent when disabled (default) ---
    #[test]
    fn test_mqtt_config_absent_when_disabled() {
        let config = Config::from_map(make_lookup(minimal_valid_map())).unwrap();
        assert!(config.mqtt.is_none());
    }

    // --- MQTT enabled with "1" ---
    #[test]
    fn test_mqtt_enabled_with_1() {
        let mut m = minimal_valid_map();
        m.insert("MQTT_ENABLED", "1");
        let config = Config::from_map(make_lookup(m)).unwrap();
        assert!(config.mqtt.is_some());
    }

    // --- CORS origins parsing with whitespace trimming ---
    #[test]
    fn test_cors_origins_whitespace_trimming() {
        let mut m = minimal_valid_map();
        m.insert(
            "CORS_ORIGINS",
            " http://a.com , http://b.com , http://c.com ",
        );
        let config = Config::from_map(make_lookup(m)).unwrap();
        assert_eq!(
            config.cors.origins,
            vec!["http://a.com", "http://b.com", "http://c.com"]
        );
    }

    // --- FCM requires both vars ---
    #[test]
    fn test_fcm_requires_both_vars() {
        // Only project_id
        let mut m = minimal_valid_map();
        m.insert("FCM_PROJECT_ID", "my-project");
        let config = Config::from_map(make_lookup(m)).unwrap();
        assert!(config.fcm.is_none());

        // Only service_account_path
        let mut m = minimal_valid_map();
        m.insert("FCM_SERVICE_ACCOUNT_PATH", "/path/to/sa.json");
        let config = Config::from_map(make_lookup(m)).unwrap();
        assert!(config.fcm.is_none());

        // Both set
        let mut m = minimal_valid_map();
        m.insert("FCM_PROJECT_ID", "my-project");
        m.insert("FCM_SERVICE_ACCOUNT_PATH", "/path/to/sa.json");
        let config = Config::from_map(make_lookup(m)).unwrap();
        let fcm = config.fcm.unwrap();
        assert_eq!(fcm.project_id, "my-project");
        assert_eq!(fcm.service_account_path, "/path/to/sa.json");
    }

    // --- SMTP config when host set ---
    #[test]
    fn test_smtp_config_when_host_set() {
        let mut m = minimal_valid_map();
        m.insert("SMTP_HOST", "mail.example.com");
        let config = Config::from_map(make_lookup(m)).unwrap();
        let smtp = config.smtp.unwrap();
        assert_eq!(smtp.host, "mail.example.com");
        assert_eq!(smtp.port, 587);
        assert_eq!(smtp.username, "");
        assert_eq!(smtp.password, "");
        assert_eq!(smtp.from, "rstify@mail.example.com");
    }

    // --- SMTP absent when host not set ---
    #[test]
    fn test_smtp_absent_when_host_not_set() {
        let config = Config::from_map(make_lookup(minimal_valid_map())).unwrap();
        assert!(config.smtp.is_none());
    }

    // --- Max attachment size default ---
    #[test]
    fn test_max_attachment_size_default() {
        let config = Config::from_map(make_lookup(minimal_valid_map())).unwrap();
        assert_eq!(config.server.max_attachment_size, 25 * 1024 * 1024);
    }

    // --- Custom values override defaults ---
    #[test]
    fn test_custom_values_override_defaults() {
        let mut m = minimal_valid_map();
        m.insert("LISTEN_ADDR", "127.0.0.1:9090");
        m.insert("UPLOAD_DIR", "/var/uploads");
        m.insert("DATABASE_URL", "sqlite:///data/app.db");
        m.insert("RATE_LIMIT_BURST", "100");
        m.insert("RATE_LIMIT_RPS", "20.5");
        m.insert("RSTIFY_MAX_ATTACHMENT_SIZE", "10485760");
        m.insert("SMTP_HOST", "smtp.test.com");
        m.insert("SMTP_PORT", "465");
        m.insert("SMTP_USER", "user@test.com");
        m.insert("SMTP_PASS", "secret");
        m.insert("SMTP_FROM", "noreply@test.com");

        let config = Config::from_map(make_lookup(m)).unwrap();
        assert_eq!(config.server.listen_addr, "127.0.0.1:9090");
        assert_eq!(config.server.upload_dir, "/var/uploads");
        assert_eq!(config.server.max_attachment_size, 10485760);
        assert_eq!(config.database.url, "sqlite:///data/app.db");
        assert_eq!(config.rate_limit.burst, 100);
        assert_eq!(config.rate_limit.rps, 20.5);

        let smtp = config.smtp.unwrap();
        assert_eq!(smtp.port, 465);
        assert_eq!(smtp.username, "user@test.com");
        assert_eq!(smtp.password, "secret");
        assert_eq!(smtp.from, "noreply@test.com");
    }

    // --- Invalid SMTP_PORT fails ---
    #[test]
    fn test_invalid_smtp_port_fails() {
        let mut m = minimal_valid_map();
        m.insert("SMTP_HOST", "mail.example.com");
        m.insert("SMTP_PORT", "not-a-port");
        let err = Config::from_map(make_lookup(m)).unwrap_err();
        assert_eq!(err.field, "SMTP_PORT");
    }

    // --- Invalid MQTT_MAX_PAYLOAD fails ---
    #[test]
    fn test_invalid_mqtt_max_payload_fails() {
        let mut m = minimal_valid_map();
        m.insert("MQTT_ENABLED", "true");
        m.insert("MQTT_MAX_PAYLOAD", "abc");
        let err = Config::from_map(make_lookup(m)).unwrap_err();
        assert_eq!(err.field, "MQTT_MAX_PAYLOAD");
    }

    // --- Invalid RSTIFY_MAX_ATTACHMENT_SIZE fails ---
    #[test]
    fn test_invalid_max_attachment_size_fails() {
        let mut m = minimal_valid_map();
        m.insert("RSTIFY_MAX_ATTACHMENT_SIZE", "big");
        let err = Config::from_map(make_lookup(m)).unwrap_err();
        assert_eq!(err.field, "RSTIFY_MAX_ATTACHMENT_SIZE");
    }

    // --- ConfigError Display ---
    #[test]
    fn test_config_error_display() {
        let err = ConfigError {
            field: "FOO".into(),
            message: "is broken".into(),
        };
        assert_eq!(format!("{}", err), "config error for `FOO`: is broken");
    }

    // --- MQTT custom values ---
    #[test]
    fn test_mqtt_custom_values() {
        let mut m = minimal_valid_map();
        m.insert("MQTT_ENABLED", "true");
        m.insert("MQTT_LISTEN_ADDR", "127.0.0.1:1884");
        m.insert("MQTT_WS_LISTEN_ADDR", "127.0.0.1:8083");
        m.insert("MQTT_REQUIRE_AUTH", "false");
        m.insert("MQTT_MAX_PAYLOAD", "65536");
        m.insert("MQTT_MAX_CONNECTIONS", "500");
        let config = Config::from_map(make_lookup(m)).unwrap();
        let mqtt = config.mqtt.unwrap();
        assert_eq!(mqtt.listen_addr, "127.0.0.1:1884");
        assert_eq!(mqtt.ws_listen_addr.as_deref(), Some("127.0.0.1:8083"));
        assert!(!mqtt.require_auth);
        assert_eq!(mqtt.max_payload_size, 65536);
        assert_eq!(mqtt.max_connections, 500);
    }

    // --- Invalid RATE_LIMIT_RPS fails ---
    #[test]
    fn test_invalid_rate_limit_rps_fails() {
        let mut m = minimal_valid_map();
        m.insert("RATE_LIMIT_RPS", "fast");
        let err = Config::from_map(make_lookup(m)).unwrap_err();
        assert_eq!(err.field, "RATE_LIMIT_RPS");
    }
}
