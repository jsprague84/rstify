use std::env;

pub struct MqttConfig {
    pub enabled: bool,
    pub listen_addr: String,
    pub ws_listen_addr: Option<String>,
    pub require_auth: bool,
    pub max_payload_size: usize,
    pub max_connections: usize,
}

impl MqttConfig {
    pub fn from_env() -> Self {
        Self {
            enabled: env::var("MQTT_ENABLED")
                .map(|v| v == "true" || v == "1")
                .unwrap_or(false),
            listen_addr: env::var("MQTT_LISTEN_ADDR")
                .unwrap_or_else(|_| "0.0.0.0:1883".to_string()),
            ws_listen_addr: env::var("MQTT_WS_LISTEN_ADDR").ok(),
            require_auth: env::var("MQTT_REQUIRE_AUTH")
                .map(|v| v != "false" && v != "0")
                .unwrap_or(true),
            max_payload_size: env::var("MQTT_MAX_PAYLOAD")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(20480),
            max_connections: env::var("MQTT_MAX_CONNECTIONS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(1000),
        }
    }
}
