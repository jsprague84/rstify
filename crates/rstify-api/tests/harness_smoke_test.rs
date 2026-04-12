#[allow(dead_code)]
mod common;

use axum::http::StatusCode;
use tower::ServiceExt;

#[tokio::test]
async fn test_harness_health_check() {
    let app = common::setup().await;
    let resp = app
        .router
        .clone()
        .oneshot(common::get("/health", &app.admin_token))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_harness_unauthenticated_returns_401() {
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
async fn test_harness_admin_can_list_applications() {
    let app = common::setup().await;
    let resp = app
        .router
        .clone()
        .oneshot(common::get("/application", &app.admin_token))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let body = common::body_json(resp).await;
    assert!(body.is_array(), "Expected JSON array from /application");
}

#[tokio::test]
async fn test_harness_regular_user_can_list_applications() {
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
async fn test_harness_seed_helpers() {
    let app = common::setup().await;

    // Seed an application for the admin user
    let (app_id, app_token) = common::seed::create_application(&app.pool, 1, "Test App").await;
    assert!(app_id > 0);
    assert!(app_token.starts_with("AP_"));

    // Seed a client for the regular user
    let (client_id, client_token) = common::seed::create_client(&app.pool, 2, "Test Client").await;
    assert!(client_id > 0);
    assert!(client_token.starts_with("CL_"));

    // Seed a topic
    let topic_id = common::seed::create_topic(&app.pool, 1, "test-topic").await;
    assert!(topic_id > 0);

    // Seed a message
    let msg_id = common::seed::create_message(&app.pool, app_id, 1, "Hello from test").await;
    assert!(msg_id > 0);

    // Seed a webhook
    let (wh_id, wh_token) = common::seed::create_webhook(&app.pool, 1, "Test Webhook").await;
    assert!(wh_id > 0);
    assert!(wh_token.starts_with("WH_"));

    // Grant a topic permission
    let perm_id = common::seed::grant_topic_permission(&app.pool, 2, "test-*", true, false).await;
    assert!(perm_id > 0);
}

#[tokio::test]
async fn test_harness_version_endpoint() {
    let app = common::setup().await;
    let resp = app
        .router
        .clone()
        .oneshot(common::get("/version", &app.admin_token))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let body = common::body_json(resp).await;
    assert!(
        body.get("version").is_some(),
        "Expected 'version' field in response"
    );
}

#[tokio::test]
async fn test_harness_current_user() {
    let app = common::setup().await;
    let resp = app
        .router
        .clone()
        .oneshot(common::get("/current/user", &app.admin_token))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let body = common::body_json(resp).await;
    assert_eq!(body["username"], "admin");
    assert_eq!(body["is_admin"], true);
}
