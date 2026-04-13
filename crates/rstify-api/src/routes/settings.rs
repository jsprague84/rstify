use axum::extract::{Path, State};
use axum::Json;
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use utoipa::ToSchema;

use crate::error::ApiError;
use crate::extractors::auth::AuthUser;
use crate::state::AppState;
use rstify_core::error::CoreError;

#[derive(Debug, Serialize, ToSchema, TS)]
#[ts(export)]
pub struct Setting {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Deserialize, ToSchema, TS)]
#[ts(export)]
pub struct UpdateSetting {
    pub value: String,
}

#[utoipa::path(get, path = "/api/settings", responses((status = 200, body = Vec<Setting>)))]
pub async fn list_settings(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<Setting>>, ApiError> {
    auth.require_admin()?;
    let rows: Vec<(String, String)> = sqlx::query_as("SELECT key, value FROM settings")
        .fetch_all(&state.pool)
        .await
        .map_err(|e| ApiError::from(CoreError::Database(e.to_string())))?;
    let settings = rows
        .into_iter()
        .map(|(key, value)| Setting { key, value })
        .collect();
    Ok(Json(settings))
}

#[utoipa::path(
    put,
    path = "/api/settings/{key}",
    request_body = UpdateSetting,
    responses((status = 200, body = Setting))
)]
pub async fn update_setting(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(key): Path<String>,
    Json(req): Json<UpdateSetting>,
) -> Result<Json<Setting>, ApiError> {
    auth.require_admin()?;
    sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
        .bind(&key)
        .bind(&req.value)
        .execute(&state.pool)
        .await
        .map_err(|e| ApiError::from(CoreError::Database(e.to_string())))?;

    // Update in-memory cache
    if key == "inbox_priority_threshold" {
        if let Ok(v) = req.value.parse::<i32>() {
            state
                .inbox_threshold
                .store(v, std::sync::atomic::Ordering::Relaxed);
        }
    }

    Ok(Json(Setting {
        key,
        value: req.value,
    }))
}
