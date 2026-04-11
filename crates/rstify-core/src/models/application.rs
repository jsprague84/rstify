use serde::{Deserialize, Serialize};
use ts_rs::TS;
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema, TS)]
#[ts(export)]
pub struct Application {
    pub id: i64,
    pub user_id: i64,
    pub name: String,
    pub description: Option<String>,
    pub token: String,
    pub default_priority: i32,
    pub image: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub retention_days: Option<i32>,
}

#[derive(Debug, Deserialize, ToSchema, TS)]
#[ts(export)]
pub struct CreateApplication {
    pub name: String,
    pub description: Option<String>,
    pub default_priority: Option<i32>,
}

#[derive(Debug, Deserialize, ToSchema, TS)]
#[ts(export)]
pub struct UpdateApplication {
    pub name: Option<String>,
    pub description: Option<String>,
    pub default_priority: Option<i32>,
    pub retention_days: Option<i32>,
}
