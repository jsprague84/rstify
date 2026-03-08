use axum::extract::{Path, Query, State};
use axum::http::HeaderMap;
use axum::Json;
use rstify_auth::tokens::generate_webhook_token;
use rstify_core::models::{
    CreateWebhookConfig, MessageResponse, UpdateWebhookConfig, WebhookConfig, WebhookDeliveryLog,
};
use rstify_core::repositories::{MessageRepository, TopicRepository};
use rstify_jobs::outgoing_webhooks::fire_single_outgoing_webhook;
use serde::{Deserialize, Serialize};

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
        )
        .await
        .map_err(ApiError::from)?;
    Ok(Json(config))
}

#[derive(Serialize, utoipa::ToSchema)]
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
            Some("webhook"),
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

#[derive(Deserialize)]
pub struct DeliveryLogParams {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub success: Option<bool>,
}

/// GET /api/webhooks/{id}/deliveries - List recent delivery attempts
#[utoipa::path(
    get,
    path = "/api/webhooks/{id}/deliveries",
    responses((status = 200, body = Vec<WebhookDeliveryLog>))
)]
pub async fn list_webhook_deliveries(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<i64>,
    Query(params): Query<DeliveryLogParams>,
) -> Result<Json<Vec<WebhookDeliveryLog>>, ApiError> {
    // Verify ownership
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

    let limit = params.limit.unwrap_or(20).clamp(1, 100);
    let offset = params.offset.unwrap_or(0).max(0);

    let logs = if let Some(success) = params.success {
        sqlx::query_as::<_, WebhookDeliveryLog>(
            "SELECT * FROM webhook_delivery_log WHERE webhook_config_id = ? AND success = ? ORDER BY attempted_at DESC LIMIT ? OFFSET ?",
        )
        .bind(id)
        .bind(success)
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.pool)
        .await
    } else {
        sqlx::query_as::<_, WebhookDeliveryLog>(
            "SELECT * FROM webhook_delivery_log WHERE webhook_config_id = ? ORDER BY attempted_at DESC LIMIT ? OFFSET ?",
        )
        .bind(id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.pool)
        .await
    }
    .map_err(|e| ApiError::from(rstify_core::error::CoreError::Database(e.to_string())))?;

    Ok(Json(logs))
}

#[derive(Deserialize, Default, utoipa::ToSchema)]
pub struct TestWebhookPayload {
    pub title: Option<String>,
    pub message: Option<String>,
    pub priority: Option<i32>,
    pub topic: Option<String>,
}

/// POST /api/webhooks/{id}/test - Send a test delivery for a webhook
#[utoipa::path(post, path = "/api/webhooks/{id}/test", responses((status = 200)))]
pub async fn test_webhook(
    State(state): State<AppState>,
    auth: AuthUser,
    headers: HeaderMap,
    Path(id): Path<i64>,
    payload: Option<Json<TestWebhookPayload>>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let payload = payload.map(|p| p.0).unwrap_or_default();
    let host = headers
        .get("host")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("localhost");
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

    if existing.direction == "outgoing" {
        // Fire a test HTTP request to the target URL
        let test_message = MessageResponse {
            id: 0,
            appid: None,
            topic: payload
                .topic
                .or_else(|| existing.target_topic_id.map(|_| "test-topic".to_string())),
            title: Some(payload.title.unwrap_or_else(|| "Test Webhook".to_string())),
            message: payload.message.unwrap_or_else(|| {
                "This is a test message from rstify webhook system.".to_string()
            }),
            priority: payload.priority.unwrap_or(5),
            tags: None,
            click_url: None,
            icon_url: None,
            actions: None,
            content_type: None,
            extras: None,
            source: Some("webhook-test".to_string()),
            attachments: None,
            date: chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string(),
        };

        let result = fire_single_outgoing_webhook(&state.pool, &existing, &test_message).await;

        match result {
            Ok(detail) => {
                let success = (200..300).contains(&(detail.status as i32));
                Ok(Json(serde_json::json!({
                    "success": success,
                    "direction": "outgoing",
                    "status_code": detail.status,
                    "response_preview": detail.response_body,
                    "response_headers": detail.response_headers,
                    "duration_ms": detail.duration_ms,
                })))
            }
            Err(err) => Ok(Json(serde_json::json!({
                "success": false,
                "direction": "outgoing",
                "error": err,
            }))),
        }
    } else {
        // For incoming webhooks, return the URL and a sample curl command
        let webhook_url = format!("https://{}/api/wh/{}", host, existing.token);
        let curl_cmd = format!(
            r#"curl -X POST {} -H "Content-Type: application/json" -d '{{"title":"Test","message":"Hello from webhook test"}}'"#,
            webhook_url
        );
        Ok(Json(serde_json::json!({
            "success": true,
            "direction": "incoming",
            "webhook_url": webhook_url,
            "curl_example": curl_cmd,
        })))
    }
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
