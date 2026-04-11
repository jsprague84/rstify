use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use ts_rs::TS;
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema, TS)]
#[ts(export)]
pub struct WebhookVariable {
    pub id: i64,
    pub user_id: i64,
    pub key: String,
    pub value: String,
    pub created_at: String,
}

#[derive(Debug, Deserialize, ToSchema, TS)]
#[ts(export)]
pub struct CreateWebhookVariable {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Deserialize, ToSchema, TS)]
#[ts(export)]
pub struct UpdateWebhookVariable {
    pub key: Option<String>,
    pub value: Option<String>,
}
