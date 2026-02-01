use axum::extract::{Path, State};
use axum::Json;
use rstify_auth::tokens::generate_app_token;
use rstify_core::models::{Application, CreateApplication, UpdateApplication};
use rstify_core::repositories::ApplicationRepository;

use crate::error::ApiError;
use crate::extractors::auth::AuthUser;
use crate::state::AppState;

#[utoipa::path(get, path = "/application", responses((status = 200, body = Vec<Application>)))]
pub async fn list_applications(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<Application>>, ApiError> {
    let apps = state
        .app_repo
        .list_by_user(auth.user.id)
        .await
        .map_err(ApiError::from)?;
    Ok(Json(apps))
}

#[utoipa::path(
    post,
    path = "/application",
    request_body = CreateApplication,
    responses((status = 201, body = Application))
)]
pub async fn create_application(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<CreateApplication>,
) -> Result<Json<Application>, ApiError> {
    let token = generate_app_token();
    let app = state
        .app_repo
        .create(
            auth.user.id,
            &req.name,
            req.description.as_deref(),
            &token,
            req.default_priority.unwrap_or(5),
        )
        .await
        .map_err(ApiError::from)?;
    Ok(Json(app))
}

#[utoipa::path(
    put,
    path = "/application/{id}",
    request_body = UpdateApplication,
    responses((status = 200, body = Application))
)]
pub async fn update_application(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<i64>,
    Json(req): Json<UpdateApplication>,
) -> Result<Json<Application>, ApiError> {
    // Verify ownership
    let existing = state
        .app_repo
        .find_by_id(id)
        .await
        .map_err(ApiError::from)?
        .ok_or_else(|| {
            ApiError::from(rstify_core::error::CoreError::NotFound(
                "Application not found".to_string(),
            ))
        })?;

    if existing.user_id != auth.user.id && !auth.user.is_admin {
        return Err(ApiError::from(rstify_core::error::CoreError::Forbidden(
            "Not your application".to_string(),
        )));
    }

    let app = state
        .app_repo
        .update(
            id,
            req.name.as_deref(),
            req.description.as_deref(),
            req.default_priority,
        )
        .await
        .map_err(ApiError::from)?;
    Ok(Json(app))
}

#[utoipa::path(delete, path = "/application/{id}", responses((status = 200)))]
pub async fn delete_application(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<i64>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let existing = state
        .app_repo
        .find_by_id(id)
        .await
        .map_err(ApiError::from)?
        .ok_or_else(|| {
            ApiError::from(rstify_core::error::CoreError::NotFound(
                "Application not found".to_string(),
            ))
        })?;

    if existing.user_id != auth.user.id && !auth.user.is_admin {
        return Err(ApiError::from(rstify_core::error::CoreError::Forbidden(
            "Not your application".to_string(),
        )));
    }

    state
        .app_repo
        .delete(id)
        .await
        .map_err(ApiError::from)?;
    Ok(Json(serde_json::json!({"success": true})))
}
