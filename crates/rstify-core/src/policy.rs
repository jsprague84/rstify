use crate::models::{MessageResponse, Topic};

/// Evaluate whether a notification should be sent for a message on a given topic.
pub fn should_notify(topic: &Topic, msg: &MessageResponse) -> bool {
    match topic.notify_policy.as_str() {
        "always" => true,
        "never" => false,
        "threshold" => {
            let min = topic.notify_priority_min.unwrap_or(0);
            msg.priority >= min
        }
        // on_change and digest require state tracking — default to true for v1
        "on_change" | "digest" => true,
        _ => true,
    }
}

/// Evaluate whether a message should be stored based on topic storage policy.
pub fn should_store(
    topic: &Topic,
    last_stored_body: Option<&str>,
    elapsed_secs: Option<i64>,
) -> bool {
    match topic.store_policy.as_str() {
        "all" => true,
        "on_change" => match last_stored_body {
            Some(_prev) => false, // caller checks equality before calling
            None => true,
        },
        "interval" => {
            let interval = topic.store_interval.unwrap_or(0) as i64;
            match elapsed_secs {
                Some(elapsed) => elapsed >= interval,
                None => true,
            }
        }
        _ => true,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_topic(
        notify_policy: &str,
        priority_min: Option<i32>,
        store_policy: &str,
        store_interval: Option<i32>,
    ) -> Topic {
        Topic {
            id: 1,
            name: "test".to_string(),
            owner_id: None,
            description: None,
            everyone_read: true,
            everyone_write: true,
            created_at: "2024-01-01".to_string(),
            notify_policy: notify_policy.to_string(),
            notify_priority_min: priority_min,
            notify_condition: None,
            notify_digest_interval: None,
            store_policy: store_policy.to_string(),
            store_interval,
        }
    }

    fn make_msg(priority: i32) -> MessageResponse {
        MessageResponse {
            id: 1,
            appid: None,
            topic: Some("test".to_string()),
            message: "test message".to_string(),
            title: None,
            priority,
            tags: None,
            click_url: None,
            icon_url: None,
            actions: None,
            extras: None,
            content_type: None,
            source: None,
            attachments: None,
            date: "2024-01-01".to_string(),
        }
    }

    #[test]
    fn test_notify_always() {
        let topic = make_topic("always", None, "all", None);
        let msg = make_msg(1);
        assert!(should_notify(&topic, &msg));
    }

    #[test]
    fn test_notify_never() {
        let topic = make_topic("never", None, "all", None);
        let msg = make_msg(10);
        assert!(!should_notify(&topic, &msg));
    }

    #[test]
    fn test_notify_threshold_above() {
        let topic = make_topic("threshold", Some(5), "all", None);
        let msg = make_msg(7);
        assert!(should_notify(&topic, &msg));
    }

    #[test]
    fn test_notify_threshold_below() {
        let topic = make_topic("threshold", Some(5), "all", None);
        let msg = make_msg(3);
        assert!(!should_notify(&topic, &msg));
    }

    #[test]
    fn test_notify_threshold_equal() {
        let topic = make_topic("threshold", Some(5), "all", None);
        let msg = make_msg(5);
        assert!(should_notify(&topic, &msg));
    }

    #[test]
    fn test_store_all() {
        let topic = make_topic("always", None, "all", None);
        assert!(should_store(&topic, None, None));
    }

    #[test]
    fn test_store_interval_elapsed() {
        let topic = make_topic("always", None, "interval", Some(60));
        assert!(should_store(&topic, None, Some(120)));
    }

    #[test]
    fn test_store_interval_not_elapsed() {
        let topic = make_topic("always", None, "interval", Some(60));
        assert!(!should_store(&topic, None, Some(30)));
    }

    #[test]
    fn test_store_on_change_first_message() {
        let topic = make_topic("always", None, "on_change", None);
        assert!(should_store(&topic, None, None));
    }

    #[test]
    fn test_store_on_change_same() {
        let topic = make_topic("always", None, "on_change", None);
        assert!(!should_store(&topic, Some("same body"), None));
    }
}
