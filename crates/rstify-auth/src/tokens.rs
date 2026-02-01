use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Error)]
pub enum TokenError {
    #[error("Token creation failed: {0}")]
    Creation(String),
    #[error("Token validation failed: {0}")]
    Validation(String),
    #[error("Token expired")]
    Expired,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: i64,
    pub username: String,
    pub is_admin: bool,
    pub exp: i64,
    pub iat: i64,
}

/// Generate a prefixed app token: AP_<uuid>
pub fn generate_app_token() -> String {
    format!("AP_{}", Uuid::new_v4().to_string().replace('-', ""))
}

/// Generate a prefixed client token: CL_<uuid>
pub fn generate_client_token() -> String {
    format!("CL_{}", Uuid::new_v4().to_string().replace('-', ""))
}

/// Generate a webhook token: WH_<uuid>
pub fn generate_webhook_token() -> String {
    format!("WH_{}", Uuid::new_v4().to_string().replace('-', ""))
}

/// Create a JWT session token
pub fn create_jwt(
    user_id: i64,
    username: &str,
    is_admin: bool,
    secret: &str,
) -> Result<String, TokenError> {
    let now = Utc::now();
    let exp = now + Duration::hours(24);
    let claims = Claims {
        sub: user_id,
        username: username.to_string(),
        is_admin,
        exp: exp.timestamp(),
        iat: now.timestamp(),
    };
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| TokenError::Creation(e.to_string()))
}

/// Validate and decode a JWT
pub fn validate_jwt(token: &str, secret: &str) -> Result<Claims, TokenError> {
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )
    .map_err(|e| TokenError::Validation(e.to_string()))?;
    Ok(token_data.claims)
}

/// Determine the type of token from its prefix
pub enum TokenType {
    AppToken,
    ClientToken,
    WebhookToken,
    Jwt,
}

pub fn classify_token(token: &str) -> TokenType {
    if token.starts_with("AP_") {
        TokenType::AppToken
    } else if token.starts_with("CL_") {
        TokenType::ClientToken
    } else if token.starts_with("WH_") {
        TokenType::WebhookToken
    } else {
        TokenType::Jwt
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_token_generation() {
        let app = generate_app_token();
        assert!(app.starts_with("AP_"));
        assert_eq!(app.len(), 35); // AP_ + 32 hex chars

        let client = generate_client_token();
        assert!(client.starts_with("CL_"));
    }

    #[test]
    fn test_jwt_roundtrip() {
        let secret = "test-secret-key";
        let token = create_jwt(1, "admin", true, secret).unwrap();
        let claims = validate_jwt(&token, secret).unwrap();
        assert_eq!(claims.sub, 1);
        assert_eq!(claims.username, "admin");
        assert!(claims.is_admin);
    }
}
