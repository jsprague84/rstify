# Phase 1: Backend Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish clean, explicit backend boundaries by centralizing configuration, extracting shared handler/repository patterns, standardizing error and response behavior, and covering all new abstractions with unit tests.

**Architecture:** Replace scattered `std::env::var` calls (13+ across 6 files) with a single typed `Config` struct parsed at boot. Extract the ownership-check pattern (repeated 17+ times) and validation logic into shared helpers in `rstify-api`. Split three oversized route modules (topics 617 LOC, webhooks 717 LOC, messages 563 LOC) by domain concern. Standardize repository error handling and admin checks. All new abstractions ship with unit tests.

**Tech Stack:** Rust, Axum 0.8, sqlx (SQLite), tokio, serde, thiserror

**Spec:** `docs/superpowers/specs/2026-04-07-codebase-refinement-design.md` — Phase 1 (sections 1a–1e)

---

### Task 1: Centralized Config Struct

**Files:**
- Modify: `crates/rstify-server/src/config.rs` (complete rewrite)
- Modify: `crates/rstify-server/src/main.rs` (update bootstrap to use new Config)
- Delete env access from: `crates/rstify-mqtt/src/config.rs`
- Delete env access from: `crates/rstify-api/src/fcm.rs:82-84`
- Delete env access from: `crates/rstify-api/src/state.rs:54-57`
- Delete env access from: `crates/rstify-jobs/src/email.rs:16-33`
- Delete env access from: `crates/rstify-api/src/routes/mqtt.rs:31-45`

- [ ] **Step 1: Write tests for config parsing**

Create `crates/rstify-server/src/config.rs` with a test module. Tests validate parsing, defaults, validation failures, and optional configs.

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    // Helper: build Config from a HashMap instead of real env vars
    fn config_from_map(map: &HashMap<&str, &str>) -> Result<Config, ConfigError> {
        Config::from_map(|key| map.get(key).map(|v| v.to_string()))
    }

    #[test]
    fn test_minimal_valid_config() {
        let mut m = HashMap::new();
        m.insert("JWT_SECRET", "a]verylong-secret-that-is-at-least-32-bytes!");
        let cfg = config_from_map(&m).unwrap();
        assert_eq!(cfg.server.listen_addr, "0.0.0.0:8080");
        assert_eq!(cfg.database.url, "sqlite://rstify.db");
        assert_eq!(cfg.server.upload_dir, "./uploads");
        assert_eq!(cfg.rate_limit.burst, 60);
        assert!((cfg.rate_limit.rps - 10.0).abs() < f64::EPSILON);
        assert!(cfg.mqtt.is_none());
        assert!(cfg.fcm.is_none());
        assert!(cfg.smtp.is_none());
    }

    #[test]
    fn test_jwt_secret_too_short_fails() {
        let mut m = HashMap::new();
        m.insert("JWT_SECRET", "short");
        let err = config_from_map(&m).unwrap_err();
        assert!(err.to_string().contains("JWT_SECRET"));
        assert!(err.to_string().contains("32"));
    }

    #[test]
    fn test_missing_jwt_secret_fails() {
        let m = HashMap::new();
        let err = config_from_map(&m).unwrap_err();
        assert!(err.to_string().contains("JWT_SECRET"));
    }

    #[test]
    fn test_invalid_rate_limit_burst_fails() {
        let mut m = HashMap::new();
        m.insert("JWT_SECRET", "a-verylong-secret-that-is-at-least-32-bytes!");
        m.insert("RATE_LIMIT_BURST", "not-a-number");
        let err = config_from_map(&m).unwrap_err();
        assert!(err.to_string().contains("RATE_LIMIT_BURST"));
    }

    #[test]
    fn test_mqtt_config_when_enabled() {
        let mut m = HashMap::new();
        m.insert("JWT_SECRET", "a-verylong-secret-that-is-at-least-32-bytes!");
        m.insert("MQTT_ENABLED", "true");
        let cfg = config_from_map(&m).unwrap();
        let mqtt = cfg.mqtt.unwrap();
        assert_eq!(mqtt.listen_addr, "0.0.0.0:1883");
        assert!(mqtt.require_auth);
        assert_eq!(mqtt.max_payload_size, 20480);
        assert_eq!(mqtt.max_connections, 1000);
    }

    #[test]
    fn test_mqtt_disabled_by_default() {
        let mut m = HashMap::new();
        m.insert("JWT_SECRET", "a-verylong-secret-that-is-at-least-32-bytes!");
        let cfg = config_from_map(&m).unwrap();
        assert!(cfg.mqtt.is_none());
    }

    #[test]
    fn test_cors_origins_parsing() {
        let mut m = HashMap::new();
        m.insert("JWT_SECRET", "a-verylong-secret-that-is-at-least-32-bytes!");
        m.insert("CORS_ORIGINS", " https://a.com , https://b.com ");
        let cfg = config_from_map(&m).unwrap();
        assert_eq!(cfg.cors.origins, vec!["https://a.com", "https://b.com"]);
    }

    #[test]
    fn test_fcm_config_requires_both_vars() {
        let mut m = HashMap::new();
        m.insert("JWT_SECRET", "a-verylong-secret-that-is-at-least-32-bytes!");
        m.insert("FCM_PROJECT_ID", "my-project");
        // Missing FCM_SERVICE_ACCOUNT_PATH — FCM should be None
        let cfg = config_from_map(&m).unwrap();
        assert!(cfg.fcm.is_none());
    }

    #[test]
    fn test_smtp_config_when_host_set() {
        let mut m = HashMap::new();
        m.insert("JWT_SECRET", "a-verylong-secret-that-is-at-least-32-bytes!");
        m.insert("SMTP_HOST", "smtp.example.com");
        let cfg = config_from_map(&m).unwrap();
        let smtp = cfg.smtp.unwrap();
        assert_eq!(smtp.host, "smtp.example.com");
        assert_eq!(smtp.port, 587);
        assert_eq!(smtp.from, "rstify@smtp.example.com");
    }

    #[test]
    fn test_max_attachment_size_default() {
        let mut m = HashMap::new();
        m.insert("JWT_SECRET", "a-verylong-secret-that-is-at-least-32-bytes!");
        let cfg = config_from_map(&m).unwrap();
        assert_eq!(cfg.server.max_attachment_size, 25 * 1024 * 1024);
    }

    #[test]
    fn test_custom_values_override_defaults() {
        let mut m = HashMap::new();
        m.insert("JWT_SECRET", "a-verylong-secret-that-is-at-least-32-bytes!");
        m.insert("LISTEN_ADDR", "127.0.0.1:9090");
        m.insert("DATABASE_URL", "sqlite://custom.db");
        m.insert("UPLOAD_DIR", "/tmp/uploads");
        m.insert("RSTIFY_MAX_ATTACHMENT_SIZE", "10485760");
        m.insert("RATE_LIMIT_BURST", "30");
        m.insert("RATE_LIMIT_RPS", "5.0");
        let cfg = config_from_map(&m).unwrap();
        assert_eq!(cfg.server.listen_addr, "127.0.0.1:9090");
        assert_eq!(cfg.database.url, "sqlite://custom.db");
        assert_eq!(cfg.server.upload_dir, "/tmp/uploads");
        assert_eq!(cfg.server.max_attachment_size, 10485760);
        assert_eq!(cfg.rate_limit.burst, 30);
        assert!((cfg.rate_limit.rps - 5.0).abs() < f64::EPSILON);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/jsprague/dev/rstify && cargo test -p rstify-server -- config`
Expected: Compilation errors — `Config::from_map`, `ConfigError`, sub-config structs don't exist yet.

- [ ] **Step 3: Implement the Config struct with sub-configs**

Replace the contents of `crates/rstify-server/src/config.rs`:

```rust
use std::fmt;

#[derive(Debug)]
pub struct ConfigError(String);

impl fmt::Display for ConfigError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Configuration error: {}", self.0)
    }
}

