use serde::{Deserialize, Serialize};
use std::sync::LazyLock;
use std::time::Duration;
use tracing::info;

/// Shared HTTP client for all webhook calls. Reuses connections and thread pool.
static HTTP_CLIENT: LazyLock<reqwest::Client> = LazyLock::new(|| {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .connect_timeout(Duration::from_secs(10))
        .build()
        .expect("failed to build HTTP client")
});

#[derive(Debug, Serialize, Deserialize)]
pub struct OutgoingWebhook {
    pub url: String,
    pub method: String,
    pub headers: Option<serde_json::Value>,
    pub body: Option<String>,
}

/// Execute an outgoing HTTP webhook call
pub async fn execute_webhook(webhook: &OutgoingWebhook) -> Result<(), reqwest::Error> {
    let client = &*HTTP_CLIENT;

    let mut request = match webhook.method.to_uppercase().as_str() {
        "POST" => client.post(&webhook.url),
        "PUT" => client.put(&webhook.url),
        "DELETE" => client.delete(&webhook.url),
        _ => client.get(&webhook.url),
    };

    if let Some(headers) = &webhook.headers {
        if let Some(obj) = headers.as_object() {
            for (key, value) in obj {
                if let Some(val) = value.as_str() {
                    request = request.header(key.as_str(), val);
                }
            }
        }
    }

    if let Some(body) = &webhook.body {
        request = request.body(body.clone());
    }

    let response = request.send().await?;
    info!(
        "Webhook to {} returned status {}",
        webhook.url,
        response.status()
    );
    Ok(())
}
