use rstify_core::models::MessageResponse;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};

const CHANNEL_CAPACITY: usize = 256;
const GLOBAL_CHANNEL_CAPACITY: usize = 1024;

#[derive(Clone)]
pub struct ConnectionManager {
    /// Channels keyed by user ID for Gotify-compatible streaming
    user_channels: Arc<RwLock<HashMap<i64, broadcast::Sender<Arc<MessageResponse>>>>>,
    /// Channels keyed by topic name for ntfy-style topic subscriptions
    topic_channels: Arc<RwLock<HashMap<String, broadcast::Sender<Arc<MessageResponse>>>>>,
    /// Global channel for cross-protocol forwarding (e.g. to MQTT publisher)
    global_topic_tx: broadcast::Sender<Arc<MessageResponse>>,
}

impl Default for ConnectionManager {
    fn default() -> Self {
        Self::new()
    }
}

impl ConnectionManager {
    pub fn new() -> Self {
        let (global_topic_tx, _) = broadcast::channel(GLOBAL_CHANNEL_CAPACITY);
        Self {
            user_channels: Arc::new(RwLock::new(HashMap::new())),
            topic_channels: Arc::new(RwLock::new(HashMap::new())),
            global_topic_tx,
        }
    }

    /// Subscribe to ALL topic broadcasts (for cross-protocol forwarding like MQTT)
    pub fn subscribe_all_topics(&self) -> broadcast::Receiver<Arc<MessageResponse>> {
        self.global_topic_tx.subscribe()
    }

    /// Get the global topic sender (for MQTT ingest to broadcast without going through topic channels)
    pub fn global_topic_sender(&self) -> broadcast::Sender<Arc<MessageResponse>> {
        self.global_topic_tx.clone()
    }

    /// Count active connections (receivers) across all channels
    pub async fn active_count(&self) -> usize {
        let users = self.user_channels.read().await;
        let topics = self.topic_channels.read().await;
        let user_count: usize = users.values().map(|s| s.receiver_count()).sum();
        let topic_count: usize = topics.values().map(|s| s.receiver_count()).sum();
        user_count + topic_count
    }

    /// Subscribe to a user's message stream (Gotify /stream)
    pub async fn subscribe_user(&self, user_id: i64) -> broadcast::Receiver<Arc<MessageResponse>> {
        let mut channels = self.user_channels.write().await;
        let sender = channels
            .entry(user_id)
            .or_insert_with(|| broadcast::channel(CHANNEL_CAPACITY).0);
        sender.subscribe()
    }

    /// Subscribe to a topic's message stream
    pub async fn subscribe_topic(
        &self,
        topic_name: &str,
    ) -> broadcast::Receiver<Arc<MessageResponse>> {
        let mut channels = self.topic_channels.write().await;
        let sender = channels
            .entry(topic_name.to_string())
            .or_insert_with(|| broadcast::channel(CHANNEL_CAPACITY).0);
        sender.subscribe()
    }

    /// Broadcast a message to a user's subscribers
    pub async fn broadcast_to_user(&self, user_id: i64, msg: MessageResponse) {
        let channels = self.user_channels.read().await;
        if let Some(sender) = channels.get(&user_id) {
            let _ = sender.send(Arc::new(msg));
        }
    }

    /// Broadcast a message to a topic's subscribers and the global channel
    pub async fn broadcast_to_topic(&self, topic_name: &str, msg: MessageResponse) {
        let msg = Arc::new(msg);
        let channels = self.topic_channels.read().await;
        if let Some(sender) = channels.get(topic_name) {
            let _ = sender.send(msg.clone());
        }
        // Also send to global channel for cross-protocol forwarding (MQTT)
        let _ = self.global_topic_tx.send(msg);
    }

    /// Remove channels that have no active receivers to prevent memory leaks.
    /// Should be called periodically (e.g., from a background job).
    pub async fn cleanup_stale_channels(&self) {
        {
            let mut channels = self.user_channels.write().await;
            channels.retain(|_, sender| sender.receiver_count() > 0);
        }
        {
            let mut channels = self.topic_channels.write().await;
            channels.retain(|_, sender| sender.receiver_count() > 0);
        }
    }
}
