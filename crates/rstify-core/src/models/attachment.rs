use serde::{Deserialize, Serialize};
use ts_rs::TS;
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema, TS)]
#[ts(export)]
pub struct Attachment {
    pub id: i64,
    pub message_id: i64,
    pub filename: String,
    pub content_type: Option<String>,
    pub size_bytes: i64,
    pub storage_type: String,
    pub storage_path: String,
    #[serde(serialize_with = "crate::models::ser_utc_z_opt")]
    pub expires_at: Option<String>,
    #[serde(serialize_with = "crate::models::ser_utc_z")]
    pub created_at: String,
}
