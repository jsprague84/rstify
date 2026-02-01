use axum::body::Bytes;
use axum::extract::{Query, State};
use axum::Json;
use rstify_core::models::{CreateUpRegistration, UpRegistration};
use serde::Deserialize;
use sqlx::SqlitePool;

use crate::error::ApiError;
use crate::extractors::auth::AuthUser;
use crate::state::AppState;

#[derive(Deserialize)]
pub struct UpTokenQuery {
    pub token: String,
}

/// POST /UP?token=<token> - Receive UnifiedPush message and distribute to registered device
#[utoipa::path(
    post,
    path = "/UP",
    request_body(content = String, description = "Push message content"),
    responses((status = 200))
)]
pub async fn receive_up_message(
    State(state): State<AppState>,
    Query(query): Query<UpTokenQuery>,
    body: Bytes,
) -> Result<Json<serde_json::Value>, ApiError> {
    let registration = find_registration(&state.pool, &query.token)
        .await
        .map_err(ApiError::from)?
        .ok_or_else(|| {
            ApiError::from(rstify_core::error::CoreError::NotFound(
                "UP registration not found".to_string(),
            ))
        })?;

    let message = String::from_utf8_lossy(&body).to_string();

    // Forward to the registered endpoint
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .unwrap_or_default();
    match client.post(&registration.endpoint).body(message).send().await {
        Ok(resp) => {
            tracing::debug!(
                "UP forwarded to {}: status {}",
                registration.endpoint,
                resp.status()
            );
        }
        Err(e) => {
            tracing::warn!("UP forward to {} failed: {}", registration.endpoint, e);
        }
    }

    Ok(Json(serde_json::json!({"success": true})))
}

/// POST /api/up/register - Register a UnifiedPush device
#[utoipa::path(
    post,
    path = "/api/up/register",
    request_body = CreateUpRegistration,
    responses((status = 201, body = UpRegistration))
)]
pub async fn register_up_device(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<CreateUpRegistration>,
) -> Result<Json<UpRegistration>, ApiError> {
    let token = uuid::Uuid::new_v4().to_string();

    let reg = sqlx::query_as::<_, UpRegistration>(
        "INSERT INTO up_registrations (token, user_id, endpoint) VALUES (?, ?, ?) RETURNING *",
    )
    .bind(&token)
    .bind(auth.user.id)
    .bind(&req.endpoint)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| ApiError::from(rstify_core::error::CoreError::Database(e.to_string())))?;

    Ok(Json(reg))
}

/// GET /api/up/registrations - List UP registrations for current user
#[utoipa::path(
    get,
    path = "/api/up/registrations",
    responses((status = 200, body = Vec<UpRegistration>))
)]
pub async fn list_up_registrations(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<UpRegistration>>, ApiError> {
    let regs = sqlx::query_as::<_, UpRegistration>(
        "SELECT * FROM up_registrations WHERE user_id = ? ORDER BY id",
    )
    .bind(auth.user.id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| ApiError::from(rstify_core::error::CoreError::Database(e.to_string())))?;

    Ok(Json(regs))
}

/// DELETE /api/up/registrations/{id} - Unregister a UP device
#[utoipa::path(
    delete,
    path = "/api/up/registrations/{id}",
    responses((status = 200))
)]
pub async fn delete_up_registration(
    State(state): State<AppState>,
    auth: AuthUser,
    axum::extract::Path(id): axum::extract::Path<i64>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let reg = sqlx::query_as::<_, UpRegistration>(
        "SELECT * FROM up_registrations WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| ApiError::from(rstify_core::error::CoreError::Database(e.to_string())))?
    .ok_or_else(|| {
        ApiError::from(rstify_core::error::CoreError::NotFound(
            "Registration not found".to_string(),
        ))
    })?;

    if reg.user_id != Some(auth.user.id) && !auth.user.is_admin {
        return Err(ApiError::from(rstify_core::error::CoreError::Forbidden(
            "Not your registration".to_string(),
        )));
    }

    sqlx::query("DELETE FROM up_registrations WHERE id = ?")
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(|e| ApiError::from(rstify_core::error::CoreError::Database(e.to_string())))?;

    Ok(Json(serde_json::json!({"success": true})))
}

async fn find_registration(
    pool: &SqlitePool,
    token: &str,
) -> Result<Option<UpRegistration>, rstify_core::error::CoreError> {
    sqlx::query_as::<_, UpRegistration>(
        "SELECT * FROM up_registrations WHERE token = ?",
    )
    .bind(token)
    .fetch_optional(pool)
    .await
    .map_err(|e| rstify_core::error::CoreError::Database(e.to_string()))
}
