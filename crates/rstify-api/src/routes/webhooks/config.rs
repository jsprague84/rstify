use axum::body::Bytes;
use axum::extract::{Path, State};
use axum::http::HeaderMap;
use axum::Json;
use rstify_auth::tokens::generate_webhook_token;
use rstify_core::error::CoreError;
use rstify_core::models::{CreateWebhookConfig, UpdateWebhookConfig, WebhookConfig};
use rstify_core::repositories::{MessageRepository, TopicRepository};
use serde::Serialize;
use ts_rs::TS;

use crate::error::ApiError;
use crate::extractors::auth::AuthUser;
use crate::state::AppState;
use crate::utils::validate_webhook_url;

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
    // SSRF protection: validate outgoing webhook target URLs
    if let Some(ref url) = req.target_url {
        validate_webhook_url(url)
            .map_err(|e| ApiError::from(rstify_core::error::CoreError::Validation(e)))?;
    }

    let token = generate_webhook_token();
    let template_json = req
        .template
        .as_ref()
        .map(|t| serde_json::to_string(t).unwrap_or_default())
        .unwrap_or_default();

    // Field size limits
    if template_json.len() > 65_536 {
        return Err(ApiError::from(rstify_core::error::CoreError::Validation(
            "template exceeds 64KB limit".to_string(),
        )));
    }
    if let Some(ref headers) = req.headers {
        let headers_json = serde_json::to_string(headers).unwrap_or_default();
        if headers_json.len() > 8_192 {
            return Err(ApiError::from(rstify_core::error::CoreError::Validation(
                "headers exceeds 8KB limit".to_string(),
            )));
        }
    }

    let headers_json = req
        .headers
        .as_ref()
        .map(|h| serde_json::to_string(h).unwrap_or_default());

    let direction = req.direction.as_deref().unwrap_or("incoming");

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
            direction,
            req.target_url.as_deref(),
            req.http_method.as_deref(),
            headers_json.as_deref(),
            req.body_template.as_deref(),
            req.max_retries,
            req.retry_delay_secs,
            req.timeout_secs,
            req.follow_redirects,
            req.group_name.as_deref(),
            req.secret.as_deref(),
        )
        .await
        .map_err(ApiError::from)?;
    Ok(Json(config))
}

#[derive(Debug, Serialize, utoipa::ToSchema, TS)]
#[ts(export)]
pub struct WebhookConfigWithHealth {
    #[serde(flatten)]
    pub config: WebhookConfig,
    pub last_delivery_at: Option<String>,
    pub last_delivery_success: Option<bool>,
    pub recent_success_rate: Option<f64>,
    pub recent_durations: Option<Vec<i64>>,
}

#[derive(sqlx::FromRow)]
struct DurationRow {
    webhook_config_id: i64,
    duration_ms: i64,
}

#[derive(sqlx::FromRow)]
struct WebhookHealthRow {
    webhook_config_id: i64,
    last_delivery_at: Option<String>,
    last_delivery_success: Option<bool>,
    recent_success_rate: Option<f64>,
}

