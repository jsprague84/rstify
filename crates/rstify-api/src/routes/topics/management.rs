use axum::extract::{Path, Query, State};
use axum::Json;
use rstify_auth::acl::topic_matches;
use rstify_core::models::{
    CreateTopic, MessageResponse, PagedMessages, Paging, Topic, UpdateTopic,
};
use rstify_core::repositories::{MessageRepository, TopicRepository};

use crate::error::ApiError;
use crate::extractors::auth::AuthUser;
use crate::helpers::ownership::{fetch_or_not_found, verify_optional_ownership};
use crate::helpers::validation::{
    validate_json, validate_policy, validate_positive, validate_topic_name, NOTIFY_POLICIES,
    STORE_POLICIES,
};
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
    validate_topic_name(name)?;

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
    // Admins see everything; others see only readable topics
    if auth.user.is_admin {
        let all_topics = state.topic_repo.list_all().await.map_err(ApiError::from)?;
        return Ok(Json(all_topics));
    }

    let visible = state
        .topic_repo
        .list_visible(auth.user.id)
        .await
        .map_err(ApiError::from)?;

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

/// PUT /api/topics/{name} - Update a topic
#[utoipa::path(
    put,
    path = "/api/topics/{name}",
    request_body = UpdateTopic,
    responses((status = 200, body = Topic))
)]
pub async fn update_topic(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(name): Path<String>,
    Json(req): Json<UpdateTopic>,
) -> Result<Json<Topic>, ApiError> {
    let topic = fetch_or_not_found("Topic", || state.topic_repo.find_by_name(&name)).await?;
    verify_optional_ownership(&auth, topic.owner_id, "topic")?;

    // Validate notification/store policy fields
    if let Some(ref policy) = req.notify_policy {
        validate_policy("notify_policy", policy, NOTIFY_POLICIES)?;
    }
    if let Some(ref condition) = req.notify_condition {
        validate_json("notify_condition", condition)?;
    }
    if let Some(interval) = req.notify_digest_interval {
        validate_positive("notify_digest_interval", interval)?;
    }
    if let Some(ref policy) = req.store_policy {
        validate_policy("store_policy", policy, STORE_POLICIES)?;
    }
    if let Some(interval) = req.store_interval {
        validate_positive("store_interval", interval)?;
    }

    let updated = state
        .topic_repo
        .update(
            topic.id,
            req.description.as_deref(),
            req.everyone_read,
            req.everyone_write,
            req.notify_policy.as_deref(),
            req.notify_priority_min,
            req.notify_condition.as_deref(),
            req.notify_digest_interval,
            req.store_policy.as_deref(),
            req.store_interval,
        )
        .await
        .map_err(ApiError::from)?;

    Ok(Json(updated))
}

#[utoipa::path(delete, path = "/api/topics/{name}", responses((status = 200)))]
pub async fn delete_topic(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(name): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let topic = fetch_or_not_found("Topic", || state.topic_repo.find_by_name(&name)).await?;
    verify_optional_ownership(&auth, topic.owner_id, "topic")?;

    state
        .topic_repo
        .delete(topic.id)
        .await
        .map_err(ApiError::from)?;
    Ok(Json(serde_json::json!({"success": true})))
}

/// Check if user has read permission to a topic
pub(super) async fn check_read_permission(
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
pub(super) async fn check_write_permission(
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

/// GET /api/topics/{name}/messages - Paginated messages for a topic
#[utoipa::path(
    get,
    path = "/api/topics/{name}/messages",
    responses((status = 200, body = PagedMessages))
)]
pub async fn list_topic_messages(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(name): Path<String>,
    Query(params): Query<ListParams>,
) -> Result<Json<PagedMessages>, ApiError> {
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
    let size = responses.len() as i64;

    Ok(Json(PagedMessages {
        messages: responses,
        paging: Paging { size, since, limit },
    }))
}
