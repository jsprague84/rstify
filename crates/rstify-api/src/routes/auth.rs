use axum::extract::State;
use axum::Json;
use rstify_auth::password::verify_password;
use rstify_auth::tokens::create_jwt;
use rstify_core::repositories::UserRepository;
use serde::{Deserialize, Serialize};
use tracing::{info, warn};
use utoipa::ToSchema;

use crate::error::ApiError;
use crate::state::AppState;

#[derive(Debug, Deserialize, ToSchema)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct LoginResponse {
    pub token: String,
}

#[utoipa::path(
    post,
    path = "/api/auth/login",
    request_body = LoginRequest,
    responses((status = 200, body = LoginResponse))
)]
pub async fn login(
    State(state): State<AppState>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, ApiError> {
    let user = state
        .user_repo
        .find_by_username(&req.username)
        .await
        .map_err(ApiError::from)?
        .ok_or_else(|| {
            warn!(username = %req.username, "Login failed: unknown username");
            ApiError::from(rstify_core::error::CoreError::Unauthorized(
                "Invalid credentials".to_string(),
            ))
        })?;

    let valid = verify_password(req.password, user.password_hash.clone())
        .await
        .map_err(|_| {
            ApiError::from(rstify_core::error::CoreError::Internal(
                "Password verification error".to_string(),
            ))
        })?;

    if !valid {
        warn!(username = %req.username, "Login failed: wrong password");
        return Err(ApiError::from(rstify_core::error::CoreError::Unauthorized(
            "Invalid credentials".to_string(),
        )));
    }

    let token =
        create_jwt(user.id, &user.username, user.is_admin, &state.jwt_secret).map_err(|e| {
            ApiError::from(rstify_core::error::CoreError::Internal(format!(
                "Token creation error: {}",
                e
            )))
        })?;

    info!(username = %req.username, user_id = user.id, "Login successful");
    Ok(Json(LoginResponse { token }))
}
