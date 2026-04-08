use crate::error::ApiError;
use rstify_core::error::CoreError;

pub const NOTIFY_POLICIES: &[&str] = &["always", "never", "threshold", "on_change", "digest"];
pub const STORE_POLICIES: &[&str] = &["all", "on_change", "interval"];

/// Validates that a string field's length is within the given bounds (inclusive).
/// Returns `BAD_REQUEST` if the length is outside `[min, max]`.
pub fn validate_length(
    field_name: &str,
    value: &str,
    min: usize,
    max: usize,
) -> Result<(), ApiError> {
    let len = value.len();
    if len < min || len > max {
        return Err(ApiError::from(CoreError::Validation(format!(
            "{field_name} must be between {min} and {max} characters (got {len})"
        ))));
    }
    Ok(())
}

/// Validates a topic name according to these rules:
/// - 1-128 characters
/// - Only alphanumeric, dash (`-`), underscore (`_`), and dot (`.`)
/// - Cannot be composed entirely of dots
/// - Cannot start or end with a dot
/// - Cannot contain consecutive dots
/// - Cannot start with a dash or underscore
pub fn validate_topic_name(name: &str) -> Result<(), ApiError> {
    let len = name.len();
    if len == 0 || len > 128 {
        return Err(ApiError::from(CoreError::Validation(
            "topic name must be between 1 and 128 characters".into(),
        )));
    }

    // Check for invalid characters
    if !name
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
    {
        return Err(ApiError::from(CoreError::Validation(
            "topic name may only contain alphanumeric characters, dashes, underscores, and dots"
                .into(),
        )));
    }

    // Cannot be all dots
    if name.chars().all(|c| c == '.') {
        return Err(ApiError::from(CoreError::Validation(
            "topic name cannot consist entirely of dots".into(),
        )));
    }

    // Cannot start or end with dots
    if name.starts_with('.') {
        return Err(ApiError::from(CoreError::Validation(
            "topic name cannot start with a dot".into(),
        )));
    }
    if name.ends_with('.') {
        return Err(ApiError::from(CoreError::Validation(
            "topic name cannot end with a dot".into(),
        )));
    }

    // Cannot have consecutive dots
    if name.contains("..") {
        return Err(ApiError::from(CoreError::Validation(
            "topic name cannot contain consecutive dots".into(),
        )));
    }

    // Cannot start with dash or underscore
    if name.starts_with('-') || name.starts_with('_') {
        return Err(ApiError::from(CoreError::Validation(
            "topic name cannot start with a dash or underscore".into(),
        )));
    }

    Ok(())
}

/// Validates that a string is valid JSON.
pub fn validate_json(field_name: &str, value: &str) -> Result<(), ApiError> {
    serde_json::from_str::<serde_json::Value>(value).map_err(|e| {
        ApiError::from(CoreError::Validation(format!(
            "{field_name} is not valid JSON: {e}"
        )))
    })?;
    Ok(())
}

/// Validates that a string value is one of the allowed values.
pub fn validate_policy(field_name: &str, value: &str, allowed: &[&str]) -> Result<(), ApiError> {
    if !allowed.contains(&value) {
        return Err(ApiError::from(CoreError::Validation(format!(
            "{field_name} must be one of: {}",
            allowed.join(", ")
        ))));
    }
    Ok(())
}

