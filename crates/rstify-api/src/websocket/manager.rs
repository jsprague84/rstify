use rstify_core::models::MessageResponse;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};

const CHANNEL_CAPACITY: usize = 256;

/// Global cap on concurrent stream connections (WS + SSE), to bound fd/memory use.
const MAX_TOTAL_CONNECTIONS: usize = 5000;
/// Per-user cap on concurrent Gotify /stream connections, so one account can't
/// monopolise the global budget.
const MAX_CONNECTIONS_PER_USER: usize = 50;

#[derive(Clone)]
pub struct ConnectionManager {
    /// Channels keyed by user ID for Gotify-compatible streaming
    user_channels: Arc<RwLock<HashMap<i64, broadcast::Sender<Arc<MessageResponse>>>>>,
    /// Channels keyed by topic name for ntfy-style topic subscriptions
    topic_channels: Arc<RwLock<HashMap<String, broadcast::Sender<Arc<MessageResponse>>>>>,
}

impl Default for ConnectionManager {
    fn default() -> Self {
        Self::new()
    }
}

impl ConnectionManager {
    pub fn new() -> Self {
        Self {
            user_channels: Arc::new(RwLock::new(HashMap::new())),
            topic_channels: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Count active connections (receivers) across all channels
    pub async fn active_count(&self) -> usize {
        let users = self.user_channels.read().await;
        let topics = self.topic_channels.read().await;
        let user_count: usize = users.values().map(|s| s.receiver_count()).sum();
        let topic_count: usize = topics.values().map(|s| s.receiver_count()).sum();
        user_count + topic_count
    }

    /// Whether a new stream connection can be accepted without exceeding the
    /// global cap (and, for a user stream, the per-user cap). Approximate under
    /// concurrency, which is fine for a DoS backstop.
    pub async fn can_accept(&self, user_id: Option<i64>) -> bool {
        if self.active_count().await >= MAX_TOTAL_CONNECTIONS {
            return false;
        }
        if let Some(uid) = user_id {
            let users = self.user_channels.read().await;
            if let Some(sender) = users.get(&uid) {
                if sender.receiver_count() >= MAX_CONNECTIONS_PER_USER {
                    return false;
                }
            }
        }
        true
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

    /// Broadcast a message to a topic's subscribers
    pub async fn broadcast_to_topic(&self, topic_name: &str, msg: MessageResponse) {
        let msg = Arc::new(msg);
        let channels = self.topic_channels.read().await;
        if let Some(sender) = channels.get(topic_name) {
            let _ = sender.send(msg);
        }
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

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn can_accept_under_caps_and_no_deadlock() {
        let cm = ConnectionManager::new();
        // Fresh manager: accepts both a user stream and a topic stream.
        assert!(cm.can_accept(None).await);
        assert!(cm.can_accept(Some(1)).await);
        // A single active subscription is well under the per-user cap; the nested
        // lock acquisition in can_accept must not deadlock.
        let _rx = cm.subscribe_user(1).await;
        assert!(cm.can_accept(Some(1)).await);
        assert_eq!(cm.active_count().await, 1);
    }
}
