use axum::extract::{Multipart, Path, State};
use axum::http::header;
use axum::response::IntoResponse;
use axum::Json;
use rstify_core::models::Attachment;
use rstify_core::repositories::MessageRepository;
use tokio::fs;
use uuid::Uuid;

use crate::error::ApiError;
use crate::extractors::auth::AuthUser;
use crate::state::AppState;

/// Sanitize a filename by stripping path components and falling back to a UUID if empty.
fn sanitize_filename(raw: &str) -> String {
    // Strip any directory components (防 path traversal)
    let name = raw
        .rsplit(['/', '\\'])
        .next()
        .unwrap_or("attachment");

    // Remove any remaining problematic characters
    let sanitized: String = name
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '.' || *c == '-' || *c == '_')
        .collect();

    if sanitized.is_empty() || sanitized == "." || sanitized == ".." {
        format!("{}.bin", Uuid::new_v4())
    } else {
        sanitized
    }
}

#[utoipa::path(
    post,
    path = "/api/messages/{id}/attachments",
    responses((status = 201, body = Attachment))
)]
pub async fn upload_attachment(
    State(state): State<AppState>,
    _auth: AuthUser,
    Path(message_id): Path<i64>,
    mut multipart: Multipart,
) -> Result<Json<Attachment>, ApiError> {
    // Verify message exists
    let _msg = state
        .message_repo
        .find_by_id(message_id)
        .await
        .map_err(ApiError::from)?
        .ok_or_else(|| {
            ApiError::from(rstify_core::error::CoreError::NotFound(
                "Message not found".to_string(),
            ))
        })?;

    let upload_dir = &state.upload_dir;
    fs::create_dir_all(upload_dir).await.map_err(|e| {
        ApiError::from(rstify_core::error::CoreError::Internal(format!(
            "Failed to create upload dir: {}",
            e
        )))
    })?;

    while let Some(field) = multipart.next_field().await.map_err(|e| {
        ApiError::from(rstify_core::error::CoreError::Validation(format!(
            "Multipart error: {}",
            e
        )))
    })? {
        let raw_filename = field
            .file_name()
            .unwrap_or("attachment")
            .to_string();
        let filename = sanitize_filename(&raw_filename);
        let content_type = field.content_type().map(|s| s.to_string());
        let data = field.bytes().await.map_err(|e| {
            ApiError::from(rstify_core::error::CoreError::Internal(format!(
                "Failed to read file: {}",
                e
            )))
        })?;

        // Use a UUID prefix to avoid collisions and ensure uniqueness
        let storage_filename = format!("{}_{}", Uuid::new_v4(), filename);
        let storage_path = format!("{}/{}", upload_dir, storage_filename);

        fs::write(&storage_path, &data).await.map_err(|e| {
            ApiError::from(rstify_core::error::CoreError::Internal(format!(
                "Failed to write file: {}",
                e
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

        return Ok(Json(attachment));
    }

    Err(ApiError::from(rstify_core::error::CoreError::Validation(
        "No file provided".to_string(),
    )))
}

#[utoipa::path(get, path = "/api/attachments/{id}", responses((status = 200)))]
pub async fn download_attachment(
    State(state): State<AppState>,
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
