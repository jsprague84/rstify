use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum PasswordError {
    #[error("Failed to hash password: {0}")]
    HashError(String),
    #[error("Password verification failed")]
    VerifyError,
}

fn hash_password_sync(password: &str) -> Result<String, PasswordError> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| PasswordError::HashError(e.to_string()))?;
    Ok(hash.to_string())
}

fn verify_password_sync(password: &str, hash: &str) -> Result<bool, PasswordError> {
    let parsed_hash =
        PasswordHash::new(hash).map_err(|e| PasswordError::HashError(e.to_string()))?;
    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok())
}

/// Hash a password using Argon2 on a blocking thread.
pub async fn hash_password(password: String) -> Result<String, PasswordError> {
    tokio::task::spawn_blocking(move || hash_password_sync(&password))
        .await
        .map_err(|e| PasswordError::HashError(format!("Blocking task failed: {}", e)))?
}

/// Verify a password against a hash on a blocking thread.
pub async fn verify_password(password: String, hash: String) -> Result<bool, PasswordError> {
    tokio::task::spawn_blocking(move || verify_password_sync(&password, &hash))
        .await
        .map_err(|e| PasswordError::HashError(format!("Blocking task failed: {}", e)))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_hash_and_verify() {
        let password = "test_password_123".to_string();
        let hash = hash_password(password.clone()).await.unwrap();
        assert!(verify_password(password, hash.clone()).await.unwrap());
        assert!(!verify_password("wrong_password".to_string(), hash).await.unwrap());
    }
}
