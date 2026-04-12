use serde::{Deserialize, Serialize};
use ts_rs::TS;
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema, TS)]
#[ts(export)]
pub struct MqttBridge {
    pub id: i64,
    pub user_id: i64,
    pub name: String,
    pub remote_url: String,
    pub subscribe_topics: String,
    pub publish_topics: Option<String>,
    #[serde(skip_serializing)]
    pub username: Option<String>,
    #[serde(skip_serializing)]
    pub password: Option<String>,
    pub qos: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub topic_prefix: Option<String>,
    pub auto_create_topics: bool,
    pub enabled: bool,
    pub created_at: String,
}

#[derive(Debug, Deserialize, ToSchema, TS)]
#[ts(export)]
pub struct CreateMqttBridge {
    pub name: String,
    pub remote_url: String,
    pub subscribe_topics: Vec<String>,
    #[serde(default)]
    pub publish_topics: Vec<String>,
    pub username: Option<String>,
    pub password: Option<String>,
    pub qos: Option<i32>,
    pub topic_prefix: Option<String>,
    pub auto_create_topics: Option<bool>,
}

#[derive(Debug, Deserialize, ToSchema, TS)]
#[ts(export)]
pub struct UpdateMqttBridge {
    pub name: Option<String>,
    pub remote_url: Option<String>,
    pub subscribe_topics: Option<Vec<String>>,
    pub publish_topics: Option<Vec<String>>,
    pub username: Option<String>,
    pub password: Option<String>,
    pub qos: Option<i32>,
    pub topic_prefix: Option<String>,
    pub auto_create_topics: Option<bool>,
    pub enabled: Option<bool>,
}
