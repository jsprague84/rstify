use axum::extract::{Path, State};
use axum::Json;
use rstify_core::models::{CreateTopicPermission, TopicPermission};
use rstify_core::repositories::TopicRepository;

use crate::error::ApiError;
use crate::extractors::auth::AuthUser;
use crate::state::AppState;

#[utoipa::path(
    post,
    path = "/api/permissions",
    request_body = CreateTopicPermission,
    responses((status = 201, body = TopicPermission))
)]
pub async fn create_permission(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<CreateTopicPermission>,
) -> Result<Json<TopicPermission>, ApiError> {
    if !auth.user.is_admin {
        return Err(ApiError::from(rstify_core::error::CoreError::Forbidden(
            "Admin access required".to_string(),
        )));
    }

    let perm = state
        .topic_repo
        .create_permission(
            req.user_id,
            &req.topic_pattern,
            req.can_read.unwrap_or(false),
            req.can_write.unwrap_or(false),
        )
        .await
        .map_err(ApiError::from)?;
    Ok(Json(perm))
}

#[utoipa::path(get, path = "/api/permissions", responses((status = 200, body = Vec<TopicPermission>)))]
pub async fn list_permissions(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<TopicPermission>>, ApiError> {
    let perms = if auth.user.is_admin {
        state
            .topic_repo
            .list_all_permissions()
            .await
            .map_err(ApiError::from)?
    } else {
        state
            .topic_repo
            .list_permissions_for_user(auth.user.id)
            .await
            .map_err(ApiError::from)?
    };
    Ok(Json(perms))
}

#[utoipa::path(delete, path = "/api/permissions/{id}", responses((status = 200)))]
pub async fn delete_permission(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<i64>,
) -> Result<Json<serde_json::Value>, ApiError> {
    if !auth.user.is_admin {
        return Err(ApiError::from(rstify_core::error::CoreError::Forbidden(
            "Admin access required".to_string(),
        )));
    }

    state
        .topic_repo
        .delete_permission(id)
        .await
        .map_err(ApiError::from)?;
    Ok(Json(serde_json::json!({"success": true})))
}
