use rstify_core::models::{MessageResponse, MqttBridge};
use rstify_core::repositories::{MessageRepository, MqttBridgeRepository, TopicRepository};
use rstify_db::repositories::message::SqliteMessageRepo;
use rstify_db::repositories::mqtt_bridge::SqliteMqttBridgeRepo;
use rstify_db::repositories::topic::SqliteTopicRepo;
use rumqttc::{AsyncClient, Event, MqttOptions, Packet, QoS};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::broadcast;
use tokio::task::JoinHandle;
use tracing::{debug, error, info, warn};

/// Status info for a single bridge.
#[derive(Clone, Debug, serde::Serialize, utoipa::ToSchema)]
pub struct BridgeStatusInfo {
    pub id: i64,
    pub name: String,
    pub connected: bool,
}

/// Manages active bridge connections to external MQTT brokers.
pub struct BridgeManager {
    active_bridges: HashMap<i64, (String, JoinHandle<()>)>,
    topic_repo: SqliteTopicRepo,
    message_repo: SqliteMessageRepo,
    bridge_repo: SqliteMqttBridgeRepo,
    topic_broadcast: broadcast::Sender<Arc<MessageResponse>>,
    pool: sqlx::SqlitePool,
}

impl BridgeManager {
    pub fn new(
        topic_repo: SqliteTopicRepo,
        message_repo: SqliteMessageRepo,
        bridge_repo: SqliteMqttBridgeRepo,
        topic_broadcast: broadcast::Sender<Arc<MessageResponse>>,
        pool: sqlx::SqlitePool,
    ) -> Self {
        Self {
            active_bridges: HashMap::new(),
            topic_repo,
            message_repo,
            bridge_repo,
            topic_broadcast,
            pool,
        }
    }

    /// Load and start all enabled bridges from the database.
    pub async fn start_all_enabled(&mut self) {
        match self.bridge_repo.list_enabled().await {
            Ok(bridges) => {
                info!(count = bridges.len(), "Loading enabled MQTT bridges");
                for bridge in bridges {
                    self.start_bridge(bridge);
                }
            }
            Err(e) => {
                error!(error = %e, "Failed to load MQTT bridges");
            }
        }
    }

    /// Start a single bridge connection.
    pub fn start_bridge(&mut self, bridge: MqttBridge) {
        let bridge_id = bridge.id;
        let bridge_name = bridge.name.clone();

        // Stop existing bridge if running
        if let Some((_, handle)) = self.active_bridges.remove(&bridge_id) {
            handle.abort();
        }

        let topic_repo = self.topic_repo.clone();
        let message_repo = self.message_repo.clone();
        let topic_broadcast = self.topic_broadcast.clone();
        let pool = self.pool.clone();

        let handle = tokio::spawn(async move {
            run_bridge(bridge, topic_repo, message_repo, topic_broadcast, pool).await;
        });

        info!(bridge_id, name = %bridge_name, "Started MQTT bridge");
        self.active_bridges.insert(bridge_id, (bridge_name, handle));
    }

    /// Stop a bridge by ID.
    pub fn stop_bridge(&mut self, bridge_id: i64) {
        if let Some((_, handle)) = self.active_bridges.remove(&bridge_id) {
            handle.abort();
            info!(bridge_id, "Stopped MQTT bridge");
        }
    }

    /// Get the number of active bridges.
    pub fn active_count(&self) -> usize {
        self.active_bridges.len()
    }

    /// Get status info for all tracked bridges.
    pub fn bridge_statuses(&self) -> Vec<BridgeStatusInfo> {
        self.active_bridges
            .iter()
            .map(|(id, (name, handle))| BridgeStatusInfo {
                id: *id,
                name: name.clone(),
                connected: !handle.is_finished(),
            })
            .collect()
    }
}

/// Parse a remote URL into (host, port).
fn parse_remote_url(url: &str) -> Option<(String, u16)> {
    // Support formats: "host:port", "mqtt://host:port", "tcp://host:port"
    let stripped = url
        .strip_prefix("mqtt://")
        .or_else(|| url.strip_prefix("tcp://"))
        .unwrap_or(url);

    if let Some((host, port_str)) = stripped.rsplit_once(':') {
        if let Ok(port) = port_str.parse::<u16>() {
            return Some((host.to_string(), port));
        }
    }
    None
}

