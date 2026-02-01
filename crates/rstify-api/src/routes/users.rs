use axum::extract::{Path, State};
use axum::Json;
use rstify_auth::password::{hash_password, verify_password};
use rstify_core::models::{ChangePassword, CreateUser, UpdateUser, UserResponse};
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
    if req.new_password.len() < 8 || req.new_password.len() > 256 {
        return Err(ApiError::from(rstify_core::error::CoreError::Validation(
            "New password must be between 8 and 256 characters".to_string(),
        )));
    }

    let valid = verify_password(req.current_password, auth.user.password_hash.clone())
        .await
        .map_err(|_| {
            ApiError::from(rstify_core::error::CoreError::Internal(
                "Password verification error".to_string(),
            ))
        })?;

    if !valid {
        return Err(ApiError::from(rstify_core::error::CoreError::Unauthorized(
            "Current password is incorrect".to_string(),
        )));
    }

    let new_hash = hash_password(req.new_password).await.map_err(|e| {
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

    // Validate input
    let username = req.username.trim();
    if username.is_empty() || username.len() > 64 {
        return Err(ApiError::from(rstify_core::error::CoreError::Validation(
            "Username must be between 1 and 64 characters".to_string(),
        )));
    }
    if req.password.len() < 8 || req.password.len() > 256 {
        return Err(ApiError::from(rstify_core::error::CoreError::Validation(
            "Password must be between 8 and 256 characters".to_string(),
        )));
    }

    let password_hash = hash_password(req.password).await.map_err(|e| {
        ApiError::from(rstify_core::error::CoreError::Internal(format!(
            "Password hash error: {}",
            e
        )))
    })?;

    let user = state
        .user_repo
        .create(
            username,
            &password_hash,
            req.email.as_deref(),
            req.is_admin.unwrap_or(false),
        )
        .await
        .map_err(ApiError::from)?;

    Ok(Json(UserResponse::from(user)))
}

#[utoipa::path(
    put,
    path = "/user/{id}",
    request_body = UpdateUser,
    responses((status = 200, body = UserResponse))
)]
pub async fn update_user(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<i64>,
    Json(req): Json<UpdateUser>,
) -> Result<Json<UserResponse>, ApiError> {
    if !auth.user.is_admin {
        return Err(ApiError::from(rstify_core::error::CoreError::Forbidden(
            "Admin access required".to_string(),
        )));
    }

    let user = state
        .user_repo
        .update(
            id,
            req.username.as_deref(),
            req.email.as_deref(),
            req.is_admin,
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

    if id == auth.user.id {
        return Err(ApiError::from(rstify_core::error::CoreError::Validation(
            "Cannot delete your own account".to_string(),
        )));
    }

    state.user_repo.delete(id).await.map_err(ApiError::from)?;
    Ok(Json(serde_json::json!({"success": true})))
}
