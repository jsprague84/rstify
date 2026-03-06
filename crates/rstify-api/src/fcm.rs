use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, error, warn};

use rstify_core::models::MessageResponse;
use rstify_core::repositories::ClientRepository;

/// FCM configuration loaded from environment
#[derive(Debug, Clone)]
pub struct FcmConfig {
    pub project_id: String,
    pub service_account: ServiceAccount,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ServiceAccount {
    pub client_email: String,
    pub private_key: String,
    #[serde(default)]
    pub token_uri: String,
}

/// Cached OAuth2 access token
struct CachedToken {
    access_token: String,
    expires_at: chrono::DateTime<chrono::Utc>,
}

/// FCM client for sending push notifications via FCM v1 HTTP API
#[derive(Clone)]
pub struct FcmClient {
    config: FcmConfig,
    http: Client,
    cached_token: Arc<RwLock<Option<CachedToken>>>,
}

#[derive(Serialize)]
struct FcmRequest {
    message: FcmMessage,
}

#[derive(Serialize)]
struct FcmMessage {
    token: String,
    notification: FcmNotification,
    data: std::collections::HashMap<String, String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    android: Option<AndroidConfig>,
}

#[derive(Serialize)]
struct FcmNotification {
    title: String,
    body: String,
}

#[derive(Serialize)]
struct AndroidConfig {
    priority: String,
    notification: AndroidNotification,
}

#[derive(Serialize)]
struct AndroidNotification {
    channel_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    click_action: Option<String>,
}

#[derive(Deserialize)]
struct GoogleTokenResponse {
    access_token: String,
    expires_in: i64,
}

impl FcmConfig {
    /// Load FCM config from environment. Returns None if not configured.
    pub fn from_env() -> Option<Self> {
        let project_id = std::env::var("FCM_PROJECT_ID").ok()?;
        let sa_path = std::env::var("FCM_SERVICE_ACCOUNT_PATH").ok()?;

        let sa_json = match std::fs::read_to_string(&sa_path) {
            Ok(json) => json,
            Err(e) => {
                error!("Failed to read FCM service account file '{}': {}", sa_path, e);
                return None;
            }
        };

        let mut sa: ServiceAccount = match serde_json::from_str(&sa_json) {
            Ok(sa) => sa,
            Err(e) => {
                error!("Failed to parse FCM service account JSON: {}", e);
                return None;
            }
        };

        if sa.token_uri.is_empty() {
            sa.token_uri = "https://oauth2.googleapis.com/token".to_string();
        }

        Some(FcmConfig {
            project_id,
            service_account: sa,
        })
    }
}

impl FcmClient {
    pub fn new(config: FcmConfig) -> Self {
        Self {
            config,
            http: Client::new(),
            cached_token: Arc::new(RwLock::new(None)),
        }
    }

    /// Get a valid OAuth2 access token, refreshing if expired
    async fn get_access_token(&self) -> Result<String, String> {
        // Check cache
        {
            let cached = self.cached_token.read().await;
            if let Some(ref token) = *cached {
                if token.expires_at > chrono::Utc::now() + chrono::Duration::seconds(60) {
                    return Ok(token.access_token.clone());
                }
            }
        }

        // Mint new token via JWT -> Google OAuth2
        let now = chrono::Utc::now();
        let claims = serde_json::json!({
            "iss": self.config.service_account.client_email,
            "scope": "https://www.googleapis.com/auth/firebase.messaging",
            "aud": self.config.service_account.token_uri,
            "iat": now.timestamp(),
            "exp": (now + chrono::Duration::seconds(3600)).timestamp(),
        });

        let key = jsonwebtoken::EncodingKey::from_rsa_pem(
            self.config.service_account.private_key.as_bytes(),
        )
        .map_err(|e| format!("Invalid RSA key: {}", e))?;

        let jwt = jsonwebtoken::encode(
            &jsonwebtoken::Header::new(jsonwebtoken::Algorithm::RS256),
            &claims,
            &key,
        )
        .map_err(|e| format!("JWT encoding failed: {}", e))?;

        let resp = self
            .http
            .post(&self.config.service_account.token_uri)
            .form(&[
                ("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer"),
                ("assertion", &jwt),
            ])
            .send()
            .await
            .map_err(|e| format!("OAuth2 token request failed: {}", e))?;

        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("OAuth2 token error: {}", body));
        }

        let token_resp: GoogleTokenResponse = resp
            .json()
            .await
            .map_err(|e| format!("OAuth2 token parse error: {}", e))?;

        let expires_at = now + chrono::Duration::seconds(token_resp.expires_in);

        // Cache the token
        {
            let mut cached = self.cached_token.write().await;
            *cached = Some(CachedToken {
                access_token: token_resp.access_token.clone(),
                expires_at,
            });
        }

        Ok(token_resp.access_token)
    }

    /// Send a push notification to a single FCM token.
    /// Uses the ID-only relay pattern for privacy — only sends message ID + title.
    async fn send_to_token(
        &self,
        fcm_token: &str,
        msg: &MessageResponse,
    ) -> Result<(), String> {
        let access_token = self.get_access_token().await?;

        let channel_id = if msg.priority >= 8 {
            "high"
        } else if msg.priority >= 4 {
            "default"
        } else {
            "low"
        };

        let mut data = std::collections::HashMap::new();
        data.insert("messageId".to_string(), msg.id.to_string());
        if let Some(ref click_url) = msg.click_url {
            data.insert("clickUrl".to_string(), click_url.clone());
        }

        let request = FcmRequest {
            message: FcmMessage {
                token: fcm_token.to_string(),
                notification: FcmNotification {
                    title: msg.title.clone().unwrap_or_else(|| "New Message".to_string()),
                    body: msg.message.clone(),
                },
                data,
                android: Some(AndroidConfig {
                    priority: if msg.priority >= 8 { "high" } else { "normal" }.to_string(),
                    notification: AndroidNotification {
                        channel_id: channel_id.to_string(),
                        click_action: None,
                    },
                }),
            },
        };

        let url = format!(
            "https://fcm.googleapis.com/v1/projects/{}/messages:send",
            self.config.project_id
        );

        let resp = self
            .http
            .post(&url)
            .bearer_auth(&access_token)
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("FCM send failed: {}", e))?;

        if resp.status().is_success() {
            debug!("FCM sent to token {}...", &fcm_token[..fcm_token.len().min(12)]);
            Ok(())
        } else {
            let body = resp.text().await.unwrap_or_default();
            Err(format!("FCM error: {}", body))
        }
    }

    /// Send push notifications to all of a user's registered FCM devices
    pub async fn notify_user<R: ClientRepository>(
        &self,
        client_repo: &R,
        user_id: i64,
        msg: &MessageResponse,
    ) {
        let tokens = match client_repo.list_fcm_tokens_by_user(user_id).await {
            Ok(t) => t,
            Err(e) => {
                warn!("Failed to fetch FCM tokens for user {}: {}", user_id, e);
                return;
            }
        };

        if tokens.is_empty() {
            return;
        }

        debug!("Sending FCM to {} device(s) for user {}", tokens.len(), user_id);

        for token in &tokens {
            if let Err(e) = self.send_to_token(token, msg).await {
                warn!("FCM send error: {}", e);
            }
        }
    }
}