/// Validates that an integer is positive (greater than zero).
pub fn validate_positive(field_name: &str, value: i32) -> Result<(), ApiError> {
    if value <= 0 {
        return Err(ApiError::from(CoreError::Validation(format!(
            "{field_name} must be a positive integer (got {value})"
        ))));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::StatusCode;

    // ---- validate_length ----

    #[test]
    fn validate_length_valid() {
        assert!(validate_length("name", "hello", 1, 10).is_ok());
        assert!(validate_length("name", "a", 1, 10).is_ok());
        assert!(validate_length("name", "abcdefghij", 1, 10).is_ok());
    }

    #[test]
    fn validate_length_too_short() {
        let err = validate_length("name", "", 1, 10).unwrap_err();
        assert_eq!(err.status, StatusCode::BAD_REQUEST);
        assert!(err.message.contains("name"));
    }

    #[test]
    fn validate_length_too_long() {
        let err = validate_length("name", "a]".repeat(50).as_str(), 1, 10).unwrap_err();
        assert_eq!(err.status, StatusCode::BAD_REQUEST);
        assert!(err.message.contains("name"));
    }

    // ---- validate_topic_name ----

    #[test]
    fn validate_topic_name_valid() {
        assert!(validate_topic_name("alerts.cpu").is_ok());
        assert!(validate_topic_name("my-topic_1").is_ok());
        assert!(validate_topic_name("simple").is_ok());
        assert!(validate_topic_name("a.b.c").is_ok());
        assert!(validate_topic_name("topic123").is_ok());
    }

    #[test]
    fn validate_topic_name_invalid_chars() {
        let err = validate_topic_name("topic name").unwrap_err();
        assert_eq!(err.status, StatusCode::BAD_REQUEST);

        let err = validate_topic_name("topic@name").unwrap_err();
        assert_eq!(err.status, StatusCode::BAD_REQUEST);

        let err = validate_topic_name("topic/name").unwrap_err();
        assert_eq!(err.status, StatusCode::BAD_REQUEST);
    }

    #[test]
    fn validate_topic_name_leading_dot() {
        let err = validate_topic_name(".topic").unwrap_err();
        assert_eq!(err.status, StatusCode::BAD_REQUEST);
        assert!(err.message.contains("start with a dot"));
    }

    #[test]
    fn validate_topic_name_trailing_dot() {
        let err = validate_topic_name("topic.").unwrap_err();
        assert_eq!(err.status, StatusCode::BAD_REQUEST);
        assert!(err.message.contains("end with a dot"));
    }

    #[test]
    fn validate_topic_name_consecutive_dots() {
        let err = validate_topic_name("topic..name").unwrap_err();
        assert_eq!(err.status, StatusCode::BAD_REQUEST);
        assert!(err.message.contains("consecutive dots"));
    }

    #[test]
    fn validate_topic_name_all_dots() {
        let err = validate_topic_name("...").unwrap_err();
        assert_eq!(err.status, StatusCode::BAD_REQUEST);
        assert!(err.message.contains("entirely of dots"));
    }

    #[test]
    fn validate_topic_name_leading_dash() {
        let err = validate_topic_name("-topic").unwrap_err();
        assert_eq!(err.status, StatusCode::BAD_REQUEST);
        assert!(err.message.contains("dash or underscore"));
    }

    #[test]
    fn validate_topic_name_leading_underscore() {
        let err = validate_topic_name("_topic").unwrap_err();
        assert_eq!(err.status, StatusCode::BAD_REQUEST);
        assert!(err.message.contains("dash or underscore"));
    }

    #[test]
    fn validate_topic_name_empty() {
        let err = validate_topic_name("").unwrap_err();
        assert_eq!(err.status, StatusCode::BAD_REQUEST);
    }

    #[test]
    fn validate_topic_name_too_long() {
        let long_name = "a".repeat(129);
        let err = validate_topic_name(&long_name).unwrap_err();
        assert_eq!(err.status, StatusCode::BAD_REQUEST);
    }

    // ---- validate_json ----

    #[test]
    fn validate_json_valid() {
        assert!(validate_json("extras", r#"{"key": "value"}"#).is_ok());
        assert!(validate_json("extras", "42").is_ok());
        assert!(validate_json("extras", r#"[1, 2, 3]"#).is_ok());
        assert!(validate_json("extras", "null").is_ok());
    }

    #[test]
    fn validate_json_invalid() {
        let err = validate_json("extras", "not json at all").unwrap_err();
        assert_eq!(err.status, StatusCode::BAD_REQUEST);
        assert!(err.message.contains("extras"));

        let err = validate_json("extras", "{broken").unwrap_err();
        assert_eq!(err.status, StatusCode::BAD_REQUEST);
    }

    // ---- validate_policy ----

    #[test]
    fn validate_policy_valid() {
        assert!(validate_policy("notify_policy", "always", NOTIFY_POLICIES).is_ok());
        assert!(validate_policy("notify_policy", "never", NOTIFY_POLICIES).is_ok());
        assert!(validate_policy("store_policy", "all", STORE_POLICIES).is_ok());
    }

    #[test]
    fn validate_policy_invalid() {
        let err = validate_policy("notify_policy", "bogus", NOTIFY_POLICIES).unwrap_err();
        assert_eq!(err.status, StatusCode::BAD_REQUEST);
        assert!(err.message.contains("notify_policy"));
        assert!(err.message.contains("always"));
    }

    // ---- validate_positive ----

    #[test]
    fn validate_positive_valid() {
        assert!(validate_positive("priority", 1).is_ok());
        assert!(validate_positive("priority", 100).is_ok());
    }

    #[test]
    fn validate_positive_zero() {
        let err = validate_positive("priority", 0).unwrap_err();
        assert_eq!(err.status, StatusCode::BAD_REQUEST);
        assert!(err.message.contains("priority"));
    }

    #[test]
    fn validate_positive_negative() {
        let err = validate_positive("priority", -5).unwrap_err();
        assert_eq!(err.status, StatusCode::BAD_REQUEST);
        assert!(err.message.contains("priority"));
    }
}
