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
    pub timeout_secs: i32,
    pub follow_redirects: bool,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateWebhookConfig {
    pub name: String,
    #[serde(alias = "webhook_type")]
    pub webhook_type: String,
    #[serde(alias = "target_topic_id")]
    pub target_topic_id: Option<i64>,
    #[serde(alias = "target_application_id")]
    pub target_application_id: Option<i64>,
    pub template: Option<serde_json::Value>,
    pub enabled: Option<bool>,
    // Outgoing webhook fields
    pub direction: Option<String>,
    #[serde(alias = "target_url")]
    pub target_url: Option<String>,
    #[serde(alias = "http_method")]
    pub http_method: Option<String>,
    pub headers: Option<serde_json::Value>,
    #[serde(alias = "body_template")]
    pub body_template: Option<String>,
    #[serde(alias = "timeout_secs")]
    pub timeout_secs: Option<i32>,
    #[serde(alias = "follow_redirects")]
    pub follow_redirects: Option<bool>,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateWebhookConfig {
    pub name: Option<String>,
    pub template: Option<serde_json::Value>,
    pub enabled: Option<bool>,
    // Outgoing webhook fields
    #[serde(alias = "target_url")]
    pub target_url: Option<String>,
    #[serde(alias = "http_method")]
    pub http_method: Option<String>,
    pub headers: Option<serde_json::Value>,
    #[serde(alias = "body_template")]
    pub body_template: Option<String>,
    #[serde(alias = "max_retries")]
    pub max_retries: Option<i32>,
    #[serde(alias = "retry_delay_secs")]
    pub retry_delay_secs: Option<i32>,
    #[serde(alias = "timeout_secs")]
    pub timeout_secs: Option<i32>,
    #[serde(alias = "follow_redirects")]
    pub follow_redirects: Option<bool>,
}