#[utoipa::path(get, path = "/api/webhooks", responses((status = 200, body = Vec<WebhookConfigWithHealth>)))]
pub async fn list_webhooks(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<WebhookConfigWithHealth>>, ApiError> {
    let configs = state
        .message_repo
        .list_webhook_configs_by_user(auth.user.id)
        .await
        .map_err(ApiError::from)?;

    // Fetch health data for all webhooks in one query
    let config_ids: Vec<i64> = configs.iter().map(|c| c.id).collect();
    let health_data: Vec<WebhookHealthRow> = if config_ids.is_empty() {
        vec![]
    } else {
        let placeholders: Vec<String> = config_ids.iter().map(|_| "?".to_string()).collect();
        let sql = format!(
            r#"SELECT
                webhook_config_id,
                MAX(attempted_at) as last_delivery_at,
                (SELECT success FROM webhook_delivery_log w2 WHERE w2.webhook_config_id = w1.webhook_config_id ORDER BY attempted_at DESC LIMIT 1) as last_delivery_success,
                CAST(SUM(CASE WHEN success THEN 1 ELSE 0 END) AS REAL) / COUNT(*) as recent_success_rate
            FROM (
                SELECT webhook_config_id, attempted_at, success,
                    ROW_NUMBER() OVER (PARTITION BY webhook_config_id ORDER BY attempted_at DESC) as rn
                FROM webhook_delivery_log
                WHERE webhook_config_id IN ({})
            ) w1
            WHERE rn <= 10
            GROUP BY webhook_config_id"#,
            placeholders.join(",")
        );
        let mut query = sqlx::query_as::<_, WebhookHealthRow>(&sql);
        for id in &config_ids {
            query = query.bind(id);
        }
        query.fetch_all(&state.pool).await.unwrap_or_default()
    };

    // Fetch recent durations (last 20 per webhook)
    let duration_data: Vec<DurationRow> = if config_ids.is_empty() {
        vec![]
    } else {
        let placeholders: Vec<String> = config_ids.iter().map(|_| "?".to_string()).collect();
        let sql = format!(
            r#"SELECT webhook_config_id, duration_ms FROM (
                SELECT webhook_config_id, duration_ms,
                    ROW_NUMBER() OVER (PARTITION BY webhook_config_id ORDER BY attempted_at DESC) as rn
                FROM webhook_delivery_log
                WHERE webhook_config_id IN ({})
            ) WHERE rn <= 20
            ORDER BY webhook_config_id, rn"#,
            placeholders.join(",")
        );
        let mut query = sqlx::query_as::<_, DurationRow>(&sql);
        for id in &config_ids {
            query = query.bind(id);
        }
        query.fetch_all(&state.pool).await.unwrap_or_default()
    };

    let mut durations_map: std::collections::HashMap<i64, Vec<i64>> =
        std::collections::HashMap::new();
    for row in &duration_data {
        durations_map
            .entry(row.webhook_config_id)
            .or_default()
            .push(row.duration_ms);
    }

    let health_map: std::collections::HashMap<i64, &WebhookHealthRow> = health_data
        .iter()
        .map(|h| (h.webhook_config_id, h))
        .collect();

    let result: Vec<WebhookConfigWithHealth> = configs
        .into_iter()
        .map(|config| {
            let health = health_map.get(&config.id);
            let durations = durations_map.remove(&config.id);
            WebhookConfigWithHealth {
                last_delivery_at: health.and_then(|h| h.last_delivery_at.clone()),
                last_delivery_success: health.and_then(|h| h.last_delivery_success),
                recent_success_rate: health.map(|h| h.recent_success_rate.unwrap_or(0.0)),
                recent_durations: durations,
                config,
            }
        })
        .collect();

    Ok(Json(result))
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

    // SSRF protection: validate outgoing webhook target URLs
    if let Some(ref url) = req.target_url {
        validate_webhook_url(url)
            .map_err(|e| ApiError::from(rstify_core::error::CoreError::Validation(e)))?;
    }

    let template_json = req
        .template
        .as_ref()
        .map(|t| serde_json::to_string(t).unwrap_or_default());

    // Field size limits
    if let Some(ref tj) = template_json {
        if tj.len() > 65_536 {
            return Err(ApiError::from(rstify_core::error::CoreError::Validation(
                "template exceeds 64KB limit".to_string(),
            )));
        }
    }
    if let Some(ref headers) = req.headers {
        let headers_json = serde_json::to_string(headers).unwrap_or_default();
        if headers_json.len() > 8_192 {
            return Err(ApiError::from(rstify_core::error::CoreError::Validation(
                "headers exceeds 8KB limit".to_string(),
            )));
        }
    }

    let headers_json = req
        .headers
        .as_ref()
        .map(|h| serde_json::to_string(h).unwrap_or_default());

    let config = state
        .message_repo
        .update_webhook_config(
            id,
            req.name.as_deref(),
            template_json.as_deref(),
            req.enabled,
            req.target_url.as_deref(),
            req.http_method.as_deref(),
            headers_json.as_deref(),
            req.body_template.as_deref(),
            req.max_retries,
            req.retry_delay_secs,
            req.timeout_secs,
            req.follow_redirects,
            req.group_name.as_deref(),
            req.secret.as_deref(),
        )
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
#[utoipa::path(
    post,
    path = "/api/wh/{token}",
    request_body(content = inline(String), content_type = "application/json"),
    responses((status = 200))
)]
pub async fn receive_webhook(
    State(state): State<AppState>,
    Path(token): Path<String>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<serde_json::Value>, ApiError> {
    let config = state
        .message_repo
        .find_webhook_config_by_token(&token)
        .await
        .map_err(ApiError::from)?
        .ok_or_else(|| ApiError::from(CoreError::NotFound("Webhook not found".to_string())))?;

    if !config.enabled {
        return Err(ApiError::from(CoreError::Forbidden(
            "Webhook is disabled".to_string(),
        )));
    }

    let payload: serde_json::Value = serde_json::from_slice(&body)
        .map_err(|_| ApiError::from(CoreError::Validation("Invalid JSON body".to_string())))?;

    // Extract message from payload based on webhook type
    let (title, message, priority, click_url, tags_json, extras_json) = match config
        .webhook_type
        .as_str()
    {
        "forgejo" | "gitea" => {
            if let Some(ref secret) = config.secret {
                if !secret.is_empty() {
                    let sig = headers
                        .get("X-Gitea-Signature")
                        .or_else(|| headers.get("X-Forgejo-Signature"))
                        .and_then(|v| v.to_str().ok())
                        .unwrap_or("");
                    if sig.is_empty()
                        || !crate::webhooks::signature::verify_gitea_signature(secret, &body, sig)
                    {
                        return Err(ApiError::from(CoreError::Forbidden(
                            "Invalid webhook signature".to_string(),
                        )));
                    }
                }
            }
            let event = headers
                .get("X-Gitea-Event")
                .or_else(|| headers.get("X-Forgejo-Event"))
                .and_then(|v| v.to_str().ok())
                .unwrap_or("unknown");
            let output = crate::webhooks::forgejo::parse_forgejo_event(event, &body);
            let tags = output.tags_json();
            let extras = output.extras_json();
            (
                Some(output.title),
                output.message,
                output.priority,
                output.click_url,
                tags,
                extras,
            )
        }
        "github" => {
            if let Some(ref secret) = config.secret {
                if !secret.is_empty() {
                    let sig = headers
                        .get("X-Hub-Signature-256")
                        .and_then(|v| v.to_str().ok())
                        .unwrap_or("");
                    if sig.is_empty()
                        || !crate::webhooks::signature::verify_github_signature(secret, &body, sig)
                    {
                        return Err(ApiError::from(CoreError::Forbidden(
                            "Invalid webhook signature".to_string(),
                        )));
                    }
                }
            }
            let event = headers
                .get("X-GitHub-Event")
                .and_then(|v| v.to_str().ok())
                .unwrap_or("unknown");
            let output = crate::webhooks::github::parse_github_event(event, &body);
            let tags = output.tags_json();
            let extras = output.extras_json();
            (
                Some(output.title),
                output.message,
                output.priority,
                output.click_url,
                tags,
                extras,
            )
        }
        "grafana" => {
            let title = payload
                .get("title")
                .and_then(|v| v.as_str())
                .map(String::from);
            let message = payload
                .get("message")
                .and_then(|v| v.as_str())
                .unwrap_or("Grafana alert")
                .to_string();
            (title, message, 5i32, None, None, None)
        }
        _ => {
            let title = payload
                .get("title")
                .and_then(|v| v.as_str())
                .map(String::from);
            let message = payload
                .get("message")
                .and_then(|v| v.as_str())
                .or_else(|| payload.get("text").and_then(|v| v.as_str()))
                .unwrap_or("Webhook received")
                .to_string();
            (title, message, 5i32, None, None, None)
        }
    };

    // Determine content_type from extras
    let content_type = if extras_json.is_some() {
        Some("text/markdown")
    } else {
        None
    };

    // Determine inbox flag
    let inbox = if let Some(topic_id) = config.target_topic_id {
        if let Ok(Some(topic)) = state.topic_repo.find_by_id(topic_id).await {
            let threshold = state
                .inbox_threshold
                .load(std::sync::atomic::Ordering::Relaxed);
            rstify_core::policy::should_inbox(&topic, priority, threshold)
        } else {
            true
        }
    } else {
        true // app-targeted webhooks always go to inbox
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
            priority,
            tags_json.as_deref(),
            click_url.as_deref(),
            None,
            None,
            extras_json.as_deref(),
            content_type,
            None,
            Some("webhook"),
            inbox,
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

    Ok(Json(
        serde_json::json!({"success": true, "message_id": msg.id}),
    ))
}

/// POST /api/webhooks/{id}/regenerate-token - Regenerate webhook token
#[utoipa::path(post, path = "/api/webhooks/{id}/regenerate-token", responses((status = 200, body = WebhookConfig)))]
pub async fn regenerate_webhook_token(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<i64>,
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

    let new_token = generate_webhook_token();
    let updated = state
        .message_repo
        .regenerate_webhook_token(id, &new_token)
        .await
        .map_err(ApiError::from)?;

    Ok(Json(updated))
}
