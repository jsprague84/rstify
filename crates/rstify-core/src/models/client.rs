use serde::{Deserialize, Serialize};
use ts_rs::TS;
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema, TS)]
#[ts(export)]
pub struct Client {
    pub id: i64,
    pub user_id: i64,
    pub name: String,
    pub token: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fcm_token: Option<String>,
    /// JSON array of scopes: "read", "write", "admin", "app:<id>"
    pub scopes: String,
    pub created_at: String,
}

impl Client {
    /// Parse scopes JSON string into a Vec of scope strings
    pub fn scope_list(&self) -> Vec<String> {
        serde_json::from_str(&self.scopes).unwrap_or_default()
    }

    /// Check if this client has a specific scope
    pub fn has_scope(&self, scope: &str) -> bool {
        let scopes = self.scope_list();
        // "admin" scope grants everything
        if scopes.iter().any(|s| s == "admin") {
            return true;
        }
        scopes.iter().any(|s| s == scope)
    }

    /// Check if this client can access a specific app ID
    pub fn can_access_app(&self, app_id: i64) -> bool {
        let scopes = self.scope_list();
        // "admin" grants all access
        if scopes.iter().any(|s| s == "admin") {
            return true;
        }
        // If no app:<id> scopes exist, allow all apps (backward compat)
        let app_scopes: Vec<&String> = scopes.iter().filter(|s| s.starts_with("app:")).collect();
        if app_scopes.is_empty() {
            return true;
        }
        // Check for specific app scope
        app_scopes.iter().any(|s| *s == &format!("app:{}", app_id))
    }
}

#[derive(Debug, Deserialize, ToSchema, TS)]
#[ts(export)]
pub struct CreateClient {
    pub name: String,
    /// Scopes for this client token. Default: ["read", "write"]
    #[serde(default)]
    pub scopes: Option<Vec<String>>,
}

#[derive(Debug, Deserialize, ToSchema, TS)]
#[ts(export)]
pub struct UpdateClient {
    pub name: Option<String>,
    /// Update scopes for this client token
    #[serde(default)]
    pub scopes: Option<Vec<String>>,
}

#[derive(Debug, Deserialize, ToSchema, TS)]
#[ts(export)]
pub struct RegisterFcmToken {
    pub fcm_token: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_client(scopes: &str) -> Client {
        Client {
            id: 1,
            user_id: 1,
            name: "test".into(),
            token: "C_test".into(),
            fcm_token: None,
            scopes: scopes.into(),
            created_at: "".into(),
        }
    }

    #[test]
    fn test_default_scopes() {
        let c = make_client(r#"["read","write"]"#);
        assert!(c.has_scope("read"));
        assert!(c.has_scope("write"));
        assert!(!c.has_scope("admin"));
    }

    #[test]
    fn test_admin_scope_grants_all() {
        let c = make_client(r#"["admin"]"#);
        assert!(c.has_scope("read"));
        assert!(c.has_scope("write"));
        assert!(c.has_scope("anything"));
        assert!(c.can_access_app(99));
    }

    #[test]
    fn test_app_scope_restricts() {
        let c = make_client(r#"["read","write","app:5"]"#);
        assert!(c.can_access_app(5));
        assert!(!c.can_access_app(6));
    }

    #[test]
    fn test_no_app_scope_allows_all() {
        let c = make_client(r#"["read","write"]"#);
        assert!(c.can_access_app(1));
        assert!(c.can_access_app(999));
    }

    #[test]
    fn test_write_only_token() {
        let c = make_client(r#"["write"]"#);
        assert!(!c.has_scope("read"));
        assert!(c.has_scope("write"));
    }
}
