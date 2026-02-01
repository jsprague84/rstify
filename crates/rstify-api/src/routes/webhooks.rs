use axum::extract::{Path, State};
use axum::Json;
use rstify_auth::tokens::generate_webhook_token;
use rstify_core::models::{CreateWebhookConfig, UpdateWebhookConfig, WebhookConfig};
use rstify_core::repositories::{MessageRepository, TopicRepository};

use crate::error::ApiError;
use crate::extractors::auth::AuthUser;
use crate::state::AppState;

#[utoipa::path(
    post,
    path = "/api/webhooks",
    request_body = CreateWebhookConfig,
    responses((status = 201, body = WebhookConfig))
)]
pub async fn create_webhook(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<CreateWebhookConfig>,
) -> Result<Json<WebhookConfig>, ApiError> {
    let token = generate_webhook_token();
    let template_json = serde_json::to_string(&req.template).unwrap_or_default();

    let config = state
        .message_repo
        .create_webhook_config(
            auth.user.id,
            &req.name,
            &token,
            &req.webhook_type,
            req.target_topic_id,
            req.target_application_id,
            &template_json,
            req.enabled.unwrap_or(true),
        )
        .await
        .map_err(ApiError::from)?;
    Ok(Json(config))
}

#[utoipa::path(get, path = "/api/webhooks", responses((status = 200, body = Vec<WebhookConfig>)))]
pub async fn list_webhooks(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<WebhookConfig>>, ApiError> {
    let configs = state
        .message_repo
        .list_webhook_configs_by_user(auth.user.id)
        .await
        .map_err(ApiError::from)?;
    Ok(Json(configs))
}

#[utoipa::path(
    put,
    path = "/api/webhooks/{id}",
    request_body = UpdateWebhookConfig,
    responses((status = 200, body = WebhookConfig))
)]
pub async fn update_webhook(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<i64>,
    Json(req): Json<UpdateWebhookConfig>,
) -> Result<Json<WebhookConfig>, ApiError> {
    let existing = state
        .message_repo
        .find_webhook_config_by_id(id)
        .await
        .map_err(ApiError::from)?
        .ok_or_else(|| {
            ApiError::from(rstify_core::error::CoreError::NotFound(
                "Webhook config not found".to_string(),
            ))
        })?;

    if existing.user_id != auth.user.id && !auth.user.is_admin {
        return Err(ApiError::from(rstify_core::error::CoreError::Forbidden(
            "Not your webhook config".to_string(),
        )));
    }

    let template_json = req
        .template
        .as_ref()
        .map(|t| serde_json::to_string(t).unwrap_or_default());

    let config = state
        .message_repo
        .update_webhook_config(id, req.name.as_deref(), template_json.as_deref(), req.enabled)
        .await
        .map_err(ApiError::from)?;
    Ok(Json(config))
}

#[utoipa::path(delete, path = "/api/webhooks/{id}", responses((status = 200)))]
pub async fn delete_webhook(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<i64>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let existing = state
        .message_repo
        .find_webhook_config_by_id(id)
        .await
        .map_err(ApiError::from)?
        .ok_or_else(|| {
            ApiError::from(rstify_core::error::CoreError::NotFound(
                "Webhook config not found".to_string(),
            ))
        })?;

    if existing.user_id != auth.user.id && !auth.user.is_admin {
        return Err(ApiError::from(rstify_core::error::CoreError::Forbidden(
            "Not your webhook config".to_string(),
        )));
    }

    state
        .message_repo
        .delete_webhook_config(id)
        .await
        .map_err(ApiError::from)?;
    Ok(Json(serde_json::json!({"success": true})))
}

/// POST /api/wh/{token} - Receive incoming webhook
#[utoipa::path(post, path = "/api/wh/{token}", responses((status = 200)))]
pub async fn receive_webhook(
    State(state): State<AppState>,
    Path(token): Path<String>,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let config = state
        .message_repo
        .find_webhook_config_by_token(&token)
        .await
        .map_err(ApiError::from)?
        .ok_or_else(|| {
            ApiError::from(rstify_core::error::CoreError::NotFound(
                "Webhook not found".to_string(),
            ))
        })?;

    if !config.enabled {
        return Err(ApiError::from(rstify_core::error::CoreError::Forbidden(
            "Webhook is disabled".to_string(),
        )));
    }

    // Extract message from payload based on webhook type
    let (title, message) = match config.webhook_type.as_str() {
        "github" => {
            let action = payload
                .get("action")
                .and_then(|v| v.as_str())
                .unwrap_or("event");
            let repo = payload
                .get("repository")
                .and_then(|r| r.get("full_name"))
                .and_then(|v| v.as_str())
                .unwrap_or("unknown");
            (
                Some(format!("GitHub: {} on {}", action, repo)),
                serde_json::to_string_pretty(&payload).unwrap_or_default(),
            )
        }
        "grafana" => {
            let title = payload
                .get("title")
                .and_then(|v| v.as_str())
                .unwrap_or("Grafana Alert")
                .to_string();
            let message = payload
                .get("message")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            (Some(title), message)
        }
        _ => {
            let title = payload
                .get("title")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let message = payload
                .get("message")
                .and_then(|v| v.as_str())
                .unwrap_or(&serde_json::to_string_pretty(&payload).unwrap_or_default())
                .to_string();
            (title, message)
        }
    };

    // Create message targeting topic or application
    let msg = state
        .message_repo
        .create(
            config.target_application_id,
            config.target_topic_id,
            Some(config.user_id),
            title.as_deref(),
            &message,
            5,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
        )
        .await
        .map_err(ApiError::from)?;

    // Broadcast to appropriate channel
    if let Some(topic_id) = config.target_topic_id {
        if let Ok(Some(topic)) = state.topic_repo.find_by_id(topic_id).await {
            state
                .connections
                .broadcast_to_topic(&topic.name, msg.to_response(Some(topic.name.clone())))
                .await;
        }
    }

    Ok(Json(serde_json::json!({"success": true, "message_id": msg.id})))
}
