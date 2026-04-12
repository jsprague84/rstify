use std::future::Future;

use crate::error::ApiError;
use crate::extractors::auth::AuthUser;
use rstify_core::error::CoreError;

/// Generic async helper that fetches a resource by calling `fetch()`, maps DB errors
/// to `ApiError`, and returns `NotFound` if the result is `None`.
///
/// Replaces the common pattern:
/// ```ignore
/// let item = repo.find_by_id(id).await.map_err(ApiError::from)?
///     .ok_or_else(|| ApiError::from(CoreError::NotFound("Thing not found".into())))?;
/// ```
pub async fn fetch_or_not_found<T, F, Fut>(resource_name: &str, fetch: F) -> Result<T, ApiError>
where
    F: FnOnce() -> Fut,
    Fut: Future<Output = Result<Option<T>, CoreError>>,
{
    match fetch().await {
        Ok(Some(value)) => Ok(value),
        Ok(None) => Err(ApiError::from(CoreError::NotFound(format!(
            "{resource_name} not found"
        )))),
        Err(e) => Err(ApiError::from(e)),
    }
}

/// Checks that the authenticated user owns the resource (by comparing user IDs).
/// Admins bypass ownership checks.
///
/// Returns `Forbidden` if the user does not own the resource and is not an admin.
pub fn verify_ownership(
    auth: &AuthUser,
    resource_user_id: i64,
    resource_name: &str,
) -> Result<(), ApiError> {
    if resource_user_id != auth.user.id && !auth.user.is_admin {
        return Err(ApiError::from(CoreError::Forbidden(format!(
            "Not your {resource_name}"
        ))));
    }
    Ok(())
}

/// Ownership check for resources where the owner is optional (e.g. `Topic.owner_id`).
///
/// - `Some(owner_id)` delegates to [`verify_ownership`].
/// - `None` (no owner) means only admins can modify.
pub fn verify_optional_ownership(
    auth: &AuthUser,
    resource_owner_id: Option<i64>,
    resource_name: &str,
) -> Result<(), ApiError> {
    match resource_owner_id {
        Some(owner_id) => verify_ownership(auth, owner_id, resource_name),
        None => {
            if !auth.user.is_admin {
                return Err(ApiError::from(CoreError::Forbidden(format!(
                    "Not your {resource_name}"
                ))));
            }
            Ok(())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::StatusCode;
    use rstify_core::models::User;

    /// Helper to build an AuthUser for testing.
    fn make_auth_user(id: i64, is_admin: bool) -> AuthUser {
        AuthUser {
            user: User {
                id,
                username: format!("user{id}"),
                password_hash: String::new(),
                email: None,
                is_admin,
                created_at: "2026-01-01 00:00:00".to_string(),
                updated_at: "2026-01-01 00:00:00".to_string(),
            },
            claims: None,
            client: None,
        }
    }

    // ── verify_ownership ──────────────────────────────────────────

    #[test]
    fn verify_ownership_owner_matches() {
        let auth = make_auth_user(42, false);
        let result = verify_ownership(&auth, 42, "client");
        assert!(result.is_ok());
    }

    #[test]
    fn verify_ownership_different_user_forbidden() {
        let auth = make_auth_user(42, false);
        let result = verify_ownership(&auth, 99, "client");
        let err = result.unwrap_err();
        assert_eq!(err.status, StatusCode::FORBIDDEN);
        assert_eq!(err.message, "Not your client");
    }

    #[test]
    fn verify_ownership_admin_bypasses() {
        let auth = make_auth_user(42, true);
        let result = verify_ownership(&auth, 99, "client");
        assert!(result.is_ok());
    }

    // ── verify_optional_ownership ─────────────────────────────────

    #[test]
    fn verify_optional_ownership_some_owner_matches() {
        let auth = make_auth_user(10, false);
        let result = verify_optional_ownership(&auth, Some(10), "topic");
        assert!(result.is_ok());
    }

    #[test]
    fn verify_optional_ownership_some_owner_denied() {
        let auth = make_auth_user(10, false);
        let result = verify_optional_ownership(&auth, Some(99), "topic");
        let err = result.unwrap_err();
        assert_eq!(err.status, StatusCode::FORBIDDEN);
        assert_eq!(err.message, "Not your topic");
    }

    #[test]
    fn verify_optional_ownership_none_admin_ok() {
        let auth = make_auth_user(10, true);
        let result = verify_optional_ownership(&auth, None, "topic");
        assert!(result.is_ok());
    }

    #[test]
    fn verify_optional_ownership_none_non_admin_forbidden() {
        let auth = make_auth_user(10, false);
        let result = verify_optional_ownership(&auth, None, "topic");
        let err = result.unwrap_err();
        assert_eq!(err.status, StatusCode::FORBIDDEN);
        assert_eq!(err.message, "Not your topic");
    }

    // ── fetch_or_not_found ────────────────────────────────────────

    #[tokio::test]
    async fn fetch_or_not_found_returns_value_when_some() {
        let result = fetch_or_not_found("Widget", || async { Ok(Some(42_i64)) }).await;
        assert_eq!(result.unwrap(), 42);
    }

    #[tokio::test]
    async fn fetch_or_not_found_returns_not_found_when_none() {
        let result: Result<i64, ApiError> =
            fetch_or_not_found("Widget", || async { Ok(None) }).await;
        let err = result.unwrap_err();
        assert_eq!(err.status, StatusCode::NOT_FOUND);
        assert_eq!(err.message, "Widget not found");
    }

    #[tokio::test]
    async fn fetch_or_not_found_maps_db_error_to_500() {
        let result: Result<i64, ApiError> = fetch_or_not_found("Widget", || async {
            Err(CoreError::Database("connection lost".into()))
        })
        .await;
        let err = result.unwrap_err();
        assert_eq!(err.status, StatusCode::INTERNAL_SERVER_ERROR);
    }
}
