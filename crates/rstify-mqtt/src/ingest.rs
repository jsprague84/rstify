use rstify_core::models::MessageResponse;
use rstify_core::repositories::{MessageRepository, TopicRepository};
use rstify_db::repositories::message::SqliteMessageRepo;
use rstify_db::repositories::topic::SqliteTopicRepo;
use rumqttd::local::LinkRx;
use rumqttd::Notification;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::broadcast;
use tracing::{debug, error, warn};

/// Parse an MQTT payload into (title, message, priority).
///
/// Strategy:
/// 1. JSON with rstify fields (title, message, priority) -> extract
/// 2. Plain JSON -> use as message body, derive title from topic
/// 3. Plain text -> use as message body
pub fn parse_mqtt_payload(payload: &[u8], topic_name: &str) -> (Option<String>, String, i32) {
    let text = match std::str::from_utf8(payload) {
        Ok(s) => s.to_string(),
        Err(_) => {
            return (
                Some(topic_name.to_string()),
                format!("[binary payload: {} bytes]", payload.len()),
                5,
            );
        }
    };

    // Try JSON with rstify fields
    if let Ok(val) = serde_json::from_str::<serde_json::Value>(&text) {
        if val.is_object() {
            let obj = val.as_object().unwrap();
            if obj.contains_key("message") {
                let title = obj
                    .get("title")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                let message = obj
                    .get("message")
                    .and_then(|v| v.as_str())
                    .unwrap_or(&text)
                    .to_string();
                let priority = obj.get("priority").and_then(|v| v.as_i64()).unwrap_or(5) as i32;
                return (title, message, priority);
            }
            // Plain JSON object — use the whole thing as message
            return (Some(topic_name.to_string()), text, 5);
        }
    }

    // Plain text
    (None, text, 5)
}

