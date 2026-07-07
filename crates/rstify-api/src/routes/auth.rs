use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;
use rstify_auth::password::{hash_password, verify_password};
use rstify_auth::tokens::create_jwt;
use rstify_core::repositories::UserRepository;
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;
use tokio::sync::OnceCell;
use tracing::{info, warn};
use ts_rs::TS;
use utoipa::ToSchema;

use crate::error::ApiError;
use crate::middleware::rate_limit::RateLimiter;
use crate::state::AppState;

/// Per-username login throttle: ~5 rapid failures, then one attempt per 5s.
/// Only failed attempts consume budget, so it never penalizes legitimate logins.
/// Keyed on username so it survives the global per-IP limiter being fronted by a
/// proxy, and works independently of it.
fn login_throttle() -> &'static RateLimiter {
    static THROTTLE: OnceLock<RateLimiter> = OnceLock::new();
    THROTTLE.get_or_init(|| RateLimiter::new(5, 0.2))
}

/// A valid Argon2 hash verified against on the unknown-user path so login timing
/// does not reveal whether a username exists.
async fn dummy_hash() -> String {
    static DUMMY: OnceCell<String> = OnceCell::const_new();
    DUMMY
        .get_or_init(|| async {
            hash_password("rstify-nonexistent-user-timing-guard".to_string())
                .await
                .unwrap_or_default()
        })
        .await
        .clone()
}

#[derive(Debug, Deserialize, ToSchema, TS)]
#[ts(export)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize, ToSchema, TS)]
#[ts(export)]
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
    // Throttle brute force per-username (only failures below consume budget).
    let username_key = req.username.to_lowercase();
    if !login_throttle().peek(&username_key).await {
        warn!(username = %req.username, "Login throttled: too many failed attempts");
        return Err(ApiError {
            status: StatusCode::TOO_MANY_REQUESTS,
            message: "Too many login attempts — please wait and try again".to_string(),
        });
    }

    let user = match state
        .user_repo
        .find_by_username(&req.username)
        .await
        .map_err(ApiError::from)?
    {
        Some(u) => u,
        None => {
            // Equalize timing with the wrong-password path (Argon2 verify).
            let _ = verify_password(req.password.clone(), dummy_hash().await).await;
            login_throttle().penalize(&username_key).await;
            warn!(username = %req.username, "Login failed: unknown username");
            return Err(ApiError::from(rstify_core::error::CoreError::Unauthorized(
                "Invalid credentials".to_string(),
            )));
        }
    };

    let valid = verify_password(req.password, user.password_hash.clone())
        .await
        .map_err(|_| {
            ApiError::from(rstify_core::error::CoreError::Internal(
                "Password verification error".to_string(),
            ))
        })?;

    if !valid {
        login_throttle().penalize(&username_key).await;
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
