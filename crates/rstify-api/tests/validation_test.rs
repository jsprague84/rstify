#[allow(dead_code)]
mod common;

use axum::http::StatusCode;
use tower::ServiceExt;

// ---------------------------------------------------------------------------
// Application validation
// ---------------------------------------------------------------------------

/// POST /application with an empty name should return 400.
/// Handler trims the name and calls `validate_length("Application name", name, 1, 128)`.
#[tokio::test]
async fn create_application_empty_name() {
    let app = common::setup().await;

    let resp = app
        .router
        .clone()
        .oneshot(common::post_json(
            "/application",
            &app.user_token,
            serde_json::json!({ "name": "" }),
        ))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    let body = common::body_json(resp).await;
    let error = body["error"].as_str().unwrap_or("");
    assert!(
        error.contains("Application name"),
        "Error should mention the field name; got: {error}"
    );
}

/// POST /application with a name exceeding 128 characters should return 400.
#[tokio::test]
async fn create_application_name_too_long() {
    let app = common::setup().await;
    let long_name = "a".repeat(129);

    let resp = app
        .router
        .clone()
        .oneshot(common::post_json(
            "/application",
            &app.user_token,
            serde_json::json!({ "name": long_name }),
        ))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    let body = common::body_json(resp).await;
    let error = body["error"].as_str().unwrap_or("");
    assert!(
        error.contains("Application name"),
        "Error should mention the field name; got: {error}"
    );
}

// ---------------------------------------------------------------------------
// Topic name validation
// ---------------------------------------------------------------------------

/// POST /api/topics with a name starting with a dot should return 400.
/// The handler calls `validate_topic_name` which rejects names beginning with `.`.
#[tokio::test]
async fn create_topic_invalid_name_leading_dot() {
    let app = common::setup().await;

    let resp = app
        .router
        .clone()
        .oneshot(common::post_json(
            "/api/topics",
            &app.user_token,
            serde_json::json!({ "name": ".invalid" }),
        ))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    let body = common::body_json(resp).await;
    let error = body["error"].as_str().unwrap_or("");
    assert!(
        error.contains("dot"),
        "Error should mention dot rule; got: {error}"
    );
}

/// POST /api/topics with consecutive dots (a..b) should return 400.
#[tokio::test]
async fn create_topic_invalid_name_consecutive_dots() {
    let app = common::setup().await;

    let resp = app
        .router
        .clone()
        .oneshot(common::post_json(
            "/api/topics",
            &app.user_token,
            serde_json::json!({ "name": "a..b" }),
        ))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    let body = common::body_json(resp).await;
    let error = body["error"].as_str().unwrap_or("");
    assert!(
        error.contains("consecutive dots"),
        "Error should mention consecutive dots; got: {error}"
    );
}

/// POST /api/topics with a name longer than 128 characters should return 400.
#[tokio::test]
async fn create_topic_name_too_long() {
    let app = common::setup().await;
    let long_name = "a".repeat(129);

    let resp = app
        .router
        .clone()
        .oneshot(common::post_json(
            "/api/topics",
            &app.user_token,
            serde_json::json!({ "name": long_name }),
        ))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    let body = common::body_json(resp).await;
    let error = body["error"].as_str().unwrap_or("");
    assert!(
        error.contains("128"),
        "Error should mention the 128-character limit; got: {error}"
    );
}

// ---------------------------------------------------------------------------
// User creation validation
// ---------------------------------------------------------------------------

/// POST /user with an empty username should return 400.
/// Handler validates: `username.is_empty() || username.len() > 64`.
#[tokio::test]
async fn create_user_empty_username() {
    let app = common::setup().await;

    let resp = app
        .router
        .clone()
        .oneshot(common::post_json(
            "/user",
            &app.admin_token,
            serde_json::json!({ "username": "", "password": "validpassword" }),
        ))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    let body = common::body_json(resp).await;
    let error = body["error"].as_str().unwrap_or("");
    assert!(
        error.contains("Username"),
        "Error should mention Username; got: {error}"
    );
}

/// POST /user with username "admin" (already seeded by setup) should return 409.
/// The repository maps a UNIQUE constraint violation to `CoreError::AlreadyExists` → 409.
#[tokio::test]
async fn create_user_duplicate_username() {
    let app = common::setup().await;

    let resp = app
        .router
        .clone()
        .oneshot(common::post_json(
            "/user",
            &app.admin_token,
            serde_json::json!({ "username": "admin", "password": "another-password" }),
        ))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::CONFLICT);
}

// ---------------------------------------------------------------------------
// Topic update policy validation
// ---------------------------------------------------------------------------

/// PUT /api/topics/{name} with an invalid notify_policy value should return 400.
/// The handler calls `validate_policy("notify_policy", policy, NOTIFY_POLICIES)`.
/// Valid values are: always, never, threshold, on_change, digest.
#[tokio::test]
async fn update_topic_invalid_notify_policy() {
    let app = common::setup().await;

    // Create a topic first so we have something to update
    let create_resp = app
        .router
        .clone()
        .oneshot(common::post_json(
            "/api/topics",
            &app.user_token,
            serde_json::json!({ "name": "policy-test-topic" }),
        ))
        .await
        .unwrap();
    assert_eq!(
        create_resp.status(),
        StatusCode::OK,
        "Topic creation must succeed before testing update validation"
    );

    let resp = app
        .router
        .clone()
        .oneshot(common::put_json(
            "/api/topics/policy-test-topic",
            &app.user_token,
            serde_json::json!({ "notify_policy": "invalid_value" }),
        ))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    let body = common::body_json(resp).await;
    let error = body["error"].as_str().unwrap_or("");
    assert!(
        error.contains("notify_policy"),
        "Error should mention notify_policy; got: {error}"
    );
    assert!(
        error.contains("always"),
        "Error should list valid values (including 'always'); got: {error}"
    );
}