/// Run the MQTT ingest loop. Receives all MQTT publishes via link_rx
/// and creates rstify messages.
///
/// This is a blocking function that should be run in a dedicated thread.
pub fn run_mqtt_ingest(
    mut link_rx: LinkRx,
    topic_repo: SqliteTopicRepo,
    message_repo: SqliteMessageRepo,
    topic_broadcast: broadcast::Sender<Arc<MessageResponse>>,
    pool: sqlx::SqlitePool,
) {
    // Create a tokio runtime for async DB operations within this blocking thread
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .expect("Failed to create ingest tokio runtime");

    // Track last stored time and body per topic for store policy evaluation
    let mut last_stored: HashMap<i64, (Instant, String)> = HashMap::new();

    loop {
        match link_rx.recv() {
            Ok(Some(Notification::Forward(forward))) => {
                let mqtt_topic = String::from_utf8_lossy(&forward.publish.topic).to_string();
                let payload = forward.publish.payload.to_vec();

                // Skip internal rstify topics (anti-loop: these are our own publishes)
                if mqtt_topic.starts_with("rstify/") {
                    continue;
                }

                // Anti-loop: skip messages that were published to MQTT by rstify itself
                // (e.g., webhook-received messages broadcast to MQTT via the publisher)
                if let Ok(val) = serde_json::from_slice::<serde_json::Value>(&payload) {
                    if let Some(source) = val.get("source").and_then(|s| s.as_str()) {
                        if source == "webhook" || source == "api" {
                            continue;
                        }
                    }
                }

                let topic_name = mqtt_topic.replace('/', ".");
                let (title, message, priority) = parse_mqtt_payload(&payload, &topic_name);

                let topic_repo = topic_repo.clone();
                let message_repo = message_repo.clone();
                let topic_broadcast = topic_broadcast.clone();
                let pool = pool.clone();

                rt.block_on(async {
                    // Find or create the rstify topic
                    let topic = match topic_repo.find_by_name(&topic_name).await {
                        Ok(Some(t)) => t,
                        Ok(None) => {
                            match topic_repo
                                .create(&topic_name, None, None, true, false)
                                .await
                            {
                                Ok(t) => {
                                    debug!(topic = topic_name, "Auto-created topic from MQTT");
                                    t
                                }
                                Err(e) => {
                                    error!(topic = topic_name, error = %e, "Failed to create topic");
                                    return;
                                }
                            }
                        }
                        Err(e) => {
                            error!(topic = topic_name, error = %e, "Failed to look up topic");
                            return;
                        }
                    };

                    // Check store policy — determine if we should persist to DB
                    let elapsed_secs = last_stored
                        .get(&topic.id)
                        .map(|(instant, _)| instant.elapsed().as_secs() as i64);
                    let last_body = last_stored
                        .get(&topic.id)
                        .map(|(_, body)| body.as_str());
                    let should_store = rstify_core::policy::should_store(
                        &topic,
                        // For on_change: pass last body only if current message differs
                        if last_body == Some(&message) {
                            last_body
                        } else {
                            None
                        },
                        elapsed_secs,
                    );

                    if should_store {
                        // Load inbox threshold from DB and evaluate
                        let threshold: i32 = sqlx::query_scalar(
                            "SELECT CAST(value AS INTEGER) FROM settings WHERE key = 'inbox_priority_threshold'",
                        )
                        .fetch_optional(&pool)
                        .await
                        .ok()
                        .flatten()
                        .unwrap_or(5);
                        let inbox = rstify_core::policy::should_inbox(&topic, priority, threshold);

                        // Create rstify message in DB
                        let msg = match message_repo
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
                            Ok(m) => m,
                            Err(e) => {
                                error!(topic = topic_name, error = %e, "Failed to create message from MQTT");
                                return;
                            }
                        };

                        let response = msg.to_response(Some(topic_name.clone()));

                        // Update store tracking
                        last_stored.insert(topic.id, (Instant::now(), message.clone()));

                        // Broadcast to WebSocket subscribers via the global channel
                        let _ = topic_broadcast.send(Arc::new(response.clone()));

                        // Fire outgoing webhooks
                        let pool = pool.clone();
                        let topic = topic_name.clone();
                        tokio::spawn(async move {
                            rstify_jobs::outgoing_webhooks::fire_outgoing_webhooks(
                                &pool, &topic, &response,
                            )
                            .await;
                        });
                    } else {
                        // Still broadcast to WebSocket for live view, but don't store
                        let response = rstify_core::models::MessageResponse {
                            id: 0,
                            appid: None,
                            topic: Some(topic_name.clone()),
                            title,
                            message: message.clone(),
                            priority,
                            tags: None,
                            click_url: None,
                            icon_url: None,
                            actions: None,
                            extras: None,
                            content_type: None,
                            source: Some("mqtt".to_string()),
                            inbox: false,
                            attachments: None,
                            date: chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string(),
                        };
                        let _ = topic_broadcast.send(Arc::new(response));
                    }
                });
            }
            Ok(Some(_)) => {
                // Other notification types (Unschedule, etc.) — ignore
            }
            Ok(None) => continue,
            Err(e) => {
                warn!("MQTT link_rx error: {:?}", e);
                break;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_rstify_json() {
        let payload = br#"{"title": "Alert", "message": "Server down", "priority": 8}"#;
        let (title, msg, pri) = parse_mqtt_payload(payload, "test");
        assert_eq!(title.unwrap(), "Alert");
        assert_eq!(msg, "Server down");
        assert_eq!(pri, 8);
    }

    #[test]
    fn test_parse_plain_json() {
        let payload = br#"{"temperature": 22.5, "humidity": 65}"#;
        let (title, msg, pri) = parse_mqtt_payload(payload, "sensors.temp");
        assert_eq!(title.unwrap(), "sensors.temp");
        assert!(msg.contains("temperature"));
        assert_eq!(pri, 5);
    }

    #[test]
    fn test_parse_plain_text() {
        let payload = b"Server backup complete";
        let (title, msg, pri) = parse_mqtt_payload(payload, "alerts");
        assert!(title.is_none());
        assert_eq!(msg, "Server backup complete");
        assert_eq!(pri, 5);
    }

    #[test]
    fn test_parse_binary() {
        let payload = &[0xFF, 0xFE, 0x00, 0x01];
        let (title, msg, _) = parse_mqtt_payload(payload, "binary.topic");
        assert_eq!(title.unwrap(), "binary.topic");
        assert!(msg.contains("binary payload"));
    }
}
