use axum::extract::{Path, Query, State, WebSocketUpgrade};
use axum::response::IntoResponse;
use axum::Json;
use rstify_core::models::{
    CreateAppMessage, MessageResponse, PagedMessages, Paging, UpdateMessage,
};
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

    let extras_json = req
        .extras
        .as_ref()
        .map(|e| serde_json::to_string(e).unwrap_or_default());

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

    // Send FCM push notifications to offline devices
    if let Some(ref fcm) = state.fcm {
        let fcm = fcm.clone();
        let client_repo = state.client_repo.clone();
        let user_id = auth.user.id;
        let resp = response.clone();
        tokio::spawn(async move {
            fcm.notify_user(&client_repo, user_id, &resp).await;
        });
    }

    Ok(Json(response))
}

/// GET /message - List all messages for user (Gotify compat)
#[utoipa::path(get, path = "/message", responses((status = 200, body = PagedMessages)))]
pub async fn list_messages(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(params): Query<ListParams>,
) -> Result<Json<PagedMessages>, ApiError> {
    let limit = params.limit.unwrap_or(100).clamp(1, 500);
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
        paging: Paging { size, since, limit },
    }))
}

#[derive(Deserialize)]
pub struct SearchParams {
    pub q: Option<String>,
    pub tag: Option<String>,
    pub priority_min: Option<i32>,
    pub priority_max: Option<i32>,
    pub since: Option<String>,
    pub until: Option<String>,
    pub appid: Option<i64>,
    pub limit: Option<i64>,
}

/// GET /message/search - Search/filter messages
#[utoipa::path(
    get,
    path = "/message/search",
    responses((status = 200, body = Vec<MessageResponse>))
)]
pub async fn search_messages(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(params): Query<SearchParams>,
) -> Result<Json<Vec<MessageResponse>>, ApiError> {
    let limit = params.limit.unwrap_or(100).clamp(1, 500);
    let messages = state
        .message_repo
        .search(
            auth.user.id,
            params.q.as_deref(),
            params.tag.as_deref(),
            params.priority_min,
            params.priority_max,
            params.since.as_deref(),
            params.until.as_deref(),
            params.appid,
            limit,
        )
        .await
        .map_err(ApiError::from)?;

    let responses: Vec<MessageResponse> = messages.iter().map(|m| m.to_response(None)).collect();
    Ok(Json(responses))
}

