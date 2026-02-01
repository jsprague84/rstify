use axum::body::Bytes;
use axum::extract::{Path, State};
use axum::http::HeaderMap;
use axum::Json;
use rstify_core::models::MessageResponse;
use rstify_core::repositories::{MessageRepository, TopicRepository};

use crate::error::ApiError;
use crate::extractors::auth::AuthUser;
use crate::ntfy_headers::NtfyHeaders;
use crate::state::AppState;

/// POST /{topic} or PUT /{topic} - ntfy-style publish where body is the message
/// and HTTP headers carry metadata.
#[utoipa::path(
    post,
    path = "/{topic}",
    request_body(content = String, description = "Message body as plain text"),
    responses((status = 200, body = MessageResponse))
)]
pub async fn ntfy_publish(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(topic_name): Path<String>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<MessageResponse>, ApiError> {
    let topic = state
        .topic_repo
        .find_by_name(&topic_name)
        .await
        .map_err(ApiError::from)?
        .ok_or_else(|| {
            ApiError::from(rstify_core::error::CoreError::NotFound(format!(
                "Topic '{}' not found",
                topic_name
            )))
        })?;

    // Check write permission
    if !auth.user.is_admin && !topic.everyone_write && topic.owner_id != Some(auth.user.id) {
        let permissions = state
            .topic_repo
            .list_permissions_for_user(auth.user.id)
            .await
            .map_err(ApiError::from)?;
        let has_write = permissions.iter().any(|p| {
            p.can_write && rstify_auth::acl::topic_matches(&p.topic_pattern, &topic.name)
        });
        if !has_write {
            return Err(ApiError::from(rstify_core::error::CoreError::Forbidden(
                "No write permission for this topic".to_string(),
            )));
        }
    }

    let message_text = String::from_utf8_lossy(&body).to_string();
    if message_text.is_empty() || message_text.len() > 65536 {
        return Err(ApiError::from(rstify_core::error::CoreError::Validation(
            "Message must be between 1 and 65536 characters".to_string(),
        )));
    }

    let h = NtfyHeaders::from_headers(&headers);

    let tags_json = h
        .tags
        .as_ref()
        .map(|t| serde_json::to_string(t).unwrap_or_default());

    let msg = state
        .message_repo
        .create(
            None,
            Some(topic.id),
            Some(auth.user.id),
            h.title.as_deref(),
            &message_text,
            h.priority.unwrap_or(3),
            tags_json.as_deref(),
            h.click_url.as_deref(),
            h.icon_url.as_deref(),
            h.actions.as_deref(),
            None,
            h.content_type.as_deref(),
            h.scheduled_for.as_deref(),
        )
        .await
        .map_err(ApiError::from)?;

    // Set message expiry if Cache header provided
    if let Some(ref cache_dur) = h.cache_duration {
        if let Ok(duration) = humantime::parse_duration(cache_dur) {
            if let Some(expires) = chrono::Utc::now().checked_add_signed(
                chrono::Duration::from_std(duration).unwrap_or(chrono::Duration::hours(24)),
            ) {
                let _ = state
                    .message_repo
                    .set_expires_at(msg.id, &expires.format("%Y-%m-%d %H:%M:%S").to_string())
                    .await;
            }
        }
    }

    let response = msg.to_response(Some(topic_name.clone()));

    // Broadcast to topic subscribers (only if not scheduled)
    if h.scheduled_for.is_none() {
        state
            .connections
            .broadcast_to_topic(&topic_name, msg.to_response(Some(topic_name.clone())))
            .await;
    }

    // Fire outgoing webhooks
    {
        let pool = state.pool.clone();
        let topic = topic_name.clone();
        let resp = response.clone();
        tokio::spawn(async move {
            rstify_jobs::outgoing_webhooks::fire_outgoing_webhooks(&pool, &topic, &resp).await;
        });
    }

    // Send email notification if Email header present and SMTP configured
    if let Some(ref email_to) = h.email {
        if let Some(email_config) = rstify_jobs::email::EmailConfig::from_env() {
            let email_to = email_to.clone();
            let subject = h
                .title
                .clone()
                .unwrap_or_else(|| format!("Notification from {}", topic_name));
            let body = message_text.clone();
            tokio::spawn(async move {
                rstify_jobs::email::send_email(&email_config, &email_to, &subject, &body).await;
            });
        }
    }

    Ok(Json(response))
}
