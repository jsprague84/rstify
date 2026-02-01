use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema)]
pub struct UpRegistration {
    pub id: i64,
    pub token: String,
    pub user_id: Option<i64>,
    pub endpoint: String,
    pub created_at: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateUpRegistration {
    pub endpoint: String,
}
