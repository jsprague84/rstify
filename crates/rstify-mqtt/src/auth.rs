use rstify_core::repositories::ClientRepository;
use rstify_db::repositories::client::SqliteClientRepo;
use tracing::debug;

/// Authenticate an MQTT CONNECT using rstify client tokens or JWT.
/// The username field carries the token (client token like C_xxx or a JWT).
pub async fn authenticate(
    client_id: String,
    username: String,
    _password: String,
    client_repo: SqliteClientRepo,
    jwt_secret: String,
) -> bool {
    if username.is_empty() {
        debug!(client_id, "MQTT auth rejected: empty username");
        return false;
    }

    // Try client token first (C_xxx or AP_xxx)
    if let Ok(Some(_)) = client_repo.find_by_token(&username).await {
        debug!(client_id, "MQTT auth via client token");
        return true;
    }

    // Try JWT
    if rstify_auth::tokens::validate_jwt(&username, &jwt_secret).is_ok() {
        debug!(client_id, "MQTT auth via JWT");
        return true;
    }

    debug!(client_id, "MQTT auth rejected: invalid credentials");
    false
}
