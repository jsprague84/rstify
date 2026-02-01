use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema)]
pub struct Attachment {
    pub id: i64,
    pub message_id: i64,
    pub filename: String,
    pub content_type: Option<String>,
    pub size_bytes: i64,
    pub storage_type: String,
    pub storage_path: String,
    pub expires_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema)]
pub struct WebhookConfig {
    pub id: i64,
    pub user_id: i64,
    pub name: String,
    pub token: String,
    pub webhook_type: String,
    pub target_topic_id: Option<i64>,
    pub target_application_id: Option<i64>,
    pub template: String,
    pub enabled: bool,
    pub created_at: String,
    // Outgoing webhook fields
    pub direction: String,
    pub target_url: Option<String>,
    pub http_method: String,
    pub headers: Option<String>,
    pub body_template: Option<String>,
    pub max_retries: i32,
    pub retry_delay_secs: i32,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateWebhookConfig {
    pub name: String,
    pub webhook_type: String,
    pub target_topic_id: Option<i64>,
    pub target_application_id: Option<i64>,
    pub template: serde_json::Value,
    pub enabled: Option<bool>,
    // Outgoing webhook fields
    pub direction: Option<String>,
    pub target_url: Option<String>,
    pub http_method: Option<String>,
    pub headers: Option<serde_json::Value>,
    pub body_template: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateWebhookConfig {
    pub name: Option<String>,
    pub template: Option<serde_json::Value>,
    pub enabled: Option<bool>,
    // Outgoing webhook fields
    pub target_url: Option<String>,
    pub http_method: Option<String>,
    pub headers: Option<serde_json::Value>,
    pub body_template: Option<String>,
}
