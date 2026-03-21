use axum::extract::{Path, State};
use axum::http::header;
use axum::response::IntoResponse;
use axum::Json;
use rstify_core::models::AttachmentInfo;
use rstify_core::repositories::{ApplicationRepository, MessageRepository};
use tokio::fs;

use crate::error::ApiError;
use crate::extractors::auth::AuthUser;
use crate::state::AppState;
use crate::utils::sanitize_filename;

/// Verify the authenticated user owns the message an attachment belongs to.
async fn verify_attachment_ownership(
    state: &AppState,
    auth: &AuthUser,
    message_id: i64,
) -> Result<(), ApiError> {
    if auth.user.is_admin {
        return Ok(());
    }
    let msg = state
        .message_repo
        .find_by_id(message_id)
        .await
        .map_err(ApiError::from)?
        .ok_or_else(|| {
            ApiError::from(rstify_core::error::CoreError::NotFound(
                "Message not found".to_string(),
            ))
        })?;
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
    Ok(())
}

#[utoipa::path(get, path = "/api/attachments/{id}", responses((status = 200)))]
pub async fn download_attachment(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<i64>,
) -> Result<impl IntoResponse, ApiError> {
    let attachment = state
        .message_repo
        .find_attachment(id)
        .await
        .map_err(ApiError::from)?
        .ok_or_else(|| {
            ApiError::from(rstify_core::error::CoreError::NotFound(
                "Attachment not found".to_string(),
            ))
        })?;

    verify_attachment_ownership(&state, &auth, attachment.message_id).await?;

    let data = fs::read(&attachment.storage_path).await.map_err(|e| {
        ApiError::from(rstify_core::error::CoreError::Internal(format!(
            "Failed to read file: {}",
            e
        )))
    })?;

    let content_type = attachment
        .content_type
        .unwrap_or_else(|| "application/octet-stream".to_string());

    // Sanitize filename for Content-Disposition to prevent header injection
    let safe_filename = sanitize_filename(&attachment.filename);

    Ok((
        [
            (header::CONTENT_TYPE, content_type),
            (
                header::CONTENT_DISPOSITION,
                format!("attachment; filename=\"{}\"", safe_filename),
            ),
        ],
        data,
    ))
}

/// DELETE /api/attachments/{id} - Delete an attachment
#[utoipa::path(delete, path = "/api/attachments/{id}", responses((status = 204)))]
pub async fn delete_attachment(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<i64>,
) -> Result<impl IntoResponse, ApiError> {
    let attachment = state
        .message_repo
        .find_attachment(id)
        .await
        .map_err(ApiError::from)?
        .ok_or_else(|| {
            ApiError::from(rstify_core::error::CoreError::NotFound(
                "Attachment not found".to_string(),
            ))
        })?;

    verify_attachment_ownership(&state, &auth, attachment.message_id).await?;

    // Delete file from disk (ignore errors if file already gone)
    let _ = fs::remove_file(&attachment.storage_path).await;

    state
        .message_repo
        .delete_attachment(id)
        .await
        .map_err(ApiError::from)?;

    Ok(axum::http::StatusCode::NO_CONTENT)
}

/// GET /api/messages/{id}/attachments - List attachments for a message
#[utoipa::path(
    get,
    path = "/api/messages/{id}/attachments",
    responses((status = 200, body = Vec<AttachmentInfo>))
)]
pub async fn list_message_attachments(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(message_id): Path<i64>,
) -> Result<Json<Vec<AttachmentInfo>>, ApiError> {
    verify_attachment_ownership(&state, &auth, message_id).await?;

    let attachments = state
        .message_repo
        .list_attachments_by_message(message_id)
        .await
        .map_err(ApiError::from)?;

    let infos: Vec<AttachmentInfo> = attachments
        .iter()
        .map(AttachmentInfo::from_attachment)
        .collect();

    Ok(Json(infos))
}
