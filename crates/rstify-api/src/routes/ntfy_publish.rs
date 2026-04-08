use axum::body::Bytes;
use axum::extract::{Path, State};
use axum::http::HeaderMap;
use axum::Json;
use rstify_core::models::{AttachmentInfo, MessageResponse};
use rstify_core::repositories::{MessageRepository, TopicRepository};
use tokio::fs;
use uuid::Uuid;

use crate::error::ApiError;
use crate::extractors::auth::AuthUser;
use crate::ntfy_headers::NtfyHeaders;
use crate::state::AppState;
use crate::utils::sanitize_filename;

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
        let has_write = permissions
            .iter()
            .any(|p| p.can_write && rstify_auth::acl::topic_matches(&p.topic_pattern, &topic.name));
        if !has_write {
            return Err(ApiError::from(rstify_core::error::CoreError::Forbidden(
                "No write permission for this topic".to_string(),
            )));
        }
    }

    let h = NtfyHeaders::from_headers(&headers);

    // Determine if this is a file-upload request (body is the file)
    // ntfy: PUT with Filename header means body is the attachment
    let is_file_upload = h.filename.is_some() && h.attach_url.is_none();

    let (message_text, file_data): (String, Option<Vec<u8>>) = if is_file_upload {
        // Body is the file; message comes from X-Message header if present
        let msg_text = get_header_str(&headers, "x-message")
            .or_else(|| get_header_str(&headers, "message"))
            .unwrap_or_default();
        (msg_text, Some(body.to_vec()))
    } else {
        let text = String::from_utf8_lossy(&body).to_string();
        (text, None)
    };

    if !is_file_upload && (message_text.is_empty() || message_text.len() > 65536) {
        return Err(ApiError::from(rstify_core::error::CoreError::Validation(
            "Message must be between 1 and 65536 characters".to_string(),
        )));
    }

    let tags_json = h
        .tags
        .as_ref()
        .map(|t| serde_json::to_string(t).unwrap_or_default());

    let threshold = state
        .inbox_threshold
        .load(std::sync::atomic::Ordering::Relaxed);
    let inbox = rstify_core::policy::should_inbox(&topic, h.priority.unwrap_or(3), threshold);

    let msg = state
        .message_repo
        .create(
            None,
            Some(topic.id),
            Some(auth.user.id),
            h.title.as_deref(),
            if message_text.is_empty() {
                "Attachment"
            } else {
                &message_text
            },
            h.priority.unwrap_or(3),
            tags_json.as_deref(),
            h.click_url.as_deref(),
            h.icon_url.as_deref(),
            h.actions.as_deref(),
            None,
            h.content_type.as_deref(),
            h.scheduled_for.as_deref(),
            Some("ntfy"),
            inbox,
        )
        .await
        .map_err(ApiError::from)?;

    // Handle file attachment: either inline body or download from X-Attach URL
    let mut attachment_infos: Vec<AttachmentInfo> = Vec::new();

    if let Some(data) = file_data {
        // PUT with body as file
        if let Some(att) = save_attachment(
            &state,
            msg.id,
            &h.filename
                .clone()
                .unwrap_or_else(|| "attachment".to_string()),
            &data,
        )
        .await?
        {
            attachment_infos.push(att);
        }
    } else if let Some(ref url) = h.attach_url {
        // X-Attach: download from URL and attach
        match download_and_attach(&state, msg.id, url, h.filename.as_deref()).await {
            Ok(att) => attachment_infos.push(att),
            Err(_) => {
                tracing::warn!("Failed to download attachment from {}", url);
            }
        }
    }

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

    let mut response = msg.to_response(Some(topic_name.clone()));
    if !attachment_infos.is_empty() {
        response.attachments = Some(attachment_infos);
    }

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

    // Send FCM push notifications to topic owner (respecting notification policy)
    if h.scheduled_for.is_none() && inbox {
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

    // Send email notification if Email header present and SMTP configured
    if let Some(ref email_to) = h.email {
        if let Some(ref email_config) = state.email_config {
            let email_config = email_config.clone();
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

fn get_header_str(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

/// Save raw bytes as an attachment to a message.
async fn save_attachment(
    state: &AppState,
    message_id: i64,
    raw_filename: &str,
    data: &[u8],
) -> Result<Option<AttachmentInfo>, ApiError> {
    if data.is_empty() {
        return Ok(None);
    }
    if data.len() > state.max_upload_size {
        return Err(ApiError::from(rstify_core::error::CoreError::Validation(
            format!(
                "Attachment too large: {} bytes (max {} bytes)",
                data.len(),
                state.max_upload_size
            ),
        )));
    }

    let upload_dir = &state.upload_dir;
    fs::create_dir_all(upload_dir).await.map_err(|e| {
        ApiError::from(rstify_core::error::CoreError::Internal(format!(
            "Failed to create upload dir: {e}"
        )))
    })?;

    let filename = sanitize_filename(raw_filename);
    let content_type = mime_guess::from_path(&filename)
        .first()
        .map(|m| m.to_string());
    let storage_filename = format!("{}_{}", Uuid::new_v4(), filename);
    let storage_path = format!("{}/{}", upload_dir, storage_filename);

    fs::write(&storage_path, data).await.map_err(|e| {
        ApiError::from(rstify_core::error::CoreError::Internal(format!(
            "Failed to write file: {e}"
        )))
    })?;

    let attachment = state
        .message_repo
        .create_attachment(
            message_id,
            &filename,
            content_type.as_deref(),
            data.len() as i64,
            "local",
            &storage_path,
            None,
        )
        .await
        .map_err(ApiError::from)?;

    Ok(Some(AttachmentInfo::from_attachment(&attachment)))
}

/// Download a file from a URL and save it as an attachment.
async fn download_and_attach(
    state: &AppState,
    message_id: i64,
    url: &str,
    filename_override: Option<&str>,
) -> Result<AttachmentInfo, ApiError> {
    // SSRF protection: validate URL does not target internal/private addresses
    crate::utils::validate_webhook_url(url).map_err(|e| {
        ApiError::from(rstify_core::error::CoreError::Validation(format!(
            "Attachment URL blocked: {e}"
        )))
    })?;

    let response = reqwest::get(url).await.map_err(|e| {
        ApiError::from(rstify_core::error::CoreError::Internal(format!(
            "Failed to download attachment: {e}"
        )))
    })?;

    if !response.status().is_success() {
        return Err(ApiError::from(rstify_core::error::CoreError::Internal(
            format!(
                "Attachment download failed with status {}",
                response.status()
            ),
        )));
    }

    // Derive filename from override, Content-Disposition, or URL path
    let filename = filename_override
        .map(|s| s.to_string())
        .or_else(|| {
            url.rsplit('/')
                .next()
                .filter(|s| !s.is_empty() && s.contains('.'))
                .map(|s| s.to_string())
        })
        .unwrap_or_else(|| "attachment".to_string());

    let data = response.bytes().await.map_err(|e| {
        ApiError::from(rstify_core::error::CoreError::Internal(format!(
            "Failed to read attachment body: {e}"
        )))
    })?;

    save_attachment(state, message_id, &filename, &data)
        .await?
        .ok_or_else(|| {
            ApiError::from(rstify_core::error::CoreError::Internal(
                "Downloaded file was empty".to_string(),
            ))
        })
}