impl std::error::Error for ConfigError {}

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
    /// Load config from real environment variables.
    pub fn from_env() -> Result<Self, ConfigError> {
        Self::from_map(|key| std::env::var(key).ok())
    }

    /// Load config from a lookup function (testable without env vars).
    pub fn from_map<F>(get: F) -> Result<Self, ConfigError>
    where
        F: Fn(&str) -> Option<String>,
    {
        // --- Required ---
        let jwt_secret = get("JWT_SECRET").ok_or_else(|| {
            ConfigError("JWT_SECRET is required. Set it to a random string of at least 32 bytes.".into())
        })?;
        if jwt_secret.len() < 32 {
            return Err(ConfigError(format!(
                "JWT_SECRET is only {} bytes — must be at least 32 bytes for security.",
                jwt_secret.len()
            )));
        }

        // --- Server (with defaults) ---
        let listen_addr = get("LISTEN_ADDR").unwrap_or_else(|| "0.0.0.0:8080".into());
        let database_url = get("DATABASE_URL").unwrap_or_else(|| "sqlite://rstify.db".into());
        let upload_dir = get("UPLOAD_DIR").unwrap_or_else(|| "./uploads".into());

        let max_attachment_size = parse_optional(&get, "RSTIFY_MAX_ATTACHMENT_SIZE", 25 * 1024 * 1024)?;

        // --- Rate Limiting ---
        let burst = parse_optional(&get, "RATE_LIMIT_BURST", 60u32)?;
        let rps = parse_optional_f64(&get, "RATE_LIMIT_RPS", 10.0)?;

        // --- CORS ---
        let cors_origins: Vec<String> = get("CORS_ORIGINS")
            .map(|s| s.split(',').map(|o| o.trim().to_string()).filter(|o| !o.is_empty()).collect())
            .unwrap_or_default();

        // --- Optional: MQTT ---
        let mqtt_enabled = get("MQTT_ENABLED")
            .map(|v| v == "true" || v == "1")
            .unwrap_or(false);
        let mqtt = if mqtt_enabled {
            Some(MqttConfig {
                listen_addr: get("MQTT_LISTEN_ADDR").unwrap_or_else(|| "0.0.0.0:1883".into()),
                ws_listen_addr: get("MQTT_WS_LISTEN_ADDR"),
                require_auth: get("MQTT_REQUIRE_AUTH")
                    .map(|v| v != "false" && v != "0")
                    .unwrap_or(true),
                max_payload_size: parse_optional(&get, "MQTT_MAX_PAYLOAD", 20480)?,
                max_connections: parse_optional(&get, "MQTT_MAX_CONNECTIONS", 1000)?,
            })
        } else {
            None
        };

        // --- Optional: FCM (requires both vars) ---
        let fcm = match (get("FCM_PROJECT_ID"), get("FCM_SERVICE_ACCOUNT_PATH")) {
            (Some(project_id), Some(service_account_path)) => {
                Some(FcmConfig { project_id, service_account_path })
            }
            _ => None,
        };

        // --- Optional: SMTP (requires host) ---
        let smtp = get("SMTP_HOST").map(|host| {
            let port = get("SMTP_PORT")
                .and_then(|p| p.parse().ok())
                .unwrap_or(587);
            let username = get("SMTP_USER").unwrap_or_default();
            let password = get("SMTP_PASS").unwrap_or_default();
            let from = get("SMTP_FROM").unwrap_or_else(|| format!("rstify@{}", host));
            SmtpConfig { host, port, username, password, from }
        });

        Ok(Config {
            server: ServerConfig { listen_addr, upload_dir, max_attachment_size },
            database: DatabaseConfig { url: database_url },
            auth: AuthConfig { jwt_secret },
            mqtt,
            fcm,
            smtp,
            rate_limit: RateLimitConfig { burst, rps },
            cors: CorsConfig { origins: cors_origins },
        })
    }
}

fn parse_optional<T: std::str::FromStr, F: Fn(&str) -> Option<String>>(
    get: &F,
    key: &str,
    default: T,
) -> Result<T, ConfigError> {
    match get(key) {
        None => Ok(default),
        Some(v) => v.parse::<T>().map_err(|_| {
            ConfigError(format!("{key} must be a valid {}", std::any::type_name::<T>()))
        }),
    }
}

