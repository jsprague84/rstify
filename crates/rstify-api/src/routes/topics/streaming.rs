use axum::extract::{Path, Query, State, WebSocketUpgrade};
use axum::response::IntoResponse;
use axum::Json;
use rstify_core::models::{CreateTopicMessage, MessageResponse, Topic};
use rstify_core::repositories::{MessageRepository, TopicRepository};

use crate::error::ApiError;
use crate::extractors::auth::AuthUser;
use crate::routes::messages::ListParams;
use crate::state::AppState;

use super::management::{check_read_permission, check_write_permission};

#[utoipa::path(
    post,
    path = "/api/topics/{name}/publish",
    request_body = CreateTopicMessage,
    responses((status = 200, body = MessageResponse))
)]
pub async fn publish_to_topic(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(name): Path<String>,
    Json(req): Json<CreateTopicMessage>,
) -> Result<Json<MessageResponse>, ApiError> {
    let topic = find_topic_by_name(&state, &name).await?;

    check_write_permission(&state, &auth.user, &topic).await?;

    if req.message.is_empty() || req.message.len() > 65536 {
        return Err(ApiError::from(rstify_core::error::CoreError::Validation(
            "Message must be between 1 and 65536 characters".to_string(),
        )));
    }

    let tags_json = req
        .tags
        .as_ref()
        .map(|t| serde_json::to_string(t).unwrap_or_default());
    let actions_json = req
        .actions
        .as_ref()
        .map(|a| serde_json::to_string(a).unwrap_or_default());

    let threshold = state
        .inbox_threshold
        .load(std::sync::atomic::Ordering::Relaxed);
    let inbox = rstify_core::policy::should_inbox(&topic, req.priority.unwrap_or(5), threshold);

    let msg = state
        .message_repo
        .create(
            None,
            Some(topic.id),
            Some(auth.user.id),
            req.title.as_deref(),
            &req.message,
            req.priority.unwrap_or(5),
            tags_json.as_deref(),
            req.click_url.as_deref(),
            req.icon_url.as_deref(),
            actions_json.as_deref(),
            None,
            None,
            req.scheduled_for.as_deref(),
            None, // source: API
            inbox,
        )
        .await
        .map_err(ApiError::from)?;

    let response = msg.to_response(Some(name.clone()));

    // Broadcast to topic subscribers (only if not scheduled)
    if req.scheduled_for.is_none() {
        state
            .connections
            .broadcast_to_topic(&name, msg.to_response(Some(name.clone())))
            .await;
    }

    // Fire outgoing webhooks
    {
        let pool = state.pool.clone();
        let topic = name.clone();
        let resp = response.clone();
        tokio::spawn(async move {
            rstify_jobs::outgoing_webhooks::fire_outgoing_webhooks(&pool, &topic, &resp).await;
        });
    }

    // Send FCM push notifications to topic owner (respecting notification policy)
    if req.scheduled_for.is_none() && inbox {
        if let Some(ref fcm) = state.fcm {
            if let Some(owner_id) = topic.owner_id {
                let fcm = fcm.clone();
                let client_repo = state.client_repo.clone();
                let resp = response.clone();
                tokio::spawn(async move {
                    fcm.notify_user(&client_repo, owner_id, &resp, resp.icon_url.as_deref())
                        .await;
                });
            }
        }
    }

    Ok(Json(response))
}

/// WebSocket for topic subscription
pub async fn topic_websocket(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(name): Path<String>,
    ws: WebSocketUpgrade,
) -> Result<impl IntoResponse, ApiError> {
    let topic = find_topic_by_name(&state, &name).await?;

    check_read_permission(&state, &auth.user, &topic).await?;

    let connections = state.connections.clone();

    Ok(ws.on_upgrade(move |mut socket| async move {
        let mut rx = connections.subscribe_topic(&name).await;
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
                            tracing::warn!("WebSocket topic={} lagged, skipped {} messages", name, n);
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

/// JSON stream for topic (long-polling style)
pub async fn topic_json_stream(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(name): Path<String>,
    Query(params): Query<ListParams>,
) -> Result<Json<Vec<MessageResponse>>, ApiError> {
    let topic = find_topic_by_name(&state, &name).await?;

    check_read_permission(&state, &auth.user, &topic).await?;

    let limit = params.limit.unwrap_or(100).clamp(1, 500);
    let since = params.since.unwrap_or(0).max(0);

    let messages = state
        .message_repo
        .list_by_topic(topic.id, limit, since)
        .await
        .map_err(ApiError::from)?;

    let responses: Vec<MessageResponse> = messages
        .iter()
        .map(|m| m.to_response(Some(name.clone())))
        .collect();

    Ok(Json(responses))
}

/// Helper to find a topic by name or return a 404 error.
async fn find_topic_by_name(state: &AppState, name: &str) -> Result<Topic, ApiError> {
    state
        .topic_repo
        .find_by_name(name)
        .await
        .map_err(ApiError::from)?
        .ok_or_else(|| {
            ApiError::from(rstify_core::error::CoreError::NotFound(format!(
                "Topic '{}' not found",
                name
            )))
        })
}
