use axum::extract::{Path, Query, State, WebSocketUpgrade};
use axum::response::IntoResponse;
use axum::Json;
use rstify_auth::acl::topic_matches;
use rstify_core::models::{
    CreateTopic, CreateTopicMessage, CreateTopicPermission, MessageResponse, Topic,
    TopicPermission,
};
use rstify_core::repositories::{MessageRepository, TopicRepository};

use crate::error::ApiError;
use crate::extractors::auth::AuthUser;
use crate::routes::messages::ListParams;
use crate::state::AppState;

#[utoipa::path(
    post,
    path = "/api/topics",
    request_body = CreateTopic,
    responses((status = 201, body = Topic))
)]
pub async fn create_topic(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<CreateTopic>,
) -> Result<Json<Topic>, ApiError> {
    let name = req.name.trim();
    if name.is_empty() || name.len() > 128 {
        return Err(ApiError::from(rstify_core::error::CoreError::Validation(
            "Topic name must be between 1 and 128 characters".to_string(),
        )));
    }
    if !name
        .chars()
        .all(|c| c.is_alphanumeric() || c == '-' || c == '_' || c == '.')
    {
        return Err(ApiError::from(rstify_core::error::CoreError::Validation(
            "Topic name may only contain alphanumeric characters, hyphens, underscores, and dots"
                .to_string(),
        )));
    }

    let topic = state
        .topic_repo
        .create(
            name,
            Some(auth.user.id),
            req.description.as_deref(),
            req.everyone_read.unwrap_or(true),
            req.everyone_write.unwrap_or(true),
        )
        .await
        .map_err(ApiError::from)?;
    Ok(Json(topic))
}

#[utoipa::path(get, path = "/api/topics", responses((status = 200, body = Vec<Topic>)))]
pub async fn list_topics(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<Topic>>, ApiError> {
    let all_topics = state
        .topic_repo
        .list_all()
        .await
        .map_err(ApiError::from)?;

    // Admins see everything; others see only readable topics
    if auth.user.is_admin {
        return Ok(Json(all_topics));
    }

    let permissions = state
        .topic_repo
        .list_permissions_for_user(auth.user.id)
        .await
        .map_err(ApiError::from)?;

    let visible: Vec<Topic> = all_topics
        .into_iter()
        .filter(|t| {
            t.everyone_read
                || t.owner_id == Some(auth.user.id)
                || permissions
                    .iter()
                    .any(|p| p.can_read && topic_matches(&p.topic_pattern, &t.name))
        })
        .collect();

    Ok(Json(visible))
}

#[utoipa::path(get, path = "/api/topics/{name}", responses((status = 200, body = Topic)))]
pub async fn get_topic(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(name): Path<String>,
) -> Result<Json<Topic>, ApiError> {
    let topic = state
        .topic_repo
        .find_by_name(&name)
        .await
        .map_err(ApiError::from)?
        .ok_or_else(|| {
            ApiError::from(rstify_core::error::CoreError::NotFound(format!(
                "Topic '{}' not found",
                name
            )))
        })?;

    check_read_permission(&state, &auth.user, &topic).await?;

    Ok(Json(topic))
}

#[utoipa::path(delete, path = "/api/topics/{name}", responses((status = 200)))]
pub async fn delete_topic(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(name): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let topic = state
        .topic_repo
        .find_by_name(&name)
        .await
        .map_err(ApiError::from)?
        .ok_or_else(|| {
            ApiError::from(rstify_core::error::CoreError::NotFound(format!(
                "Topic '{}' not found",
                name
            )))
        })?;

    if topic.owner_id != Some(auth.user.id) && !auth.user.is_admin {
        return Err(ApiError::from(rstify_core::error::CoreError::Forbidden(
            "Not your topic".to_string(),
        )));
    }

    state
        .topic_repo
        .delete(topic.id)
        .await
        .map_err(ApiError::from)?;
    Ok(Json(serde_json::json!({"success": true})))
}

/// Check if user has read permission to a topic
async fn check_read_permission(
    state: &AppState,
    user: &rstify_core::models::User,
    topic: &Topic,
) -> Result<(), ApiError> {
    if user.is_admin || topic.everyone_read || topic.owner_id == Some(user.id) {
        return Ok(());
    }

    let permissions = state
        .topic_repo
        .list_permissions_for_user(user.id)
        .await
        .map_err(ApiError::from)?;

    for perm in &permissions {
        if perm.can_read && topic_matches(&perm.topic_pattern, &topic.name) {
            return Ok(());
        }
    }

    Err(ApiError::from(rstify_core::error::CoreError::Forbidden(
        "No read permission for this topic".to_string(),
    )))
}

/// Check if user has write permission to a topic
async fn check_write_permission(
    state: &AppState,
    user: &rstify_core::models::User,
    topic: &Topic,
) -> Result<(), ApiError> {
    if user.is_admin || topic.everyone_write || topic.owner_id == Some(user.id) {
        return Ok(());
    }

    let permissions = state
        .topic_repo
        .list_permissions_for_user(user.id)
        .await
        .map_err(ApiError::from)?;

    for perm in &permissions {
        if perm.can_write && topic_matches(&perm.topic_pattern, &topic.name) {
            return Ok(());
        }
    }

    Err(ApiError::from(rstify_core::error::CoreError::Forbidden(
        "No write permission for this topic".to_string(),
    )))
}

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
    let topic = state
        .topic_repo
        .find_by_name(&name)
        .await
        .map_err(ApiError::from)?
        .ok_or_else(|| {
            ApiError::from(rstify_core::error::CoreError::NotFound(format!(
                "Topic '{}' not found",
                name
            )))
        })?;

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

    Ok(Json(response))
}

/// WebSocket for topic subscription
pub async fn topic_websocket(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(name): Path<String>,
    ws: WebSocketUpgrade,
) -> Result<impl IntoResponse, ApiError> {
    let topic = state
        .topic_repo
        .find_by_name(&name)
        .await
        .map_err(ApiError::from)?
        .ok_or_else(|| {
            ApiError::from(rstify_core::error::CoreError::NotFound(format!(
                "Topic '{}' not found",
                name
            )))
        })?;

    check_read_permission(&state, &auth.user, &topic).await?;

    let connections = state.connections.clone();

    Ok(ws.on_upgrade(move |mut socket| async move {
        let mut rx = connections.subscribe_topic(&name).await;

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
                        Some(Ok(axum::extract::ws::Message::Close(_))) | None => break,
                        _ => {}
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
    let topic = state
        .topic_repo
        .find_by_name(&name)
        .await
        .map_err(ApiError::from)?
        .ok_or_else(|| {
            ApiError::from(rstify_core::error::CoreError::NotFound(format!(
                "Topic '{}' not found",
                name
            )))
        })?;

    check_read_permission(&state, &auth.user, &topic).await?;

    let limit = params.limit.unwrap_or(100).min(500).max(1);
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

// Permissions

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
