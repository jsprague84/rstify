use bytes::Bytes;
use rstify_core::models::MessageResponse;
use rumqttd::local::LinkTx;
use std::sync::Arc;
use tokio::sync::broadcast;
use tracing::{debug, warn};

/// Run the MQTT publisher loop. Subscribes to the global topic broadcast
/// channel and forwards messages to MQTT subscribers on the embedded broker.
///
/// Skips messages that originated from MQTT (anti-loop protection).
///
/// This is a blocking function that should be run in a dedicated thread.
pub fn run_mqtt_publisher(
    mut link_tx: LinkTx,
    mut rx: broadcast::Receiver<Arc<MessageResponse>>,
) {
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .expect("Failed to create publisher tokio runtime");

    rt.block_on(async {
        loop {
            match rx.recv().await {
                Ok(msg) => {
                    // Anti-loop: skip messages that originated from MQTT
                    if msg.source.as_deref() == Some("mqtt") {
                        continue;
                    }

                    let mqtt_topic = match &msg.topic {
                        Some(topic) => topic.replace('.', "/"),
                        None => {
                            // App messages without a topic — publish under rstify/ prefix
                            if let Some(appid) = msg.appid {
                                format!("rstify/app/{}", appid)
                            } else {
                                continue;
                            }
                        }
                    };

                    let payload = match serde_json::to_vec(&*msg) {
                        Ok(p) => p,
                        Err(e) => {
                            warn!("Failed to serialize message for MQTT: {}", e);
                            continue;
                        }
                    };

                    let topic_bytes = Bytes::from(mqtt_topic.clone());
                    let payload_bytes = Bytes::from(payload);
                    match link_tx.publish(topic_bytes, payload_bytes) {
                        Ok(_) => {
                            debug!(topic = mqtt_topic, msg_id = msg.id, "Published to MQTT");
                        }
                        Err(e) => {
                            warn!(topic = mqtt_topic, "Failed to publish to MQTT: {:?}", e);
                        }
                    }
                }
                Err(broadcast::error::RecvError::Lagged(n)) => {
                    warn!("MQTT publisher lagged, skipped {} messages", n);
                }
                Err(broadcast::error::RecvError::Closed) => {
                    warn!("Global topic broadcast channel closed, MQTT publisher stopping");
                    break;
                }
            }
        }
    });
}
