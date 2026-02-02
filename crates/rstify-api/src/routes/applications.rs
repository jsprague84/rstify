use axum::extract::{Multipart, Path, State};
use axum::http::header;
use axum::response::IntoResponse;
use axum::Json;
use rstify_auth::tokens::generate_app_token;
use rstify_core::models::{Application, CreateApplication, UpdateApplication};
use rstify_core::repositories::ApplicationRepository;
use tokio::fs;
use uuid::Uuid;

use crate::error::ApiError;
use crate::extractors::auth::AuthUser;
use crate::state::AppState;
use crate::utils::sanitize_filename;

/// Maximum icon size: 1 MiB
const MAX_ICON_SIZE: usize = 1024 * 1024;

/// Allowed content types for icons
const ALLOWED_ICON_TYPES: &[&str] = &[
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/svg+xml",
    "image/webp",
];

#[utoipa::path(get, path = "/application", responses((status = 200, body = Vec<Application>)))]
pub async fn list_applications(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<Application>>, ApiError> {
    let apps = state
        .app_repo
        .list_by_user(auth.user.id)
        .await
        .map_err(ApiError::from)?;
    Ok(Json(apps))
}

#[utoipa::path(
    post,
    path = "/application",
    request_body = CreateApplication,
    responses((status = 201, body = Application))
)]
pub async fn create_application(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<CreateApplication>,
) -> Result<Json<Application>, ApiError> {
    let name = req.name.trim();
    if name.is_empty() || name.len() > 128 {
        return Err(ApiError::from(rstify_core::error::CoreError::Validation(
            "Application name must be between 1 and 128 characters".to_string(),
        )));
    }

    let token = generate_app_token();
    let app = state
        .app_repo
        .create(
            auth.user.id,
            name,
            req.description.as_deref(),
            &token,
            req.default_priority.unwrap_or(5),
        )
        .await
        .map_err(ApiError::from)?;
    Ok(Json(app))
}

#[utoipa::path(
    put,
    path = "/application/{id}",
    request_body = UpdateApplication,
    responses((status = 200, body = Application))
)]
pub async fn update_application(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<i64>,
    Json(req): Json<UpdateApplication>,
) -> Result<Json<Application>, ApiError> {
    // Verify ownership
    let existing = state
        .app_repo
        .find_by_id(id)
        .await
        .map_err(ApiError::from)?
        .ok_or_else(|| {
            ApiError::from(rstify_core::error::CoreError::NotFound(
                "Application not found".to_string(),
            ))
        })?;

    if existing.user_id != auth.user.id && !auth.user.is_admin {
        return Err(ApiError::from(rstify_core::error::CoreError::Forbidden(
            "Not your application".to_string(),
        )));
    }

    let app = state
        .app_repo
        .update(
            id,
            req.name.as_deref(),
            req.description.as_deref(),
            req.default_priority,
        )
        .await
        .map_err(ApiError::from)?;
    Ok(Json(app))
}

#[utoipa::path(delete, path = "/application/{id}", responses((status = 200)))]
pub async fn delete_application(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<i64>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let existing = state
        .app_repo
        .find_by_id(id)
        .await
        .map_err(ApiError::from)?
        .ok_or_else(|| {
            ApiError::from(rstify_core::error::CoreError::NotFound(
                "Application not found".to_string(),
            ))
        })?;

    if existing.user_id != auth.user.id && !auth.user.is_admin {
        return Err(ApiError::from(rstify_core::error::CoreError::Forbidden(
            "Not your application".to_string(),
        )));
    }

    // Clean up icon file if present
    if let Some(ref image) = existing.image {
        let icon_path = format!("{}/{}", state.upload_dir, image);
        let _ = fs::remove_file(&icon_path).await;
    }

    state.app_repo.delete(id).await.map_err(ApiError::from)?;
    Ok(Json(serde_json::json!({"success": true})))
}