/// Run a bridge connection to an external MQTT broker.
async fn run_bridge(
    bridge: MqttBridge,
    topic_repo: SqliteTopicRepo,
    message_repo: SqliteMessageRepo,
    topic_broadcast: broadcast::Sender<Arc<MessageResponse>>,
    pool: sqlx::SqlitePool,
) {
    let (host, port) = match parse_remote_url(&bridge.remote_url) {
        Some(hp) => hp,
        None => {
            error!(
                bridge_id = bridge.id,
                url = bridge.remote_url,
                "Invalid remote URL for MQTT bridge"
            );
            return;
        }
    };

    let client_id = format!("rstify-bridge-{}", bridge.id);
    let mut options = MqttOptions::new(&client_id, &host, port);
    options.set_keep_alive(Duration::from_secs(30));

    if let (Some(ref user), Some(ref pass)) = (&bridge.username, &bridge.password) {
        options.set_credentials(user, pass);
    }

    let (client, mut eventloop) = AsyncClient::new(options, 100);

    // Subscribe to configured topics
    let subscribe_topics: Vec<String> =
        serde_json::from_str(&bridge.subscribe_topics).unwrap_or_default();
    let qos = match bridge.qos.unwrap_or(0) {
        0 => QoS::AtMostOnce,
        1 => QoS::AtLeastOnce,
        _ => QoS::ExactlyOnce,
    };

    for topic in &subscribe_topics {
        if let Err(e) = client.subscribe(topic, qos).await {
            error!(
                bridge_id = bridge.id,
                topic, error = %e, "Failed to subscribe on bridge"
            );
        }
    }

    info!(
        bridge_id = bridge.id,
        name = bridge.name,
        host,
        port,
        topics = ?subscribe_topics,
        "Bridge connected to external broker"
    );

    // Event loop — process incoming messages
    loop {
        match eventloop.poll().await {
            Ok(Event::Incoming(Packet::Publish(publish))) => {
                let mqtt_topic = publish.topic.clone();
                let payload = publish.payload.to_vec();

                // Map topic: apply prefix if configured, then convert / to .
                let rstify_topic = if let Some(ref prefix) = bridge.topic_prefix {
                    format!("{}.{}", prefix, mqtt_topic.replace('/', "."))
                } else {
                    mqtt_topic.replace('/', ".")
                };

                let (title, message, priority) =
                    crate::ingest::parse_mqtt_payload(&payload, &rstify_topic);

                // Find or auto-create topic
                let topic = match topic_repo.find_by_name(&rstify_topic).await {
                    Ok(Some(t)) => t,
                    Ok(None) => {
                        if bridge.auto_create_topics {
                            match topic_repo
                                .create(&rstify_topic, None, None, true, false)
                                .await
                            {
                                Ok(t) => {
                                    debug!(
                                        topic = rstify_topic,
                                        bridge_id = bridge.id,
                                        "Auto-created topic from bridge"
                                    );
                                    t
                                }
                                Err(e) => {
                                    error!(topic = rstify_topic, error = %e, "Failed to create topic from bridge");
                                    continue;
                                }
                            }
                        } else {
                            debug!(
                                topic = rstify_topic,
                                "Skipping message for non-existent topic (auto_create disabled)"
                            );
                            continue;
                        }
                    }
                    Err(e) => {
                        error!(topic = rstify_topic, error = %e, "Failed to look up topic");
                        continue;
                    }
                };

                // Evaluate inbox flag
                let threshold: i32 = sqlx::query_scalar(
                    "SELECT CAST(value AS INTEGER) FROM settings WHERE key = 'inbox_priority_threshold'",
                )
                .fetch_optional(&pool)
                .await
                .ok()
                .flatten()
                .unwrap_or(5);
                let inbox = rstify_core::policy::should_inbox(&topic, priority, threshold);

                // Create message
                match message_repo
                    .create(
                        None,
                        Some(topic.id),
                        None,
                        title.as_deref(),
                        &message,
                        priority,
                        None,
                        None,
                        None,
                        None,
                        None,
                        None,
                        None,
                        Some("mqtt"),
                        inbox,
                    )
                    .await
                {
                    Ok(msg) => {
                        let response = msg.to_response(Some(rstify_topic.clone()));
                        let _ = topic_broadcast.send(Arc::new(response.clone()));

                        let pool = pool.clone();
                        let topic_name = rstify_topic.clone();
                        tokio::spawn(async move {
                            rstify_jobs::outgoing_webhooks::fire_outgoing_webhooks(
                                &pool,
                                &topic_name,
                                &response,
                            )
                            .await;
                        });
                    }
                    Err(e) => {
                        error!(topic = rstify_topic, error = %e, "Failed to create message from bridge");
                    }
                }
            }
            Ok(_) => {} // Other events (ConnAck, PingResp, etc.)
            Err(e) => {
                warn!(
                    bridge_id = bridge.id,
                    name = bridge.name,
                    error = %e,
                    "Bridge connection error, reconnecting..."
                );
                tokio::time::sleep(Duration::from_secs(5)).await;
            }
        }
    }
}

/// Make parse_mqtt_payload accessible from bridge module
pub use crate::ingest::parse_mqtt_payload;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_remote_url_host_port() {
        let (host, port) = parse_remote_url("broker.example.com:1883").unwrap();
        assert_eq!(host, "broker.example.com");
        assert_eq!(port, 1883);
    }

    #[test]
    fn test_parse_remote_url_mqtt_scheme() {
        let (host, port) = parse_remote_url("mqtt://broker.example.com:1883").unwrap();
        assert_eq!(host, "broker.example.com");
        assert_eq!(port, 1883);
    }

    #[test]
    fn test_parse_remote_url_tcp_scheme() {
        let (host, port) = parse_remote_url("tcp://192.168.1.1:1884").unwrap();
        assert_eq!(host, "192.168.1.1");
        assert_eq!(port, 1884);
    }

    #[test]
    fn test_parse_remote_url_invalid() {
        assert!(parse_remote_url("just-a-host").is_none());
    }
}
