use rstify_core::models::MessageResponse;
use sqlx::SqlitePool;
use std::collections::HashMap;
use tracing::{error, info, warn};

/// Fire outgoing webhooks for a given topic when a message is published.
/// Called from broadcast callback or directly from publish handlers.
pub async fn fire_outgoing_webhooks(
    pool: &SqlitePool,
    topic_name: &str,
    message: &MessageResponse,
) {
    // Find all enabled outgoing webhook configs targeting this topic
    let configs = match sqlx::query_as::<_, OutgoingWebhookRow>(
        r#"SELECT wc.id, wc.target_url, wc.http_method, wc.headers, wc.body_template,
                  wc.max_retries, wc.retry_delay_secs, wc.timeout_secs
           FROM webhook_configs wc
           JOIN topics t ON wc.target_topic_id = t.id
           WHERE wc.direction = 'outgoing'
             AND wc.enabled = 1
             AND t.name = ?"#,
    )
    .bind(topic_name)
    .fetch_all(pool)
    .await
    {
        Ok(configs) => configs,
        Err(e) => {
            error!("Failed to query outgoing webhooks: {}", e);
            return;
        }
    };

    let message_json = serde_json::to_string(message).unwrap_or_default();

    for config in configs {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(
                config.timeout_secs.max(1) as u64
            ))
            .build()
            .unwrap_or_default();
        let Some(ref target_url) = config.target_url else {
            warn!("Outgoing webhook {} has no target_url", config.id);
            continue;
        };

        let body = if let Some(ref tmpl) = config.body_template {
            // Simple template substitution
            tmpl.replace("{{message}}", &message.message)
                .replace("{{title}}", message.title.as_deref().unwrap_or(""))
                .replace("{{topic}}", message.topic.as_deref().unwrap_or(""))
                .replace("{{priority}}", &message.priority.to_string())
                .replace("{{json}}", &message_json)
        } else {
            message_json.clone()
        };

        let mut req = match config.http_method.as_str() {
            "GET" => client.get(target_url),
            "PUT" => client.put(target_url).body(body.clone()),
            "PATCH" => client.patch(target_url).body(body.clone()),
            "DELETE" => client.delete(target_url),
            _ => client.post(target_url).body(body.clone()),
        };

        // Add custom headers
        if let Some(ref headers_json) = config.headers {
            if let Ok(headers) = serde_json::from_str::<HashMap<String, String>>(headers_json) {
                for (key, value) in &headers {
                    req = req.header(key, value);
                }
            }
        }

        // Default content-type for body methods (only if user didn't set one)
        if config.http_method != "GET" && !headers_contain_content_type(config.headers.as_deref()) {
            req = req.header("Content-Type", "application/json");
        }

        let url = target_url.clone();
        let max_retries = config.max_retries;
        let retry_delay = config.retry_delay_secs;
        let id = config.id;
        let msg_id = message.id;
        let log_pool = pool.clone();

        tokio::spawn(async move {
            for attempt in 0..=max_retries {
                let start = std::time::Instant::now();
                let result = req.try_clone().unwrap().send().await;
                let duration_ms = start.elapsed().as_millis() as i64;

                match result {
                    Ok(resp) => {
                        let status = resp.status().as_u16() as i32;
                        let success = resp.status().is_success();
                        let body_preview = resp
                            .text()
                            .await
                            .ok()
                            .map(|t| t.chars().take(512).collect::<String>());

                        log_delivery(
                            &log_pool,
                            id,
                            Some(msg_id),
                            Some(status),
                            body_preview.as_deref(),
                            duration_ms,
                            success,
                        )
                        .await;

                        if success {
                            info!(
                                "Outgoing webhook {} fired to {} (attempt {})",
                                id,
                                url,
                                attempt + 1
                            );
                            return;
                        }
                        warn!(
                            "Outgoing webhook {} to {} returned {}, attempt {}/{}",
                            id,
                            url,
                            status,
                            attempt + 1,
                            max_retries + 1
                        );
                    }
                    Err(e) => {
                        log_delivery(
                            &log_pool,
                            id,
                            Some(msg_id),
                            None,
                            Some(&e.to_string()),
                            duration_ms,
                            false,
                        )
                        .await;

                        warn!(
                            "Outgoing webhook {} to {} failed: {}, attempt {}/{}",
                            id,
                            url,
                            e,
                            attempt + 1,
                            max_retries + 1
                        );
                    }
                }

                if attempt < max_retries {
                    tokio::time::sleep(std::time::Duration::from_secs(retry_delay as u64)).await;
                }
            }
            error!("Outgoing webhook {} to {} exhausted all retries", id, url);
        });
    }
}

