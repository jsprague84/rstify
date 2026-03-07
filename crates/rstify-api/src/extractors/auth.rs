use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use rstify_auth::tokens::{classify_token, validate_jwt, Claims, TokenType};
use rstify_core::models::{Application, Client, User};
use rstify_core::repositories::{ApplicationRepository, ClientRepository, UserRepository};
use serde_json::json;
use tracing::warn;

use crate::state::AppState;

/// Authenticated user from JWT or client token
pub struct AuthUser {
    pub user: User,
    pub claims: Option<Claims>,
    /// Present when auth'd via client token — use for scope checks
    pub client: Option<Client>,
}

impl AuthUser {
    /// Check if this auth context has a required scope.
    /// JWT users (no client) are unrestricted. Client tokens check scopes.
    pub fn has_scope(&self, scope: &str) -> bool {
        match &self.client {
            None => true, // JWT auth — full access
            Some(client) => client.has_scope(scope),
        }
    }

    /// Check if this auth context can access a specific app.
    pub fn can_access_app(&self, app_id: i64) -> bool {
        match &self.client {
            None => true,
            Some(client) => client.can_access_app(app_id),
        }
    }

    /// Return a Forbidden error if scope is missing
    pub fn require_scope(&self, scope: &str) -> Result<(), crate::error::ApiError> {
        if self.has_scope(scope) {
            Ok(())
        } else {
            Err(crate::error::ApiError::from(
                rstify_core::error::CoreError::Forbidden(format!(
                    "Token missing required scope: {}",
                    scope
                )),
            ))
        }
    }
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
        let uri = parts.uri.path().to_string();
        let token = extract_token(parts).ok_or_else(|| {
            warn!(path = %uri, "Auth rejected: no token provided");
            unauthorized("No authentication token provided")
        })?;

        match classify_token(&token) {
            TokenType::Jwt => {
                let claims = validate_jwt(&token, &state.jwt_secret).map_err(|_| {
                    warn!(path = %uri, "Auth rejected: invalid JWT");
                    unauthorized("Invalid JWT token")
                })?;
                let user = state
                    .user_repo
                    .find_by_id(claims.sub)
                    .await
                    .map_err(|_| internal_error())?
                    .ok_or_else(|| {
                        warn!(path = %uri, user_id = claims.sub, "Auth rejected: JWT user not found");
                        unauthorized("User not found")
                    })?;
                Ok(AuthUser {
                    user,
                    claims: Some(claims),
                    client: None,
                })
            }
            TokenType::ClientToken => {
                let client = state
                    .client_repo
                    .find_by_token(&token)
                    .await
                    .map_err(|_| internal_error())?
                    .ok_or_else(|| {
                        warn!(path = %uri, "Auth rejected: invalid client token");
                        unauthorized("Invalid client token")
                    })?;
                let user = state
                    .user_repo
                    .find_by_id(client.user_id)
                    .await
                    .map_err(|_| internal_error())?
                    .ok_or_else(|| unauthorized("User not found"))?;
                Ok(AuthUser {
                    user,
                    claims: None,
                    client: Some(client),
                })
            }
            _ => {
                warn!(path = %uri, "Auth rejected: invalid token type");
                Err(unauthorized("Invalid token type for this endpoint"))
            }
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
