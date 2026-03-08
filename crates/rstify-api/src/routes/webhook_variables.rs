use axum::extract::{Path, State};
use axum::Json;
use rstify_core::models::{CreateWebhookVariable, UpdateWebhookVariable, WebhookVariable};
use rstify_core::repositories::WebhookVariableRepository;

use crate::error::ApiError;
use crate::extractors::auth::AuthUser;
use crate::state::AppState;

/// GET /api/webhook-variables
#[utoipa::path(get, path = "/api/webhook-variables", responses((status = 200, body = Vec<WebhookVariable>)))]
pub async fn list_variables(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<WebhookVariable>>, ApiError> {
    let vars = state
        .webhook_variable_repo
        .list_webhook_variables(auth.user.id)
        .await
        .map_err(ApiError::from)?;
    Ok(Json(vars))
}

/// POST /api/webhook-variables
#[utoipa::path(post, path = "/api/webhook-variables", request_body = CreateWebhookVariable, responses((status = 201, body = WebhookVariable)))]
pub async fn create_variable(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<CreateWebhookVariable>,
) -> Result<Json<WebhookVariable>, ApiError> {
    if req.key.is_empty() || req.key.len() > 64 {
        return Err(ApiError::from(rstify_core::error::CoreError::Validation(
            "Key must be 1-64 characters".to_string(),
        )));
    }
    let var = state
        .webhook_variable_repo
        .create_webhook_variable(auth.user.id, &req.key, &req.value)
        .await
        .map_err(ApiError::from)?;
    Ok(Json(var))
}

/// PUT /api/webhook-variables/{id}
#[utoipa::path(put, path = "/api/webhook-variables/{id}", request_body = UpdateWebhookVariable, responses((status = 200, body = WebhookVariable)))]
pub async fn update_variable(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<i64>,
    Json(req): Json<UpdateWebhookVariable>,
) -> Result<Json<WebhookVariable>, ApiError> {
    // Verify ownership
    let vars = state
        .webhook_variable_repo
        .list_webhook_variables(auth.user.id)
        .await
        .map_err(ApiError::from)?;
    if !vars.iter().any(|v| v.id == id) {
        return Err(ApiError::from(rstify_core::error::CoreError::NotFound(
            "Variable not found".to_string(),
        )));
    }

    let var = state
        .webhook_variable_repo
        .update_webhook_variable(id, req.key.as_deref(), req.value.as_deref())
        .await
        .map_err(ApiError::from)?;
    Ok(Json(var))
}

/// DELETE /api/webhook-variables/{id}
#[utoipa::path(delete, path = "/api/webhook-variables/{id}", responses((status = 204)))]
pub async fn delete_variable(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<i64>,
) -> Result<Json<()>, ApiError> {
    // Verify ownership
    let vars = state
        .webhook_variable_repo
        .list_webhook_variables(auth.user.id)
        .await
        .map_err(ApiError::from)?;
    if !vars.iter().any(|v| v.id == id) {
        return Err(ApiError::from(rstify_core::error::CoreError::NotFound(
            "Variable not found".to_string(),
        )));
    }

    state
        .webhook_variable_repo
        .delete_webhook_variable(id)
        .await
        .map_err(ApiError::from)?;
    Ok(Json(()))
}
