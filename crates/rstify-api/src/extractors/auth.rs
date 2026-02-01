use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use rstify_auth::tokens::{classify_token, validate_jwt, Claims, TokenType};
use rstify_core::models::{Application, Client, User};
use rstify_core::repositories::{ApplicationRepository, ClientRepository, UserRepository};
use serde_json::json;

use crate::state::AppState;

/// Authenticated user from JWT or client token
pub struct AuthUser {
    pub user: User,
    pub claims: Option<Claims>,
}

/// Authenticated app (from app token)
pub struct AuthApp {
    pub application: Application,
    pub user: User,
}

/// Authenticated client (from client token)
pub struct AuthClient {
    pub client: Client,
    pub user: User,
}

fn extract_token(parts: &Parts) -> Option<String> {
    // 1. Authorization: Bearer <token>
    if let Some(auth) = parts.headers.get("authorization") {
        if let Ok(val) = auth.to_str() {
            if let Some(token) = val.strip_prefix("Bearer ") {
                return Some(token.to_string());
            }
        }
    }

    // 2. X-Gotify-Key header
    if let Some(key) = parts.headers.get("x-gotify-key") {
        if let Ok(val) = key.to_str() {
            return Some(val.to_string());
        }
    }

    // 3. ?token= query param
    if let Some(query) = parts.uri.query() {
        for param in query.split('&') {
            if let Some(token) = param.strip_prefix("token=") {
                return Some(token.to_string());
            }
        }
    }

    None
}

fn unauthorized(msg: &str) -> Response {
    (StatusCode::UNAUTHORIZED, Json(json!({"error": msg}))).into_response()
}

fn internal_error() -> Response {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({"error": "Internal error"})),
    )
        .into_response()
}

impl FromRequestParts<AppState> for AuthUser {
    type Rejection = Response;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let token =
            extract_token(parts).ok_or_else(|| unauthorized("No authentication token provided"))?;

        match classify_token(&token) {
            TokenType::Jwt => {
                let claims = validate_jwt(&token, &state.jwt_secret)
                    .map_err(|_| unauthorized("Invalid JWT token"))?;
                let user = state
                    .user_repo
                    .find_by_id(claims.sub)
                    .await
                    .map_err(|_| internal_error())?
                    .ok_or_else(|| unauthorized("User not found"))?;
                Ok(AuthUser {
                    user,
                    claims: Some(claims),
                })
            }
            TokenType::ClientToken => {
                let client = state
                    .client_repo
                    .find_by_token(&token)
                    .await
                    .map_err(|_| internal_error())?
                    .ok_or_else(|| unauthorized("Invalid client token"))?;
                let user = state
                    .user_repo
                    .find_by_id(client.user_id)
                    .await
                    .map_err(|_| internal_error())?
                    .ok_or_else(|| unauthorized("User not found"))?;
                Ok(AuthUser { user, claims: None })
            }
            _ => Err(unauthorized("Invalid token type for this endpoint")),
        }
    }
}

impl FromRequestParts<AppState> for AuthApp {
    type Rejection = Response;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let token =
            extract_token(parts).ok_or_else(|| unauthorized("No authentication token provided"))?;

        let application = state
            .app_repo
            .find_by_token(&token)
            .await
            .map_err(|_| internal_error())?
            .ok_or_else(|| unauthorized("Invalid application token"))?;

        let user = state
            .user_repo
            .find_by_id(application.user_id)
            .await
            .map_err(|_| internal_error())?
            .ok_or_else(|| unauthorized("User not found"))?;

        Ok(AuthApp { application, user })
    }
}

impl FromRequestParts<AppState> for AuthClient {
    type Rejection = Response;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let token =
            extract_token(parts).ok_or_else(|| unauthorized("No authentication token provided"))?;

        let client = state
            .client_repo
            .find_by_token(&token)
            .await
            .map_err(|_| internal_error())?
            .ok_or_else(|| unauthorized("Invalid client token"))?;

        let user = state
            .user_repo
            .find_by_id(client.user_id)
            .await
            .map_err(|_| internal_error())?
            .ok_or_else(|| unauthorized("User not found"))?;

        Ok(AuthClient { client, user })
    }
}
