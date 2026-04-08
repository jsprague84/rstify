use axum::extract::{Path, Query, State};
use axum::http::HeaderMap;
use axum::Json;
use rstify_core::models::{MessageResponse, WebhookDeliveryLog};
use rstify_core::repositories::MessageRepository;
use rstify_jobs::outgoing_webhooks::fire_single_outgoing_webhook;
use serde::Deserialize;

use crate::error::ApiError;
use crate::extractors::auth::AuthUser;
use crate::state::AppState;

#[derive(Deserialize)]
pub struct DeliveryLogParams {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub success: Option<bool>,
    pub since: Option<String>,
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

    // Build dynamic WHERE clause
    let mut where_clauses = vec!["webhook_config_id = ?".to_string()];
    if params.success.is_some() {
        where_clauses.push("success = ?".to_string());
    }
    if params.since.is_some() {
        where_clauses.push("attempted_at >= ?".to_string());
    }
    let sql = format!(
        "SELECT * FROM webhook_delivery_log WHERE {} ORDER BY attempted_at DESC LIMIT ? OFFSET ?",
        where_clauses.join(" AND ")
    );

    let mut query = sqlx::query_as::<_, WebhookDeliveryLog>(&sql).bind(id);
    if let Some(success) = params.success {
        query = query.bind(success);
    }
    if let Some(ref since) = params.since {
        query = query.bind(since);
    }
    let logs = query
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.pool)
        .await
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
            inbox: true,
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