fn parse_optional_f64<F: Fn(&str) -> Option<String>>(
    get: &F,
    key: &str,
    default: f64,
) -> Result<f64, ConfigError> {
    match get(key) {
        None => Ok(default),
        Some(v) => v.parse::<f64>().map_err(|_| {
            ConfigError(format!("{key} must be a valid floating-point number"))
        }),
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/jsprague/dev/rstify && cargo test -p rstify-server -- config`
Expected: All 11 config tests pass.

- [ ] **Step 5: Commit**

```bash
git add crates/rstify-server/src/config.rs
git commit -m "feat(config): centralized Config struct with sub-configs and validation"
```

---

### Task 2: Wire Config Through AppState and Bootstrap

**Files:**
- Modify: `crates/rstify-api/src/state.rs` (accept config fields, remove env::var)
- Modify: `crates/rstify-server/src/main.rs` (use new Config, pass sub-configs)
- Modify: `crates/rstify-api/src/fcm.rs` (accept FcmConfig from caller, remove from_env)
- Modify: `crates/rstify-api/src/routes/mqtt.rs` (read from AppState, not env)
- Modify: `crates/rstify-jobs/src/email.rs` (accept SmtpConfig from caller, remove from_env)

- [ ] **Step 1: Add MqttConfig fields to AppState**

In `crates/rstify-api/src/state.rs`, add an `mqtt_status` field that stores the MQTT config info the status endpoint needs. Remove the `RSTIFY_MAX_ATTACHMENT_SIZE` env::var read from `AppState::new()`.

```rust
// In the AppState struct, add:
pub mqtt_config: Option<MqttStatusConfig>,

// New struct in state.rs:
#[derive(Clone)]
pub struct MqttStatusConfig {
    pub listen_addr: String,
    pub ws_listen_addr: Option<String>,
}
```

Update `AppState::new()` to accept `max_upload_size: usize` as a parameter instead of reading from env:

```rust
pub fn new(pool: SqlitePool, jwt_secret: String, upload_dir: String, max_upload_size: usize) -> Self {
    Self {
        // ... existing fields ...
        max_upload_size,
        mqtt_config: None,
        // ... rest ...
    }
}

pub fn with_mqtt_status(mut self, config: MqttStatusConfig) -> Self {
    self.mqtt_config = Some(config);
    self
}
```

- [ ] **Step 2: Fix mqtt_status handler to read from AppState**

In `crates/rstify-api/src/routes/mqtt.rs`, replace the `std::env::var` calls (lines 31-45) with reads from `state.mqtt_config`:

```rust
pub async fn mqtt_status(
    State(state): State<AppState>,
    _auth: AuthUser,
) -> Result<Json<MqttStatusResponse>, ApiError> {
    let (mqtt_enabled, listen_addr, ws_listen_addr) = match &state.mqtt_config {
        Some(cfg) => (true, Some(cfg.listen_addr.clone()), cfg.ws_listen_addr.clone()),
        None => (false, None, None),
    };

    // ... rest of handler unchanged ...
```

- [ ] **Step 3: Update FcmConfig to accept fields instead of reading env**

In `crates/rstify-api/src/fcm.rs`, keep the `FcmConfig` struct and `FcmClient::new()` as-is, but change `FcmConfig::from_env()` to `FcmConfig::from_path()` that accepts the values:

```rust
impl FcmConfig {
    /// Load FCM config from provided values. Returns None if service account file is invalid.
    pub fn from_path(project_id: String, service_account_path: &str) -> Option<Self> {
        let sa_json = match std::fs::read_to_string(service_account_path) {
            Ok(json) => json,
            Err(e) => {
                error!("Failed to read FCM service account file '{}': {}", service_account_path, e);
                return None;
            }
        };

        let mut sa: ServiceAccount = match serde_json::from_str(&sa_json) {
            Ok(sa) => sa,
            Err(e) => {
                error!("Failed to parse FCM service account JSON: {}", e);
                return None;
            }
        };

        if sa.token_uri.is_empty() {
            sa.token_uri = "https://oauth2.googleapis.com/token".to_string();
        }

        Some(FcmConfig { project_id, service_account: sa })
    }
}
```

- [ ] **Step 4: Update EmailConfig to accept fields instead of reading env**

In `crates/rstify-jobs/src/email.rs`, change `EmailConfig::from_env()` to `EmailConfig::new()`:

```rust
impl EmailConfig {
    pub fn new(host: String, port: u16, username: String, password: String, from: String) -> Self {
        Self { host, port, username, password, from }
    }
}
```

Remove the `from_env()` method entirely.

- [ ] **Step 5: Update main.rs to wire everything through Config**

In `crates/rstify-server/src/main.rs`, update the bootstrap to use the new Config:

```rust
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    telemetry::init();

    let config = config::Config::from_env().map_err(|e| anyhow::anyhow!("{}", e))?;
    info!("Starting rstify server on {}", config.server.listen_addr);

    // Database setup
    let db = Database::connect(&config.database.url).await?;
    db.migrate().await?;
    let pool = db.pool().clone();

    // ... seed default admin (unchanged) ...
    // ... load inbox threshold (unchanged) ...

    // Create AppState with config values
    let mut state = AppState::new(
        pool.clone(),
        config.auth.jwt_secret.clone(),
        config.server.upload_dir.clone(),
        config.server.max_attachment_size,
    );
    state.inbox_threshold.store(inbox_threshold_value, std::sync::atomic::Ordering::Relaxed);

    // FCM
    if let Some(ref fcm_cfg) = config.fcm {
        if let Some(fcm_config) = rstify_api::fcm::FcmConfig::from_path(
            fcm_cfg.project_id.clone(),
            &fcm_cfg.service_account_path,
        ) {
            info!("FCM push notifications enabled (project: {})", fcm_cfg.project_id);
            state = state.with_fcm(rstify_api::fcm::FcmClient::new(fcm_config));
        } else {
            tracing::error!("FCM configuration invalid — push notifications disabled");
        }
    }

    // MQTT
    if let Some(ref mqtt_cfg) = config.mqtt {
        state = state.with_mqtt_status(rstify_api::state::MqttStatusConfig {
            listen_addr: mqtt_cfg.listen_addr.clone(),
            ws_listen_addr: mqtt_cfg.ws_listen_addr.clone(),
        });

        // Create rstify_mqtt::MqttConfig directly from centralized config
        let broker_config = rstify_mqtt::MqttConfig {
            enabled: true,
            listen_addr: mqtt_cfg.listen_addr.clone(),
            ws_listen_addr: mqtt_cfg.ws_listen_addr.clone(),
            require_auth: mqtt_cfg.require_auth,
            max_payload_size: mqtt_cfg.max_payload_size,
            max_connections: mqtt_cfg.max_connections,
        };
        // Use broker_config for MQTT broker/ingest/publisher init below
    }

    // Rate limiter
    let limiter = RateLimiter::new(config.rate_limit.burst, config.rate_limit.rps);

    // CORS
    let cors = if config.cors.origins.is_empty() {
        warn!("CORS_ORIGINS not set — defaulting to same-origin only");
        CorsLayer::new()
    } else {
        // ... parse origins from config.cors.origins ...
    };

    // ... rest of server start using config.server.listen_addr ...
```

- [ ] **Step 6: Remove MqttConfig::from_env() from rstify-mqtt**

In `crates/rstify-mqtt/src/config.rs`, remove the `from_env()` method. Keep the `MqttConfig` struct but change it to accept fields directly (or re-use the server's config struct). Update any callers in main.rs to pass the values from the centralized config.

- [ ] **Step 7: Verify the full build compiles**

Run: `cd /home/jsprague/dev/rstify && cargo build --workspace`
Expected: Compiles with no errors. Zero `std::env::var` calls outside `config.rs`.

- [ ] **Step 8: Verify no env::var calls remain outside config bootstrap**

Run: `cd /home/jsprague/dev/rstify && grep -rn 'std::env::var\|env::var' crates/ --include="*.rs" | grep -v config.rs | grep -v target/ | grep -v test`
Expected: Zero results (or only in test code).

- [ ] **Step 9: Run all existing tests**

Run: `cd /home/jsprague/dev/rstify && cargo test --workspace`
Expected: All existing tests pass + new config tests pass.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(config): wire centralized Config through AppState, remove scattered env::var calls"
```

---

### Task 3: Validation Helpers

**Files:**
- Create: `crates/rstify-api/src/helpers/validation.rs`
- Create: `crates/rstify-api/src/helpers/mod.rs`
- Modify: `crates/rstify-api/src/lib.rs` (add `pub mod helpers`)

- [ ] **Step 1: Write tests for validation helpers**

Create `crates/rstify-api/src/helpers/validation.rs` with tests:

```rust
use crate::error::ApiError;
use rstify_core::error::CoreError;

/// Validate a string field has length within bounds.
pub fn validate_length(field_name: &str, value: &str, min: usize, max: usize) -> Result<(), ApiError> {
    let len = value.len();
    if len < min || len > max {
        return Err(ApiError::from(CoreError::Validation(
            format!("{field_name} must be between {min} and {max} characters (got {len})")
        )));
    }
    Ok(())
}

/// Validate a topic name: 1-128 chars, alphanumeric + dash/underscore/dot,
/// no leading/trailing dots, no consecutive dots, no leading dash/underscore.
pub fn validate_topic_name(name: &str) -> Result<(), ApiError> {
    validate_length("Topic name", name, 1, 128)?;

    if !name.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_' || c == '.') {
        return Err(ApiError::from(CoreError::Validation(
            "Topic name can only contain alphanumeric characters, dashes, underscores, and dots".into()
        )));
    }

    if name.chars().all(|c| c == '.') {
        return Err(ApiError::from(CoreError::Validation(
            "Topic name cannot be all dots".into()
        )));
    }

    if name.starts_with('.') || name.ends_with('.') {
        return Err(ApiError::from(CoreError::Validation(
            "Topic name cannot start or end with a dot".into()
        )));
    }

    if name.contains("..") {
        return Err(ApiError::from(CoreError::Validation(
            "Topic name cannot contain consecutive dots".into()
        )));
    }

    if name.starts_with('-') || name.starts_with('_') {
        return Err(ApiError::from(CoreError::Validation(
            "Topic name cannot start with a dash or underscore".into()
        )));
    }

    Ok(())
}

/// Validate a JSON string is valid JSON.
pub fn validate_json(field_name: &str, value: &str) -> Result<(), ApiError> {
    serde_json::from_str::<serde_json::Value>(value).map_err(|_| {
        ApiError::from(CoreError::Validation(
            format!("{field_name} must be valid JSON")
        ))
    })?;
    Ok(())
}

/// Validate a policy value against allowed options.
pub fn validate_policy(field_name: &str, value: &str, allowed: &[&str]) -> Result<(), ApiError> {
    if !allowed.contains(&value) {
        return Err(ApiError::from(CoreError::Validation(
            format!("{field_name} must be one of: {}", allowed.join(", "))
        )));
    }
    Ok(())
}

/// Validate a positive integer field.
pub fn validate_positive(field_name: &str, value: i32) -> Result<(), ApiError> {
    if value <= 0 {
        return Err(ApiError::from(CoreError::Validation(
            format!("{field_name} must be a positive integer")
        )));
    }
    Ok(())
}

pub const NOTIFY_POLICIES: &[&str] = &["always", "never", "threshold", "on_change", "digest"];
pub const STORE_POLICIES: &[&str] = &["all", "on_change", "interval"];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_length_valid() {
        assert!(validate_length("name", "hello", 1, 128).is_ok());
    }

    #[test]
    fn test_validate_length_too_short() {
        let err = validate_length("name", "", 1, 128).unwrap_err();
        assert_eq!(err.status, axum::http::StatusCode::BAD_REQUEST);
    }

    #[test]
    fn test_validate_length_too_long() {
        let long = "a".repeat(129);
        let err = validate_length("name", &long, 1, 128).unwrap_err();
        assert!(err.message.contains("128"));
    }

    #[test]
    fn test_topic_name_valid() {
        assert!(validate_topic_name("alerts.cpu").is_ok());
        assert!(validate_topic_name("my-topic_1").is_ok());
        assert!(validate_topic_name("a").is_ok());
    }

    #[test]
    fn test_topic_name_invalid_chars() {
        assert!(validate_topic_name("hello world").is_err());
        assert!(validate_topic_name("foo/bar").is_err());
    }

    #[test]
    fn test_topic_name_dot_rules() {
        assert!(validate_topic_name(".leading").is_err());
        assert!(validate_topic_name("trailing.").is_err());
        assert!(validate_topic_name("double..dot").is_err());
        assert!(validate_topic_name("...").is_err());
    }

    #[test]
    fn test_topic_name_leading_dash_underscore() {
        assert!(validate_topic_name("-start").is_err());
        assert!(validate_topic_name("_start").is_err());
    }

    #[test]
    fn test_validate_json_valid() {
        assert!(validate_json("data", r#"{"key": "value"}"#).is_ok());
    }

    #[test]
    fn test_validate_json_invalid() {
        assert!(validate_json("data", "not json").is_err());
    }

    #[test]
    fn test_validate_policy_valid() {
        assert!(validate_policy("notify", "always", NOTIFY_POLICIES).is_ok());
    }

    #[test]
    fn test_validate_policy_invalid() {
        assert!(validate_policy("notify", "bogus", NOTIFY_POLICIES).is_err());
    }

    #[test]
    fn test_validate_positive_valid() {
        assert!(validate_positive("count", 1).is_ok());
    }

    #[test]
    fn test_validate_positive_zero() {
        assert!(validate_positive("count", 0).is_err());
    }

    #[test]
    fn test_validate_positive_negative() {
        assert!(validate_positive("count", -1).is_err());
    }
}
```

- [ ] **Step 2: Create the helpers module**

Create `crates/rstify-api/src/helpers/mod.rs`:

```rust
pub mod validation;
```

Add to `crates/rstify-api/src/lib.rs`:

```rust
pub mod helpers;
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `cd /home/jsprague/dev/rstify && cargo test -p rstify-api -- helpers::validation`
Expected: All 14 validation tests pass.

- [ ] **Step 4: Commit**

```bash
git add crates/rstify-api/src/helpers/
git add crates/rstify-api/src/lib.rs
git commit -m "feat(api): add centralized validation helpers with tests"
```

---

### Task 4: Ownership Helpers

**Files:**
- Create: `crates/rstify-api/src/helpers/ownership.rs`
- Modify: `crates/rstify-api/src/helpers/mod.rs`

- [ ] **Step 1: Write tests for ownership helpers**

Create `crates/rstify-api/src/helpers/ownership.rs`:

```rust
use crate::error::ApiError;
use crate::extractors::auth::AuthUser;
use rstify_core::error::CoreError;

/// Fetch a resource by ID from a repository, returning NotFound if absent.
/// The `fetch` closure calls the appropriate repo method.
pub async fn fetch_or_not_found<T, F, Fut>(
    resource_name: &str,
    fetch: F,
) -> Result<T, ApiError>
where
    F: FnOnce() -> Fut,
    Fut: std::future::Future<Output = Result<Option<T>, CoreError>>,
{
    fetch()
        .await
        .map_err(ApiError::from)?
        .ok_or_else(|| {
            ApiError::from(CoreError::NotFound(
                format!("{resource_name} not found"),
            ))
        })
}

/// Verify the authenticated user owns a resource (by user_id field).
/// Admins bypass ownership checks.
pub fn verify_ownership(
    auth: &AuthUser,
    resource_user_id: i64,
    resource_name: &str,
) -> Result<(), ApiError> {
    if resource_user_id != auth.user.id && !auth.user.is_admin {
        return Err(ApiError::from(CoreError::Forbidden(
            format!("Not your {resource_name}"),
        )));
    }
    Ok(())
}

/// Verify the authenticated user owns a resource with an optional owner_id
/// (e.g., topics where owner_id is Option<i64>).
pub fn verify_optional_ownership(
    auth: &AuthUser,
    resource_owner_id: Option<i64>,
    resource_name: &str,
) -> Result<(), ApiError> {
    match resource_owner_id {
        Some(owner_id) => verify_ownership(auth, owner_id, resource_name),
        None => {
            // No owner — only admins can modify
            if !auth.user.is_admin {
                return Err(ApiError::from(CoreError::Forbidden(
                    format!("Not your {resource_name}"),
                )));
            }
            Ok(())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rstify_core::models::User;

    fn make_auth(user_id: i64, is_admin: bool) -> AuthUser {
        AuthUser {
            user: User {
                id: user_id,
                username: "testuser".into(),
                password_hash: String::new(),
                email: None,
                is_admin,
                created_at: String::new(),
                updated_at: String::new(),
            },
            claims: None,
            client: None,
        }
    }

    #[test]
    fn test_verify_ownership_owner_matches() {
        let auth = make_auth(42, false);
        assert!(verify_ownership(&auth, 42, "client").is_ok());
    }

    #[test]
    fn test_verify_ownership_different_user_denied() {
        let auth = make_auth(42, false);
        let err = verify_ownership(&auth, 99, "client").unwrap_err();
        assert_eq!(err.status, axum::http::StatusCode::FORBIDDEN);
        assert!(err.message.contains("Not your client"));
    }

    #[test]
    fn test_verify_ownership_admin_bypasses() {
        let auth = make_auth(42, true);
        assert!(verify_ownership(&auth, 99, "client").is_ok());
    }

    #[test]
    fn test_verify_optional_ownership_some_owner_matches() {
        let auth = make_auth(42, false);
        assert!(verify_optional_ownership(&auth, Some(42), "topic").is_ok());
    }

    #[test]
    fn test_verify_optional_ownership_some_owner_denied() {
        let auth = make_auth(42, false);
        assert!(verify_optional_ownership(&auth, Some(99), "topic").is_err());
    }

    #[test]
    fn test_verify_optional_ownership_none_admin_allowed() {
        let auth = make_auth(42, true);
        assert!(verify_optional_ownership(&auth, None, "topic").is_ok());
    }

    #[test]
    fn test_verify_optional_ownership_none_non_admin_denied() {
        let auth = make_auth(42, false);
        assert!(verify_optional_ownership(&auth, None, "topic").is_err());
    }

    #[tokio::test]
    async fn test_fetch_or_not_found_some() {
        let result: Result<i64, ApiError> =
            fetch_or_not_found("thing", || async { Ok(Some(42i64)) }).await;
        assert_eq!(result.unwrap(), 42);
    }

    #[tokio::test]
    async fn test_fetch_or_not_found_none() {
        let result: Result<i64, ApiError> =
            fetch_or_not_found("thing", || async { Ok(None) }).await;
        let err = result.unwrap_err();
        assert_eq!(err.status, axum::http::StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn test_fetch_or_not_found_db_error() {
        let result: Result<i64, ApiError> =
            fetch_or_not_found("thing", || async {
                Err(CoreError::Database("connection lost".into()))
            }).await;
        let err = result.unwrap_err();
        assert_eq!(err.status, axum::http::StatusCode::INTERNAL_SERVER_ERROR);
    }
}
```

- [ ] **Step 2: Add to helpers module**

In `crates/rstify-api/src/helpers/mod.rs`, add:

```rust
pub mod ownership;
pub mod validation;
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `cd /home/jsprague/dev/rstify && cargo test -p rstify-api -- helpers::ownership`
Expected: All 10 ownership tests pass.

- [ ] **Step 4: Commit**

```bash
git add crates/rstify-api/src/helpers/
git commit -m "feat(api): add ownership verification helpers with tests"
```

---

### Task 5: Safe JSON Serialization Helper

**Files:**
- Create: `crates/rstify-api/src/helpers/json.rs`
- Modify: `crates/rstify-api/src/helpers/mod.rs`

- [ ] **Step 1: Write the helper with tests**

Create `crates/rstify-api/src/helpers/json.rs`:

```rust
use crate::error::ApiError;
use rstify_core::error::CoreError;
use serde::Serialize;

/// Serialize a value to a JSON string, returning an ApiError on failure
/// instead of panicking.
pub fn to_json_string<T: Serialize>(value: &T) -> Result<String, ApiError> {
    serde_json::to_string(value).map_err(|e| {
        ApiError::from(CoreError::Internal(format!("JSON serialization failed: {e}")))
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_serialize_vec_string() {
        let scopes = vec!["read".to_string(), "write".to_string()];
        let result = to_json_string(&scopes).unwrap();
        assert_eq!(result, r#"["read","write"]"#);
    }

    #[test]
    fn test_serialize_empty_vec() {
        let empty: Vec<String> = vec![];
        let result = to_json_string(&empty).unwrap();
        assert_eq!(result, "[]");
    }
}
```

- [ ] **Step 2: Add to helpers module**

In `crates/rstify-api/src/helpers/mod.rs`:

```rust
pub mod json;
pub mod ownership;
pub mod validation;
```

- [ ] **Step 3: Run tests**

Run: `cd /home/jsprague/dev/rstify && cargo test -p rstify-api -- helpers::json`
Expected: 2 tests pass.

- [ ] **Step 4: Replace raw unwraps in clients.rs**

In `crates/rstify-api/src/routes/clients.rs`, replace:

Line 39: `let scopes_json = serde_json::to_string(&scopes).unwrap();`
With: `let scopes_json = crate::helpers::json::to_json_string(&scopes)?;`

Line 77: `let scopes_json = req.scopes.map(|s| serde_json::to_string(&s).unwrap());`
With:
```rust
let scopes_json = req.scopes
    .map(|s| crate::helpers::json::to_json_string(&s))
    .transpose()?;
```

- [ ] **Step 5: Run full test suite**

Run: `cd /home/jsprague/dev/rstify && cargo test --workspace`
Expected: All tests pass, zero raw unwraps remain for JSON serialization in prod code.

- [ ] **Step 6: Commit**

```bash
git add crates/rstify-api/src/helpers/ crates/rstify-api/src/routes/clients.rs
git commit -m "feat(api): add safe JSON serialization helper, remove unwrap() from clients.rs"
```

---

### Task 6: Apply Helpers to Route Handlers

**Files:**
- Modify: `crates/rstify-api/src/routes/clients.rs`
- Modify: `crates/rstify-api/src/routes/applications.rs`
- Modify: `crates/rstify-api/src/routes/webhook_variables.rs`
- Modify: `crates/rstify-api/src/routes/topics.rs`
- Modify: `crates/rstify-api/src/routes/users.rs`

- [ ] **Step 1: Refactor clients.rs to use ownership helpers**

Replace the 4 duplicated ownership check blocks in `update_client`, `delete_client`, `register_fcm_token`, `remove_fcm_token` with:

```rust
use crate::helpers::ownership::{fetch_or_not_found, verify_ownership};

// In each handler, replace the 12-line pattern with:
let existing = fetch_or_not_found("Client", || state.client_repo.find_by_id(id)).await?;
verify_ownership(&auth, existing.user_id, "client")?;
```

- [ ] **Step 2: Refactor applications.rs to use ownership helpers**

Same pattern for `update_application`, `delete_application`, `upload_icon`, `delete_icon`:

```rust
let existing = fetch_or_not_found("Application", || state.app_repo.find_by_id(id)).await?;
verify_ownership(&auth, existing.user_id, "application")?;
```

Also replace the inline name validation in `create_application` with:

```rust
use crate::helpers::validation::validate_length;
validate_length("Application name", &req.name, 1, 128)?;
```

- [ ] **Step 3: Refactor webhook_variables.rs to use ownership helpers**

Replace the inefficient "fetch all, filter by id" pattern with `fetch_or_not_found`:

```rust
// In update_variable and delete_variable, replace:
//   let vars = state.webhook_variable_repo.list_webhook_variables(auth.user.id).await...
//   if !vars.iter().any(|v| v.id == id) { ... }
// With:
let existing = fetch_or_not_found("Webhook variable", || {
    // Still uses list + filter (same behavior, cleaner code).
    // A dedicated find_by_id_for_user() repo method would be more efficient
    // but is deferred — the current table is small and this is not a hot path.
    async {
        let vars = state.webhook_variable_repo
            .list_webhook_variables(auth.user.id)
            .await?;
        Ok(vars.into_iter().find(|v| v.id == id))
    }
}).await?;
```

- [ ] **Step 4: Refactor topics.rs to use ownership helpers**

Replace ownership checks in `update_topic` and `delete_topic`:

```rust
use crate::helpers::ownership::{fetch_or_not_found, verify_optional_ownership};

let existing = fetch_or_not_found("Topic", || state.topic_repo.find_by_id(id)).await?;
verify_optional_ownership(&auth, existing.owner_id, "topic")?;
```

Replace topic name validation in `create_topic` with:

```rust
use crate::helpers::validation::validate_topic_name;
validate_topic_name(&req.name)?;
```

Replace policy validation in `update_topic` with:

```rust
use crate::helpers::validation::{validate_policy, validate_json, validate_positive, NOTIFY_POLICIES, STORE_POLICIES};

if let Some(ref policy) = req.notify_policy {
    validate_policy("notify_policy", policy, NOTIFY_POLICIES)?;
}
if let Some(ref condition) = req.notify_condition {
    validate_json("notify_condition", condition)?;
}
if let Some(interval) = req.notify_digest_interval {
    validate_positive("notify_digest_interval", interval)?;
}
if let Some(ref policy) = req.store_policy {
    validate_policy("store_policy", policy, STORE_POLICIES)?;
}
if let Some(interval) = req.store_interval {
    validate_positive("store_interval", interval)?;
}
```

- [ ] **Step 5: Standardize admin checks in users.rs**

Replace all inline `if !auth.user.is_admin` blocks with `auth.require_admin()?`:

```rust
// In list_users, create_user, update_user, delete_user — replace:
//   if !auth.user.is_admin {
//       return Err(ApiError::from(CoreError::Forbidden("Admin access required".into())));
//   }
// With:
auth.require_admin()?;
```

- [ ] **Step 6: Run full test suite**

Run: `cd /home/jsprague/dev/rstify && cargo test --workspace`
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add crates/rstify-api/src/routes/
git commit -m "refactor(api): apply ownership, validation, and admin check helpers across routes"
```

---

### Task 7: Standardize Repository Error Handling

**Files:**
- Modify: `crates/rstify-db/src/repositories/application.rs`
- Modify: `crates/rstify-db/src/repositories/client.rs`
- Modify: `crates/rstify-db/src/repositories/topic.rs`
- Modify: `crates/rstify-db/src/repositories/mqtt_bridge.rs`
- Modify: `crates/rstify-db/src/repositories/webhook_variable.rs`

- [ ] **Step 1: Add UNIQUE constraint handling to application repo**

In `crates/rstify-db/src/repositories/application.rs`, update the `create` method's error handler (line 38):

```rust
// Replace:
.map_err(|e| CoreError::Database(e.to_string()))
// With:
.map_err(|e| {
    if e.to_string().contains("UNIQUE") {
        CoreError::AlreadyExists(format!("Application '{}' already exists", name))
    } else {
        CoreError::Database(e.to_string())
    }
})
```

- [ ] **Step 2: Add UNIQUE handling to client, topic (verify), mqtt_bridge, webhook_variable repos**

Apply the same pattern to each repo's `create` method:

- `client.rs` create → `"Client '{}' already exists"`
- `topic.rs` create → verify existing pattern is consistent
- `mqtt_bridge.rs` create → `"MQTT bridge '{}' already exists"`
- `webhook_variable.rs` create_webhook_variable → `"Webhook variable '{}' already exists"`

- [ ] **Step 3: Run all tests**

Run: `cd /home/jsprague/dev/rstify && cargo test --workspace`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add crates/rstify-db/src/repositories/
git commit -m "fix(db): standardize UNIQUE constraint error handling across all repositories"
```

---

### Task 8: Split topics.rs into Sub-Modules

**Files:**
- Create: `crates/rstify-api/src/routes/topics/mod.rs`
- Create: `crates/rstify-api/src/routes/topics/management.rs`
- Create: `crates/rstify-api/src/routes/topics/permissions.rs`
- Create: `crates/rstify-api/src/routes/topics/streaming.rs`
- Delete: `crates/rstify-api/src/routes/topics.rs` (replaced by directory)
- Modify: `crates/rstify-api/src/routes/mod.rs` (update imports)

- [ ] **Step 1: Read the current topics.rs to identify split boundaries**

Read `crates/rstify-api/src/routes/topics.rs` and identify function groupings:

- **management.rs**: `create_topic`, `list_topics`, `get_topic`, `update_topic`, `delete_topic`, `list_topic_messages`
- **permissions.rs**: `create_permission`, `list_permissions`, `delete_permission`
- **streaming.rs**: `publish_to_topic`, `topic_websocket`, `topic_json_stream`

- [ ] **Step 2: Create the topics directory and mod.rs**

Create `crates/rstify-api/src/routes/topics/mod.rs`:

```rust
mod management;
mod permissions;
mod streaming;

pub use management::*;
pub use permissions::*;
pub use streaming::*;
```

- [ ] **Step 3: Move management functions**

Create `crates/rstify-api/src/routes/topics/management.rs` with `create_topic`, `list_topics`, `get_topic`, `update_topic`, `delete_topic`, and `list_topic_messages`. Include all necessary imports. Use the validation helpers from Task 3 (already applied in Task 6).

- [ ] **Step 4: Move permission functions**

Create `crates/rstify-api/src/routes/topics/permissions.rs` with `create_permission`, `list_permissions`, `delete_permission`. Replace inline admin checks with `auth.require_admin()?`.

- [ ] **Step 5: Move streaming functions**

Create `crates/rstify-api/src/routes/topics/streaming.rs` with `publish_to_topic`, `topic_websocket`, `topic_json_stream`. Use validation helpers for message length checks.

- [ ] **Step 6: Delete old topics.rs**

Remove `crates/rstify-api/src/routes/topics.rs` — the directory module replaces it.

- [ ] **Step 7: Verify routes/mod.rs still compiles**

The existing `mod.rs` line `pub mod topics;` should resolve to the directory module automatically. Verify all re-exports work.

- [ ] **Step 8: Run full test suite**

Run: `cd /home/jsprague/dev/rstify && cargo test --workspace`
Expected: All tests pass.

- [ ] **Step 9: Commit**

```bash
git add crates/rstify-api/src/routes/
git commit -m "refactor(api): split topics.rs into management, permissions, and streaming sub-modules"
```

---

### Task 9: Split messages.rs into Sub-Modules

**Files:**
- Create: `crates/rstify-api/src/routes/messages/mod.rs`
- Create: `crates/rstify-api/src/routes/messages/crud.rs`
- Create: `crates/rstify-api/src/routes/messages/search.rs`
- Delete: `crates/rstify-api/src/routes/messages.rs`

- [ ] **Step 1: Read messages.rs and identify split boundaries**

- **crud.rs**: `create_app_message`, `list_messages`, `list_application_messages`, `update_message`, `delete_message`, `delete_all_messages`, `delete_batch_messages`, `delete_all_app_messages`, `websocket_stream`, and the `enrich_with_attachments` helper
- **search.rs**: `search_messages`

- [ ] **Step 2: Create messages directory and mod.rs**

Create `crates/rstify-api/src/routes/messages/mod.rs`:

```rust
mod crud;
mod search;

pub use crud::*;
pub use search::*;
```

- [ ] **Step 3: Move crud functions**

Create `crates/rstify-api/src/routes/messages/crud.rs` with all CRUD functions and the `enrich_with_attachments` helper. Apply ownership helpers where applicable.

- [ ] **Step 4: Move search functions**

Create `crates/rstify-api/src/routes/messages/search.rs` with `search_messages`.

- [ ] **Step 5: Delete old messages.rs and verify**

Run: `cd /home/jsprague/dev/rstify && cargo test --workspace`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add crates/rstify-api/src/routes/
git commit -m "refactor(api): split messages.rs into crud and search sub-modules"
```

---

### Task 10: Split webhooks.rs into Sub-Modules

**Files:**
- Create: `crates/rstify-api/src/routes/webhooks/mod.rs`
- Create: `crates/rstify-api/src/routes/webhooks/config.rs`
- Create: `crates/rstify-api/src/routes/webhooks/delivery.rs`
- Delete: `crates/rstify-api/src/routes/webhooks.rs`

- [ ] **Step 1: Read webhooks.rs and identify split boundaries**

- **config.rs**: `create_webhook`, `list_webhooks`, `update_webhook`, `delete_webhook`, `regenerate_webhook_token`, `receive_webhook`
- **delivery.rs**: `list_webhook_deliveries`, `test_webhook`

- [ ] **Step 2: Create webhooks directory and mod.rs**

Create `crates/rstify-api/src/routes/webhooks/mod.rs`:

```rust
mod config;
mod delivery;

pub use config::*;
pub use delivery::*;
```

- [ ] **Step 3: Move config functions**

Create `crates/rstify-api/src/routes/webhooks/config.rs` with webhook CRUD and incoming webhook handler. Apply ownership helpers.

- [ ] **Step 4: Move delivery functions**

Create `crates/rstify-api/src/routes/webhooks/delivery.rs` with delivery log and test functions. Apply ownership helpers.

- [ ] **Step 5: Delete old webhooks.rs and verify**

Run: `cd /home/jsprague/dev/rstify && cargo test --workspace`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add crates/rstify-api/src/routes/
git commit -m "refactor(api): split webhooks.rs into config and delivery sub-modules"
```

---

### Task 11: Final Verification

**Files:** None (verification only)

- [ ] **Step 1: Verify no env::var calls outside config bootstrap**

Run: `cd /home/jsprague/dev/rstify && grep -rn 'std::env::var\|env::var' crates/ --include="*.rs" | grep -v config.rs | grep -v target/ | grep -v '#\[cfg(test)\]' | grep -v 'mod tests'`
Expected: Zero results.

- [ ] **Step 2: Verify no raw unwrap() in production serialization paths**

Run: `cd /home/jsprague/dev/rstify && grep -rn '\.unwrap()' crates/rstify-api/src/routes/ --include="*.rs"`
Expected: Zero results in route handlers (acceptable in test code).

- [ ] **Step 3: Verify no oversized route files**

Run: `cd /home/jsprague/dev/rstify && find crates/rstify-api/src/routes -name "*.rs" -exec wc -l {} \; | sort -rn`
Expected: No single route file exceeds ~300 LOC.

- [ ] **Step 4: Verify all admin checks use require_admin()**

Run: `cd /home/jsprague/dev/rstify && grep -rn 'is_admin' crates/rstify-api/src/routes/ --include="*.rs" | grep -v 'require_admin' | grep -v test`
Expected: Zero results in route handlers (only in extractor definition).

- [ ] **Step 5: Run full test suite one final time**

Run: `cd /home/jsprague/dev/rstify && cargo test --workspace`
Expected: All tests pass (existing + new helper tests).

- [ ] **Step 6: Run cargo clippy**

Run: `cd /home/jsprague/dev/rstify && cargo clippy --workspace -- -D warnings`
Expected: Zero warnings.

- [ ] **Step 7: Run cargo fmt check**

Run: `cd /home/jsprague/dev/rstify && cargo fmt --all --check`
Expected: No formatting issues.

- [ ] **Step 8: Final commit if any formatting fixes needed**

```bash
cargo fmt --all
git add -A
git commit -m "style: format after Phase 1 refactoring"
```
