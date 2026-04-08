use crate::error::ApiError;
use rstify_core::error::CoreError;
use serde::Serialize;

/// Serialize a value to a JSON string, returning an ApiError on failure
/// instead of panicking.
pub fn to_json_string<T: Serialize>(value: &T) -> Result<String, ApiError> {
    serde_json::to_string(value).map_err(|e| {
        ApiError::from(CoreError::Internal(format!("JSON serialization failed: {e}")))
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_serialize_vec_string() {
        let scopes = vec!["read".to_string(), "write".to_string()];
        let result = to_json_string(&scopes).unwrap();
        assert_eq!(result, r#"["read","write"]"#);
    }

    #[test]
    fn test_serialize_empty_vec() {
        let empty: Vec<String> = vec![];
        let result = to_json_string(&empty).unwrap();
        assert_eq!(result, "[]");
    }
}
