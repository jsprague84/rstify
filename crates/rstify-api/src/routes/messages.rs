use axum::extract::{Path, Query, State, WebSocketUpgrade};
use axum::response::IntoResponse;
use axum::Json;
use rstify_core::models::{CreateAppMessage, MessageResponse, PagedMessages, Paging};
use rstify_core::repositories::{ApplicationRepository, ClientRepository, MessageRepository};
use serde::Deserialize;

use crate::error::ApiError;
use crate::extractors::auth::{AuthApp, AuthUser};
use crate::state::AppState;

#[derive(Deserialize)]
pub struct ListParams {
    pub limit: Option<i64>,
    pub since: Option<i64>,
}

/// POST /message - Send message via app token (Gotify compat)
#[utoipa::path(
    post,
    path = "/message",
    request_body = CreateAppMessage,
    responses((status = 200, body = MessageResponse))
)]
pub async fn create_app_message(
    State(state): State<AppState>,
    auth: AuthApp,
    Json(req): Json<CreateAppMessage>,
) -> Result<Json<MessageResponse>, ApiError> {
    if req.message.is_empty() || req.message.len() > 65536 {
        return Err(ApiError::from(rstify_core::error::CoreError::Validation(
            "Message must be between 1 and 65536 characters".to_string(),
        )));
    }

    let extras_json = req.extras.as_ref().map(|e| serde_json::to_string(e).unwrap_or_default());

    let msg = state
        .message_repo
        .create(
            Some(auth.application.id),
            None,
            Some(auth.user.id),
            req.title.as_deref(),
            &req.message,
            req.priority.unwrap_or(auth.application.default_priority),
            None,
            None,
            None,
            None,
            extras_json.as_deref(),
            None,
            None,
        )
        .await
        .map_err(ApiError::from)?;

    let response = msg.to_response(None);

    // Broadcast to user's WebSocket subscribers
    state
        .connections
        .broadcast_to_user(auth.user.id, msg.to_response(None))
        .await;

    Ok(Json(response))
}

/// GET /message - List all messages for user (Gotify compat)
#[utoipa::path(get, path = "/message", responses((status = 200, body = PagedMessages)))]
pub async fn list_messages(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(params): Query<ListParams>,
) -> Result<Json<PagedMessages>, ApiError> {
    let limit = params.limit.unwrap_or(100).min(500).max(1);
    let since = params.since.unwrap_or(0).max(0);

    let messages = state
        .message_repo
        .list_by_user_apps(auth.user.id, limit, since)
        .await
        .map_err(ApiError::from)?;

    let responses: Vec<MessageResponse> = messages.iter().map(|m| m.to_response(None)).collect();
    let size = responses.len() as i64;

    Ok(Json(PagedMessages {
        messages: responses,
        paging: Paging {
            size,
            since,
            limit,
        },
    }))
}

/// DELETE /message - Delete all messages for user
#[utoipa::path(delete, path = "/message", responses((status = 200)))]
pub async fn delete_all_messages(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<serde_json::Value>, ApiError> {
    state
        .message_repo
        .delete_all_for_user(auth.user.id)
        .await
        .map_err(ApiError::from)?;
    Ok(Json(serde_json::json!({"success": true})))
}

/// DELETE /message/{id} - Delete a specific message
#[utoipa::path(delete, path = "/message/{id}", responses((status = 200)))]
pub async fn delete_message(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<i64>,
) -> Result<Json<serde_json::Value>, ApiError> {
    // Verify ownership through the message's application
    let msg = state
        .message_repo
        .find_by_id(id)
        .await
        .map_err(ApiError::from)?
        .ok_or_else(|| {
            ApiError::from(rstify_core::error::CoreError::NotFound(
                "Message not found".to_string(),
            ))
        })?;

    // Check ownership: admin can delete anything, otherwise verify ownership
    if !auth.user.is_admin {
        let is_owner = if let Some(app_id) = msg.application_id {
            // App message: check if the app belongs to this user
            state
                .app_repo
                .find_by_id(app_id)
                .await
                .map_err(ApiError::from)?
                .map(|app| app.user_id == auth.user.id)
                .unwrap_or(false)
        } else {
            // Topic message: check if the user_id on the message matches
            msg.user_id == Some(auth.user.id)
        };

        if !is_owner {
            return Err(ApiError::from(rstify_core::error::CoreError::Forbidden(
                "Not your message".to_string(),
            )));
        }
    }

    state
        .message_repo
        .delete_by_id(id)
        .await
        .map_err(ApiError::from)?;
    Ok(Json(serde_json::json!({"success": true})))
}

/// GET /stream - WebSocket stream for authenticated user (Gotify compat)
pub async fn websocket_stream(
    State(state): State<AppState>,
    ws: WebSocketUpgrade,
    Query(params): Query<TokenQuery>,
) -> Result<impl IntoResponse, ApiError> {
    // Authenticate via query token
    let token = params.token.ok_or_else(|| {
        ApiError::from(rstify_core::error::CoreError::Unauthorized(
            "Token required".to_string(),
        ))
    })?;

    let client = state
        .client_repo
        .find_by_token(&token)
        .await
        .map_err(ApiError::from)?
        .ok_or_else(|| {
            ApiError::from(rstify_core::error::CoreError::Unauthorized(
                "Invalid token".to_string(),
            ))
        })?;

    let user_id = client.user_id;
    let connections = state.connections.clone();

    Ok(ws.on_upgrade(move |mut socket| async move {
        let mut rx = connections.subscribe_user(user_id).await;

        loop {
            tokio::select! {
                result = rx.recv() => {
                    match result {
                        Ok(msg) => {
                            let json = serde_json::to_string(msg.as_ref()).unwrap_or_default();
                            if socket.send(axum::extract::ws::Message::Text(json.into())).await.is_err() {
                                break;
                            }
                        }
                        Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
                        Err(_) => break,
                    }
                }
                msg = socket.recv() => {
                    match msg {
                        Some(Ok(axum::extract::ws::Message::Ping(data))) => {
                            if socket.send(axum::extract::ws::Message::Pong(data)).await.is_err() {
                                break;
                            }
                        }
                        Some(Ok(axum::extract::ws::Message::Close(_))) | None => break,
                        _ => {}
                    }
                }
            }
        }
    }))
}

#[derive(Deserialize)]
pub struct TokenQuery {
    pub token: Option<String>,
}
