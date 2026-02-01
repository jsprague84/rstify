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
                  wc.max_retries, wc.retry_delay_secs
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

    let client = reqwest::Client::new();
    let message_json = serde_json::to_string(message).unwrap_or_default();

    for config in configs {
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
            _ => client.post(target_url).body(body.clone()),
        };

        // Add custom headers
        if let Some(ref headers_json) = config.headers {
            if let Ok(headers) = serde_json::from_str::<HashMap<String, String>>(headers_json) {
                for (key, value) in headers {
                    req = req.header(&key, &value);
                }
            }
        }

        // Default content-type for body methods
        if config.http_method != "GET" {
            req = req.header("Content-Type", "application/json");
        }

        let url = target_url.clone();
        let max_retries = config.max_retries;
        let retry_delay = config.retry_delay_secs;
        let id = config.id;

        tokio::spawn(async move {
            for attempt in 0..=max_retries {
                match req.try_clone().unwrap().send().await {
                    Ok(resp) if resp.status().is_success() => {
                        info!("Outgoing webhook {} fired to {} (attempt {})", id, url, attempt + 1);
                        return;
                    }
                    Ok(resp) => {
                        warn!(
                            "Outgoing webhook {} to {} returned {}, attempt {}/{}",
                            id,
                            url,
                            resp.status(),
                            attempt + 1,
                            max_retries + 1
                        );
                    }
                    Err(e) => {
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

#[derive(sqlx::FromRow)]
struct OutgoingWebhookRow {
    id: i64,
    target_url: Option<String>,
    http_method: String,
    headers: Option<String>,
    body_template: Option<String>,
    max_retries: i32,
    retry_delay_secs: i32,
}