async fn log_delivery(
    pool: &SqlitePool,
    webhook_config_id: i64,
    message_id: Option<i64>,
    status_code: Option<i32>,
    response_body_preview: Option<&str>,
    duration_ms: i64,
    success: bool,
) {
    if let Err(e) = sqlx::query(
        "INSERT INTO webhook_delivery_log (webhook_config_id, message_id, status_code, response_body_preview, duration_ms, success) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(webhook_config_id)
    .bind(message_id)
    .bind(status_code)
    .bind(response_body_preview)
    .bind(duration_ms)
    .bind(success)
    .execute(pool)
    .await
    {
        error!("Failed to log webhook delivery: {}", e);
    }
}

/// Fire a single outgoing webhook synchronously (for test endpoint).
/// Returns (status_code, response_body_preview) on success or error string on failure.
pub async fn fire_single_outgoing_webhook(
    pool: &SqlitePool,
    config: &rstify_core::models::WebhookConfig,
    message: &MessageResponse,
) -> Result<(u16, Option<String>), String> {
    let target_url = config
        .target_url
        .as_deref()
        .ok_or("No target_url configured")?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(
            config.timeout_secs.max(1) as u64
        ))
        .build()
        .unwrap_or_default();

    let message_json = serde_json::to_string(message).unwrap_or_default();

    let body = if let Some(ref tmpl) = config.body_template {
        tmpl.replace("{{message}}", &message.message)
            .replace("{{title}}", message.title.as_deref().unwrap_or(""))
            .replace("{{topic}}", message.topic.as_deref().unwrap_or(""))
            .replace("{{priority}}", &message.priority.to_string())
            .replace("{{json}}", &message_json)
    } else {
        message_json
    };

    let mut req = match config.http_method.as_str() {
        "GET" => client.get(target_url),
        "PUT" => client.put(target_url).body(body.clone()),
        "PATCH" => client.patch(target_url).body(body.clone()),
        "DELETE" => client.delete(target_url),
        _ => client.post(target_url).body(body.clone()),
    };

    if let Some(ref headers_json) = config.headers {
        if let Ok(headers) = serde_json::from_str::<HashMap<String, String>>(headers_json) {
            for (key, value) in &headers {
                req = req.header(key, value);
            }
        }
    }

    if config.http_method != "GET" && !headers_contain_content_type(config.headers.as_deref()) {
        req = req.header("Content-Type", "application/json");
    }

    let start = std::time::Instant::now();
    let result = req.send().await;
    let duration_ms = start.elapsed().as_millis() as i64;

    match result {
        Ok(resp) => {
            let status = resp.status().as_u16();
            let success = resp.status().is_success();
            let body_preview = resp
                .text()
                .await
                .ok()
                .map(|t| t.chars().take(512).collect::<String>());

            log_delivery(
                pool,
                config.id,
                None,
                Some(status as i32),
                body_preview.as_deref(),
                duration_ms,
                success,
            )
            .await;

            if success {
                Ok((status, body_preview))
            } else {
                Err(format!(
                    "HTTP {} - {}",
                    status,
                    body_preview.unwrap_or_default()
                ))
            }
        }
        Err(e) => {
            log_delivery(
                pool,
                config.id,
                None,
                None,
                Some(&e.to_string()),
                duration_ms,
                false,
            )
            .await;
            Err(e.to_string())
        }
    }
}

/// Check if a headers JSON string contains a Content-Type header (case-insensitive).
fn headers_contain_content_type(headers_json: Option<&str>) -> bool {
    let Some(json) = headers_json else {
        return false;
    };
    let Ok(headers) = serde_json::from_str::<HashMap<String, String>>(json) else {
        return false;
    };
    headers
        .keys()
        .any(|k| k.eq_ignore_ascii_case("content-type"))
}

#[derive(sqlx::FromRow)]
struct OutgoingWebhookRow {
    id: i64,
    target_url: Option<String>,
    http_method: String,
    headers: Option<String>,
    body_template: Option<String>,
    max_retries: i32,
    retry_delay_secs: i32,
    timeout_secs: i32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_headers_contain_content_type() {
        // No headers
        assert!(!headers_contain_content_type(None));

        // Empty JSON
        assert!(!headers_contain_content_type(Some("{}")));

        // Invalid JSON
        assert!(!headers_contain_content_type(Some("not json")));

        // Has Content-Type (exact case)
        assert!(headers_contain_content_type(Some(
            r#"{"Content-Type": "text/xml"}"#
        )));

        // Has content-type (lowercase)
        assert!(headers_contain_content_type(Some(
            r#"{"content-type": "text/plain"}"#
        )));

        // Has CONTENT-TYPE (uppercase)
        assert!(headers_contain_content_type(Some(
            r#"{"CONTENT-TYPE": "application/xml"}"#
        )));

        // Has other headers but not Content-Type
        assert!(!headers_contain_content_type(Some(
            r#"{"Authorization": "Bearer token123"}"#
        )));

        // Has Content-Type among other headers
        assert!(headers_contain_content_type(Some(
            r#"{"Authorization": "Bearer token123", "Content-Type": "text/xml"}"#
        )));
    }
}
