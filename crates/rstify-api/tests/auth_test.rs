#[allow(dead_code)]
mod common;

use axum::http::StatusCode;
use tower::ServiceExt;

// ---------------------------------------------------------------------------
// Login endpoint tests
// ---------------------------------------------------------------------------

#[tokio::test]
async fn login_with_valid_credentials() {
    let app = common::setup().await;
    let resp = app
        .router
        .clone()
        .oneshot(common::unauthed_post_json(
            "/api/auth/login",
            serde_json::json!({ "username": "admin", "password": "admin123" }),
        ))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    let body = common::body_json(resp).await;
    assert!(
        body.get("token").is_some(),
        "Expected 'token' field in login response"
    );
    assert!(
        body["token"].is_string(),
        "Expected 'token' to be a string"
    );
    assert!(
        !body["token"].as_str().unwrap().is_empty(),
        "Expected non-empty token"
    );
}

#[tokio::test]
async fn login_with_wrong_password() {
    let app = common::setup().await;
    let resp = app
        .router
        .clone()
        .oneshot(common::unauthed_post_json(
            "/api/auth/login",
            serde_json::json!({ "username": "admin", "password": "wrong" }),
        ))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn login_with_unknown_user() {
    let app = common::setup().await;
    let resp = app
        .router
        .clone()
        .oneshot(common::unauthed_post_json(
            "/api/auth/login",
            serde_json::json!({ "username": "nobody", "password": "pass" }),
        ))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}

// ---------------------------------------------------------------------------
// Token-based auth guard tests
// ---------------------------------------------------------------------------

#[tokio::test]
async fn authenticated_endpoint_without_token() {
    let app = common::setup().await;
    let resp = app
        .router
        .clone()
        .oneshot(common::unauthed_get("/application"))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn authenticated_endpoint_with_valid_token() {
    let app = common::setup().await;
    let resp = app
        .router
        .clone()
        .oneshot(common::get("/application", &app.user_token))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
}

#[tokio::test]
async fn authenticated_endpoint_with_invalid_token() {
    let app = common::setup().await;
    let resp = app
        .router
        .clone()
        .oneshot(common::get("/application", "bad-token"))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}
