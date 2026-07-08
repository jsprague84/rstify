pub mod action;
pub mod application;
pub mod attachment;
pub mod client;
pub mod message;
pub mod topic;
pub mod user;
pub mod webhook;
pub mod webhook_delivery;
pub mod webhook_variable;

pub use action::*;
pub use application::*;
pub use attachment::*;
pub use client::*;
pub use message::*;
pub use topic::*;
pub use user::*;
pub use webhook::*;
pub use webhook_delivery::*;
pub use webhook_variable::*;

/// Append a `Z` to a bare SQLite datetime so API clients parse it as UTC.
/// SQLite `datetime('now')` yields `"2026-03-29 04:31:12"` (no zone); clients
/// parse zone-less strings as *local* time. Idempotent: leaves existing `Z` or
/// `+offset` strings untouched. This is the project's #1 documented invariant.
pub fn to_utc_z(s: &str) -> String {
    if s.ends_with('Z') || s.contains('+') {
        s.to_string()
    } else {
        format!("{}Z", s)
    }
}

/// `#[serde(serialize_with = "crate::models::ser_utc_z")]` for bare date fields.
pub fn ser_utc_z<S: serde::Serializer>(s: &str, ser: S) -> Result<S::Ok, S::Error> {
    ser.serialize_str(&to_utc_z(s))
}

/// As [`ser_utc_z`] but for `Option<String>` date fields (e.g. `expires_at`).
pub fn ser_utc_z_opt<S: serde::Serializer>(s: &Option<String>, ser: S) -> Result<S::Ok, S::Error> {
    match s {
        Some(v) => ser.serialize_some(&to_utc_z(v)),
        None => ser.serialize_none(),
    }
}

#[cfg(test)]
mod utc_z_tests {
    use super::*;

    #[test]
    fn to_utc_z_appends_when_bare() {
        assert_eq!(to_utc_z("2026-03-29 04:31:12"), "2026-03-29 04:31:12Z");
    }

    #[test]
    fn to_utc_z_is_idempotent() {
        assert_eq!(to_utc_z("2026-03-29T04:31:12Z"), "2026-03-29T04:31:12Z");
        assert_eq!(
            to_utc_z("2026-03-29T04:31:12+00:00"),
            "2026-03-29T04:31:12+00:00"
        );
    }

    #[test]
    fn ser_utc_z_wires_into_a_struct() {
        // Proves the serialize_with attribute actually emits a Z-suffixed field.
        let app = Application {
            id: 1,
            user_id: 1,
            name: "n".into(),
            description: None,
            token: "t".into(),
            default_priority: 0,
            image: None,
            created_at: "2026-03-29 04:31:12".into(),
            updated_at: "2026-03-29 04:31:12".into(),
            retention_days: None,
        };
        let v = serde_json::to_value(&app).unwrap();
        assert_eq!(v["created_at"], "2026-03-29 04:31:12Z");
        assert_eq!(v["updated_at"], "2026-03-29 04:31:12Z");
    }
}
