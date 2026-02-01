use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema)]
pub struct Topic {
    pub id: i64,
    pub name: String,
    pub owner_id: Option<i64>,
    pub description: Option<String>,
    pub everyone_read: bool,
    pub everyone_write: bool,
    pub created_at: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateTopic {
    pub name: String,
    pub description: Option<String>,
    pub everyone_read: Option<bool>,
    pub everyone_write: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema)]
pub struct TopicPermission {
    pub id: i64,
    pub user_id: i64,
    pub topic_pattern: String,
    pub can_read: bool,
    pub can_write: bool,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateTopicPermission {
    pub user_id: i64,
    pub topic_pattern: String,
    pub can_read: Option<bool>,
    pub can_write: Option<bool>,
}
