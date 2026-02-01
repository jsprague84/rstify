use axum::extract::{Path, State};
use axum::Json;
use rstify_auth::password::{hash_password, verify_password};
use rstify_core::models::{ChangePassword, CreateUser, UserResponse};
use rstify_core::repositories::UserRepository;

use crate::error::ApiError;
use crate::extractors::auth::AuthUser;
use crate::state::AppState;

#[utoipa::path(get, path = "/current/user", responses((status = 200, body = UserResponse)))]
pub async fn current_user(auth: AuthUser) -> Result<Json<UserResponse>, ApiError> {
    Ok(Json(UserResponse::from(auth.user)))
}

#[utoipa::path(
    post,
    path = "/current/user/password",
    request_body = ChangePassword,
    responses((status = 200))
)]
pub async fn change_password(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<ChangePassword>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let valid = verify_password(&req.current_password, &auth.user.password_hash).map_err(|_| {
        ApiError::from(rstify_core::error::CoreError::Internal(
            "Password verification error".to_string(),
        ))
    })?;

    if !valid {
        return Err(ApiError::from(rstify_core::error::CoreError::Unauthorized(
            "Current password is incorrect".to_string(),
        )));
    }

    let new_hash = hash_password(&req.new_password).map_err(|e| {
        ApiError::from(rstify_core::error::CoreError::Internal(format!(
            "Password hash error: {}",
            e
        )))
    })?;

    state
        .user_repo
        .update_password(auth.user.id, &new_hash)
        .await
        .map_err(ApiError::from)?;

    Ok(Json(serde_json::json!({"success": true})))
}

#[utoipa::path(get, path = "/user", responses((status = 200, body = Vec<UserResponse>)))]
pub async fn list_users(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<UserResponse>>, ApiError> {
    if !auth.user.is_admin {
        return Err(ApiError::from(rstify_core::error::CoreError::Forbidden(
            "Admin access required".to_string(),
        )));
    }

    let users = state.user_repo.list_all().await.map_err(ApiError::from)?;
    Ok(Json(users.into_iter().map(UserResponse::from).collect()))
}

#[utoipa::path(
    post,
    path = "/user",
    request_body = CreateUser,
    responses((status = 201, body = UserResponse))
)]
pub async fn create_user(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<CreateUser>,
) -> Result<Json<UserResponse>, ApiError> {
    if !auth.user.is_admin {
        return Err(ApiError::from(rstify_core::error::CoreError::Forbidden(
            "Admin access required".to_string(),
        )));
    }

    let password_hash = hash_password(&req.password).map_err(|e| {
        ApiError::from(rstify_core::error::CoreError::Internal(format!(
            "Password hash error: {}",
            e
        )))
    })?;

    let user = state
        .user_repo
        .create(
            &req.username,
            &password_hash,
            req.email.as_deref(),
            req.is_admin.unwrap_or(false),
        )
        .await
        .map_err(ApiError::from)?;

    Ok(Json(UserResponse::from(user)))
}

#[utoipa::path(delete, path = "/user/{id}", responses((status = 200)))]
pub async fn delete_user(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<i64>,
) -> Result<Json<serde_json::Value>, ApiError> {
    if !auth.user.is_admin {
        return Err(ApiError::from(rstify_core::error::CoreError::Forbidden(
            "Admin access required".to_string(),
        )));
    }

    state.user_repo.delete(id).await.map_err(ApiError::from)?;
    Ok(Json(serde_json::json!({"success": true})))
}