/// GET /application/{id}/messages - List messages for an application (paginated)
#[utoipa::path(
    get,
    path = "/application/{id}/messages",
    responses((status = 200, body = PagedMessages))
)]
pub async fn list_application_messages(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(app_id): Path<i64>,
    Query(params): Query<ListParams>,
) -> Result<Json<PagedMessages>, ApiError> {
    let app = state
        .app_repo
        .find_by_id(app_id)
        .await
        .map_err(ApiError::from)?
        .ok_or_else(|| {
            ApiError::from(rstify_core::error::CoreError::NotFound(
                "Application not found".to_string(),
            ))
        })?;

    // Ownership check: must be admin or own the application
    if !auth.user.is_admin && app.user_id != auth.user.id {
        return Err(ApiError::from(rstify_core::error::CoreError::Forbidden(
            "Not your application".to_string(),
        )));
    }

    let limit = params.limit.unwrap_or(100).clamp(1, 500);
    let since = params.since.unwrap_or(0).max(0);

    let messages = state
        .message_repo
        .list_by_application(app_id, limit, since)
        .await
        .map_err(ApiError::from)?;

    let responses: Vec<MessageResponse> = messages.iter().map(|m| m.to_response(None)).collect();
    let size = responses.len() as i64;

    Ok(Json(PagedMessages {
        messages: responses,
        paging: Paging { size, since, limit },
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

#[derive(Deserialize, utoipa::ToSchema)]
pub struct BatchDeleteRequest {
    pub ids: Vec<i64>,
}

/// DELETE /message/batch - Delete multiple messages at once
#[utoipa::path(delete, path = "/message/batch", responses((status = 200)))]
pub async fn delete_batch_messages(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<BatchDeleteRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    if req.ids.len() > 1000 {
        return Err(ApiError::from(rstify_core::error::CoreError::Validation(
            "Maximum 1000 IDs per batch delete".to_string(),
        )));
    }
    let deleted = state
        .message_repo
        .delete_batch(&req.ids, auth.user.id)
        .await
        .map_err(ApiError::from)?;
    Ok(Json(
        serde_json::json!({"success": true, "deleted": deleted}),
    ))
}

#[derive(Deserialize)]
pub struct DeleteAllParams {
    pub appid: Option<i64>,
}

/// DELETE /message/all - Delete all messages for an app
#[utoipa::path(delete, path = "/message/all", responses((status = 200)))]
pub async fn delete_all_app_messages(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(params): Query<DeleteAllParams>,
) -> Result<Json<serde_json::Value>, ApiError> {
    if let Some(app_id) = params.appid {
        // Verify ownership
        let app = state
            .app_repo
            .find_by_id(app_id)
            .await
            .map_err(ApiError::from)?
            .ok_or_else(|| {
                ApiError::from(rstify_core::error::CoreError::NotFound(
                    "Application not found".to_string(),
                ))
            })?;
        if app.user_id != auth.user.id && !auth.user.is_admin {
            return Err(ApiError::from(rstify_core::error::CoreError::Forbidden(
                "Not your application".to_string(),
            )));
        }
        state
            .message_repo
            .delete_all_for_application(app_id)
            .await
            .map_err(ApiError::from)?;
    } else {
        state
            .message_repo
            .delete_all_for_user(auth.user.id)
            .await
            .map_err(ApiError::from)?;
    }
    Ok(Json(serde_json::json!({"success": true})))
}

/// PUT /message/{id} - Update a specific message
#[utoipa::path(
    put,
    path = "/message/{id}",
    request_body = UpdateMessage,
    responses((status = 200, body = MessageResponse))
)]
pub async fn update_message(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<i64>,
    Json(req): Json<UpdateMessage>,
) -> Result<Json<MessageResponse>, ApiError> {
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

    // Ownership check
    if !auth.user.is_admin {
        let is_owner = if let Some(app_id) = msg.application_id {
            state
                .app_repo
                .find_by_id(app_id)
                .await
                .map_err(ApiError::from)?
                .map(|app| app.user_id == auth.user.id)
                .unwrap_or(false)
        } else {
            msg.user_id == Some(auth.user.id)
        };

        if !is_owner {
            return Err(ApiError::from(rstify_core::error::CoreError::Forbidden(
                "Not your message".to_string(),
            )));
        }
    }

    let extras_json = req
        .extras
        .as_ref()
        .map(|e| serde_json::to_string(e).unwrap_or_default());

    let updated = state
        .message_repo
        .update(
            id,
            req.title.as_deref(),
            req.message.as_deref(),
            req.priority,
            extras_json.as_deref(),
        )
        .await
        .map_err(ApiError::from)?;

    Ok(Json(updated.to_response(None)))
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
        let mut ping_interval = tokio::time::interval(std::time::Duration::from_secs(30));
        ping_interval.tick().await; // skip first immediate tick

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
                        Err(tokio::sync::broadcast::error::RecvError::Lagged(n)) => {
                            tracing::warn!("WebSocket user={} lagged, skipped {} messages", user_id, n);
                            continue;
                        }
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
                        Some(Ok(axum::extract::ws::Message::Pong(_))) => {}
                        Some(Ok(axum::extract::ws::Message::Close(_))) | None => break,
                        _ => {}
                    }
                }
                _ = ping_interval.tick() => {
                    if socket.send(axum::extract::ws::Message::Ping(vec![].into())).await.is_err() {
                        break;
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
