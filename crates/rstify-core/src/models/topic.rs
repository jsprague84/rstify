use serde::{Deserialize, Serialize};
use ts_rs::TS;
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema, TS)]
#[ts(export)]
pub struct Topic {
    pub id: i64,
    pub name: String,
    pub owner_id: Option<i64>,
    pub description: Option<String>,
    pub everyone_read: bool,
    pub everyone_write: bool,
    pub created_at: String,
    pub notify_policy: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notify_priority_min: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notify_condition: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notify_digest_interval: Option<i32>,
    pub store_policy: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub store_interval: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub inbox_override: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub inbox_priority_min: Option<i32>,
}

#[derive(Debug, Deserialize, ToSchema, TS)]
#[ts(export)]
pub struct CreateTopic {
    pub name: String,
    pub description: Option<String>,
    pub everyone_read: Option<bool>,
    pub everyone_write: Option<bool>,
}

#[derive(Debug, Deserialize, ToSchema, TS)]
#[ts(export)]
pub struct UpdateTopic {
    pub description: Option<String>,
    pub everyone_read: Option<bool>,
    pub everyone_write: Option<bool>,
    pub notify_policy: Option<String>,
    pub notify_priority_min: Option<i32>,
    pub notify_condition: Option<String>,
    pub notify_digest_interval: Option<i32>,
    pub store_policy: Option<String>,
    pub store_interval: Option<i32>,
    pub inbox_override: Option<String>,
    pub inbox_priority_min: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema, TS)]
#[ts(export)]
pub struct TopicPermission {
    pub id: i64,
    pub user_id: i64,
    pub topic_pattern: String,
    pub can_read: bool,
    pub can_write: bool,
}

#[derive(Debug, Deserialize, ToSchema, TS)]
#[ts(export)]
pub struct CreateTopicPermission {
    pub user_id: i64,
    pub topic_pattern: String,
    pub can_read: Option<bool>,
    pub can_write: Option<bool>,
}
