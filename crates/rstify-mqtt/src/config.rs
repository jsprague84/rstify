pub struct MqttConfig {
    pub enabled: bool,
    pub listen_addr: String,
    pub ws_listen_addr: Option<String>,
    pub require_auth: bool,
    pub max_payload_size: usize,
    pub max_connections: usize,
}