#[utoipa::path(
    post,
    path = "/application/{id}/icon",
    responses((status = 200, body = Application))
)]
pub async fn upload_icon(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<i64>,
    mut multipart: Multipart,
) -> Result<Json<Application>, ApiError> {
    let existing = state
        .app_repo
        .find_by_id(id)
        .await
        .map_err(ApiError::from)?
        .ok_or_else(|| {
            ApiError::from(rstify_core::error::CoreError::NotFound(
                "Application not found".to_string(),
            ))
        })?;

    if existing.user_id != auth.user.id && !auth.user.is_admin {
        return Err(ApiError::from(rstify_core::error::CoreError::Forbidden(
            "Not your application".to_string(),
        )));
    }

    let icons_dir = format!("{}/icons", state.upload_dir);
    fs::create_dir_all(&icons_dir).await.map_err(|e| {
        ApiError::from(rstify_core::error::CoreError::Internal(format!(
            "Failed to create icons dir: {}",
            e
        )))
    })?;

    let field = multipart
        .next_field()
        .await
        .map_err(|e| {
            ApiError::from(rstify_core::error::CoreError::Validation(format!(
                "Multipart error: {}",
                e
            )))
        })?
        .ok_or_else(|| {
            ApiError::from(rstify_core::error::CoreError::Validation(
                "No file provided".to_string(),
            ))
        })?;

    let content_type = field.content_type().map(|s| s.to_string());
    if let Some(ref ct) = content_type {
        if !ALLOWED_ICON_TYPES.contains(&ct.as_str()) {
            return Err(ApiError::from(rstify_core::error::CoreError::Validation(
                format!("Invalid content type: {}. Allowed: PNG, JPEG, GIF, SVG, WebP", ct),
            )));
        }
    }

    let raw_filename = field.file_name().unwrap_or("icon").to_string();
    let filename = sanitize_filename(&raw_filename);
    let data = field.bytes().await.map_err(|e| {
        ApiError::from(rstify_core::error::CoreError::Internal(format!(
            "Failed to read file: {}",
            e
        )))
    })?;

    if data.len() > MAX_ICON_SIZE {
        return Err(ApiError::from(rstify_core::error::CoreError::Validation(
            format!(
                "Icon too large: {} bytes (max {} bytes)",
                data.len(),
                MAX_ICON_SIZE
            ),
        )));
    }

    // Delete old icon file if present
    if let Some(ref old_image) = existing.image {
        let old_path = format!("{}/{}", state.upload_dir, old_image);
        let _ = fs::remove_file(&old_path).await;
    }

    let storage_filename = format!("{}_{}", Uuid::new_v4(), filename);
    let relative_path = format!("icons/{}", storage_filename);
    let full_path = format!("{}/{}", state.upload_dir, relative_path);

    fs::write(&full_path, &data).await.map_err(|e| {
        ApiError::from(rstify_core::error::CoreError::Internal(format!(
            "Failed to write icon: {}",
            e
        )))
    })?;

    let app = state
        .app_repo
        .update_image(id, Some(&relative_path))
        .await
        .map_err(ApiError::from)?;

    Ok(Json(app))
}

#[utoipa::path(
    get,
    path = "/application/{id}/icon",
    responses((status = 200))
)]
pub async fn get_icon(
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Result<impl IntoResponse, ApiError> {
    let app = state
        .app_repo
        .find_by_id(id)
        .await
        .map_err(ApiError::from)?
        .ok_or_else(|| {
            ApiError::from(rstify_core::error::CoreError::NotFound(
                "Application not found".to_string(),
            ))
        })?;

    let image = app.image.ok_or_else(|| {
        ApiError::from(rstify_core::error::CoreError::NotFound(
            "Application has no icon".to_string(),
        ))
    })?;

    let full_path = format!("{}/{}", state.upload_dir, image);
    let data = fs::read(&full_path).await.map_err(|e| {
        ApiError::from(rstify_core::error::CoreError::Internal(format!(
            "Failed to read icon: {}",
            e
        )))
    })?;

    let content_type = mime_guess::from_path(&image)
        .first_or_octet_stream()
        .to_string();

    Ok((
        [
            (header::CONTENT_TYPE, content_type),
            (
                header::CACHE_CONTROL,
                "public, max-age=86400".to_string(),
            ),
        ],
        data,
    ))
}

#[utoipa::path(
    delete,
    path = "/application/{id}/icon",
    responses((status = 200))
)]
pub async fn delete_icon(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<i64>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let existing = state
        .app_repo
        .find_by_id(id)
        .await
        .map_err(ApiError::from)?
        .ok_or_else(|| {
            ApiError::from(rstify_core::error::CoreError::NotFound(
                "Application not found".to_string(),
            ))
        })?;

    if existing.user_id != auth.user.id && !auth.user.is_admin {
        return Err(ApiError::from(rstify_core::error::CoreError::Forbidden(
            "Not your application".to_string(),
        )));
    }

    if let Some(ref image) = existing.image {
        let icon_path = format!("{}/{}", state.upload_dir, image);
        let _ = fs::remove_file(&icon_path).await;
    }

    state
        .app_repo
        .update_image(id, None)
        .await
        .map_err(ApiError::from)?;

    Ok(Json(serde_json::json!({"success": true})))
}
