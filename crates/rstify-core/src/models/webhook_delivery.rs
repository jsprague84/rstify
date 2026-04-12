use serde::{Deserialize, Serialize};
use ts_rs::TS;
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema, TS)]
#[ts(export)]
pub struct WebhookDeliveryLog {
    pub id: i64,
    pub webhook_config_id: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status_code: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub response_body_preview: Option<String>,
    pub duration_ms: i64,
    pub attempted_at: String,
    pub success: bool,
}
