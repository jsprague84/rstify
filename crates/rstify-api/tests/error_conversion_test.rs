use axum::body::to_bytes;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use rstify_api::error::ApiError;
use rstify_core::error::CoreError;

// ---------------------------------------------------------------------------
// Status-code mapping tests
// ---------------------------------------------------------------------------

#[test]
fn not_found_maps_to_404() {
    let err: ApiError = CoreError::NotFound("topic not found".into()).into();
    assert_eq!(err.status, StatusCode::NOT_FOUND);
}

#[test]
fn already_exists_maps_to_409() {
    let err: ApiError = CoreError::AlreadyExists("slug taken".into()).into();
    assert_eq!(err.status, StatusCode::CONFLICT);
}

#[test]
fn unauthorized_maps_to_401() {
    let err: ApiError = CoreError::Unauthorized("bad token".into()).into();
    assert_eq!(err.status, StatusCode::UNAUTHORIZED);
}

#[test]
fn forbidden_maps_to_403() {
    let err: ApiError = CoreError::Forbidden("not your resource".into()).into();
    assert_eq!(err.status, StatusCode::FORBIDDEN);
}

#[test]
fn validation_maps_to_400() {
    let err: ApiError = CoreError::Validation("title too long".into()).into();
    assert_eq!(err.status, StatusCode::BAD_REQUEST);
}

#[test]
fn database_maps_to_500() {
    let err: ApiError = CoreError::Database("sqlite constraint".into()).into();
    assert_eq!(err.status, StatusCode::INTERNAL_SERVER_ERROR);
}

#[test]
fn internal_maps_to_500() {
    let err: ApiError = CoreError::Internal("unexpected panic".into()).into();
    assert_eq!(err.status, StatusCode::INTERNAL_SERVER_ERROR);
}

// ---------------------------------------------------------------------------
// Message preservation tests
// ---------------------------------------------------------------------------

#[test]
fn not_found_preserves_message() {
    let err: ApiError = CoreError::NotFound("topic not found".into()).into();
    assert_eq!(err.message, "topic not found");
}

#[test]
fn already_exists_preserves_message() {
    let err: ApiError = CoreError::AlreadyExists("slug taken".into()).into();
    assert_eq!(err.message, "slug taken");
}

#[test]
fn unauthorized_preserves_message() {
    let err: ApiError = CoreError::Unauthorized("bad token".into()).into();
    assert_eq!(err.message, "bad token");
}

#[test]
fn forbidden_preserves_message() {
    let err: ApiError = CoreError::Forbidden("not your resource".into()).into();
    assert_eq!(err.message, "not your resource");
}

#[test]
fn validation_preserves_message() {
    let err: ApiError = CoreError::Validation("title too long".into()).into();
    assert_eq!(err.message, "title too long");
}

/// Database errors are logged server-side; the public message is redacted to
/// avoid leaking internal details to callers.
#[test]
fn database_replaces_message_with_generic() {
    let err: ApiError = CoreError::Database("sqlite: UNIQUE constraint failed".into()).into();
    assert_eq!(err.message, "Internal database error");
}

/// Same redaction applies to Internal errors.
#[test]
fn internal_replaces_message_with_generic() {
    let err: ApiError = CoreError::Internal("secret key material".into()).into();
    assert_eq!(err.message, "Internal server error");
}

// ---------------------------------------------------------------------------
// IntoResponse / JSON body tests
// ---------------------------------------------------------------------------

/// Helper: call `into_response()` and collect the full body as bytes.
async fn body_bytes(err: ApiError) -> bytes::Bytes {
    let response = err.into_response();
    to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("failed to read response body")
}

#[tokio::test]
async fn into_response_not_found_json_shape() {
    let err = ApiError {
        status: StatusCode::NOT_FOUND,
        message: "topic not found".into(),
    };
    let raw = body_bytes(err).await;
    let value: serde_json::Value =
        serde_json::from_slice(&raw).expect("body is not valid JSON");

    assert_eq!(value["error"], "topic not found");
    assert_eq!(value["errorCode"], 404u16);
}

#[tokio::test]
async fn into_response_conflict_json_shape() {
    let err = ApiError {
        status: StatusCode::CONFLICT,
        message: "slug taken".into(),
    };
    let raw = body_bytes(err).await;
    let value: serde_json::Value = serde_json::from_slice(&raw).unwrap();

    assert_eq!(value["error"], "slug taken");
    assert_eq!(value["errorCode"], 409u16);
}

#[tokio::test]
async fn into_response_unauthorized_json_shape() {
    let err = ApiError {
        status: StatusCode::UNAUTHORIZED,
        message: "bad token".into(),
    };
    let raw = body_bytes(err).await;
    let value: serde_json::Value = serde_json::from_slice(&raw).unwrap();

    assert_eq!(value["error"], "bad token");
    assert_eq!(value["errorCode"], 401u16);
}

#[tokio::test]
async fn into_response_forbidden_json_shape() {
    let err = ApiError {
        status: StatusCode::FORBIDDEN,
        message: "not your resource".into(),
    };
    let raw = body_bytes(err).await;
    let value: serde_json::Value = serde_json::from_slice(&raw).unwrap();

    assert_eq!(value["error"], "not your resource");
    assert_eq!(value["errorCode"], 403u16);
}

#[tokio::test]
async fn into_response_bad_request_json_shape() {
    let err = ApiError {
        status: StatusCode::BAD_REQUEST,
        message: "title too long".into(),
    };
    let raw = body_bytes(err).await;
    let value: serde_json::Value = serde_json::from_slice(&raw).unwrap();

    assert_eq!(value["error"], "title too long");
    assert_eq!(value["errorCode"], 400u16);
}

#[tokio::test]
async fn into_response_internal_server_error_json_shape() {
    let err = ApiError {
        status: StatusCode::INTERNAL_SERVER_ERROR,
        message: "Internal server error".into(),
    };
    let raw = body_bytes(err).await;
    let value: serde_json::Value = serde_json::from_slice(&raw).unwrap();

    assert_eq!(value["error"], "Internal server error");
    assert_eq!(value["errorCode"], 500u16);
}

#[tokio::test]
async fn into_response_http_status_code_matches_json_error_code() {
    // Verify the HTTP status line and the JSON errorCode field are always in sync.
    let variants: Vec<ApiError> = vec![
        CoreError::NotFound("x".into()).into(),
        CoreError::AlreadyExists("x".into()).into(),
        CoreError::Unauthorized("x".into()).into(),
        CoreError::Forbidden("x".into()).into(),
        CoreError::Validation("x".into()).into(),
        CoreError::Database("x".into()).into(),
        CoreError::Internal("x".into()).into(),
    ];

    for api_err in variants {
        let expected_code = api_err.status.as_u16();
        let response = api_err.into_response();
        let http_status = response.status().as_u16();
        let raw = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("body read failed");
        let value: serde_json::Value = serde_json::from_slice(&raw).unwrap();
        let json_code = value["errorCode"].as_u64().unwrap() as u16;

        assert_eq!(
            http_status, json_code,
            "HTTP status {http_status} does not match JSON errorCode {json_code}"
        );
        assert_eq!(
            http_status, expected_code,
            "HTTP status {http_status} does not match expected {expected_code}"
        );
    }
}
