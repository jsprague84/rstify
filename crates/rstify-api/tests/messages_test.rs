#[allow(dead_code)]
mod common;

use axum::body::Body;
use axum::http::{self, Request, StatusCode};
use tower::ServiceExt;

// ---------------------------------------------------------------------------
// Helper: build a POST /message request authenticated via X-Gotify-Key
// ---------------------------------------------------------------------------

fn post_with_app_token(uri: &str, app_token: &str, body: serde_json::Value) -> Request<Body> {
    Request::builder()
        .method(http::Method::POST)
        .uri(uri)
        .header("X-Gotify-Key", app_token)
        .header(http::header::CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_vec(&body).unwrap()))
        .expect("Failed to build app-token POST request")
}

// ---------------------------------------------------------------------------
// Create message via app token (Gotify compat)
// ---------------------------------------------------------------------------

#[tokio::test]
async fn create_message_via_app_token() {
    let app = common::setup().await;
    let (_, app_token) = common::seed::create_application(&app.pool, 2, "test-app").await;

    let resp = app
        .router
        .clone()
        .oneshot(post_with_app_token(
            "/message",
            &app_token,
            serde_json::json!({
                "title": "Test",
                "message": "hello",
                "priority": 5
            }),
        ))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    let body = common::body_json(resp).await;
    assert!(body["id"].as_i64().unwrap_or(0) > 0, "Expected numeric id");
    assert_eq!(body["message"], "hello");
    assert_eq!(body["title"], "Test");
    assert_eq!(body["priority"], 5);
}

// ---------------------------------------------------------------------------
// Create message unauthenticated → 401
// ---------------------------------------------------------------------------

#[tokio::test]
async fn create_message_unauthenticated() {
    let app = common::setup().await;

    let resp = app
        .router
        .clone()
        .oneshot(common::unauthed_post_json(
            "/message",
            serde_json::json!({
                "title": "No Auth",
                "message": "should fail"
            }),
        ))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}

// ---------------------------------------------------------------------------
// List messages for an application (paginated)
// ---------------------------------------------------------------------------

#[tokio::test]
async fn list_messages() {
    let app = common::setup().await;
    let (app_id, _) = common::seed::create_application(&app.pool, 2, "list-app").await;

    // Seed two messages
    let msg1 = common::seed::create_message(&app.pool, app_id, 2, "first message").await;
    let msg2 = common::seed::create_message(&app.pool, app_id, 2, "second message").await;

    let resp = app
        .router
        .clone()
        .oneshot(common::get(
            &format!("/application/{}/messages", app_id),
            &app.user_token,
        ))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    let body = common::body_json(resp).await;
    assert!(body["messages"].is_array(), "Expected messages array");
    let messages = body["messages"].as_array().unwrap();
    assert!(
        messages.iter().any(|m| m["id"] == msg1),
        "First message should appear"
    );
    assert!(
        messages.iter().any(|m| m["id"] == msg2),
        "Second message should appear"
    );
    assert!(
        body["paging"].is_object(),
        "Expected paging object in response"
    );
}

// ---------------------------------------------------------------------------
// List messages with limit=1 → returns exactly 1 message
// ---------------------------------------------------------------------------

#[tokio::test]
async fn list_messages_with_limit() {
    let app = common::setup().await;
    let (app_id, _) = common::seed::create_application(&app.pool, 2, "limit-app").await;

    // Seed three messages
    common::seed::create_message(&app.pool, app_id, 2, "msg a").await;
    common::seed::create_message(&app.pool, app_id, 2, "msg b").await;
    common::seed::create_message(&app.pool, app_id, 2, "msg c").await;

    let resp = app
        .router
        .clone()
        .oneshot(common::get(
            &format!("/application/{}/messages?limit=1", app_id),
            &app.user_token,
        ))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    let body = common::body_json(resp).await;
    let messages = body["messages"].as_array().expect("Expected messages array");
    assert_eq!(messages.len(), 1, "limit=1 should return exactly 1 message");
    assert_eq!(body["paging"]["limit"], 1, "Paging limit should reflect 1");
}

// ---------------------------------------------------------------------------
// Delete a specific message
// ---------------------------------------------------------------------------

#[tokio::test]
async fn delete_message() {
    let app = common::setup().await;
    let (app_id, _) = common::seed::create_application(&app.pool, 2, "delete-app").await;
    let msg_id = common::seed::create_message(&app.pool, app_id, 2, "to be deleted").await;

    let resp = app
        .router
        .clone()
        .oneshot(common::delete(
            &format!("/message/{}", msg_id),
            &app.user_token,
        ))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);

    // Verify it no longer appears in the application's message list
    let list_resp = app
        .router
        .clone()
        .oneshot(common::get(
            &format!("/application/{}/messages", app_id),
            &app.user_token,
        ))
        .await
        .unwrap();
    let body = common::body_json(list_resp).await;
    let messages = body["messages"].as_array().expect("Expected messages array");
    assert!(
        !messages.iter().any(|m| m["id"] == msg_id),
        "Deleted message should not appear in list"
    );
}

// ---------------------------------------------------------------------------
// Delete message owned by another user → 403
// ---------------------------------------------------------------------------

#[tokio::test]
async fn delete_message_forbidden() {
    let app = common::setup().await;

    // Admin (user 1) owns this application and its message
    let (admin_app_id, _) =
        common::seed::create_application(&app.pool, 1, "admin-app").await;
    let msg_id =
        common::seed::create_message(&app.pool, admin_app_id, 1, "admin msg").await;

    // Regular user (user 2) attempts to delete it
    let resp = app
        .router
        .clone()
        .oneshot(common::delete(
            &format!("/message/{}", msg_id),
            &app.user_token,
        ))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::FORBIDDEN);
}

// ---------------------------------------------------------------------------
// Search messages
// ---------------------------------------------------------------------------

#[tokio::test]
async fn search_messages() {
    let app = common::setup().await;
    let (app_id, _) = common::seed::create_application(&app.pool, 2, "search-app").await;

    let msg_id =
        common::seed::create_message(&app.pool, app_id, 2, "uniqueterm in this message").await;
    common::seed::create_message(&app.pool, app_id, 2, "unrelated message").await;

    let resp = app
        .router
        .clone()
        .oneshot(common::get(
            "/message/search?q=uniqueterm",
            &app.user_token,
        ))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    let body = common::body_json(resp).await;
    assert!(body.is_array(), "Search should return a JSON array");
    let results = body.as_array().unwrap();
    assert!(
        results.iter().any(|m| m["id"] == msg_id),
        "Search should find the message containing 'uniqueterm'"
    );
}
