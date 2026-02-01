use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema)]
pub struct Client {
    pub id: i64,
    pub user_id: i64,
    pub name: String,
    pub token: String,
    pub created_at: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateClient {
    pub name: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateClient {
    pub name: Option<String>,
}
