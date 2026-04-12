#[allow(dead_code)]
mod common;

use axum::http::StatusCode;
use tower::ServiceExt;

// ---------------------------------------------------------------------------
// Create topic
// ---------------------------------------------------------------------------

#[tokio::test]
async fn create_topic() {
    let app = common::setup().await;

    let resp = app
        .router
        .clone()
        .oneshot(common::post_json(
            "/api/topics",
            &app.user_token,
            serde_json::json!({ "name": "test-topic" }),
        ))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    let body = common::body_json(resp).await;
    assert!(body["id"].as_i64().unwrap_or(0) > 0, "Expected numeric id");
    assert_eq!(body["name"], "test-topic");
    assert_eq!(
        body["owner_id"], 2,
        "Owner should be the authenticated user"
    );
}

#[tokio::test]
async fn create_topic_duplicate_name() {
    let app = common::setup().await;

    // First creation should succeed
    let resp1 = app
        .router
        .clone()
        .oneshot(common::post_json(
            "/api/topics",
            &app.user_token,
            serde_json::json!({ "name": "dup-topic" }),
        ))
        .await
        .unwrap();
    assert_eq!(resp1.status(), StatusCode::OK);

    // Second creation with same name should conflict
    let resp2 = app
        .router
        .clone()
        .oneshot(common::post_json(
            "/api/topics",
            &app.user_token,
            serde_json::json!({ "name": "dup-topic" }),
        ))
        .await
        .unwrap();
    assert_eq!(resp2.status(), StatusCode::CONFLICT);
}

#[tokio::test]
async fn create_topic_unauthenticated() {
    let app = common::setup().await;

    let resp = app
        .router
        .clone()
        .oneshot(common::unauthed_post_json(
            "/api/topics",
            serde_json::json!({ "name": "no-auth-topic" }),
        ))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}

// ---------------------------------------------------------------------------
// List topics
// ---------------------------------------------------------------------------

#[tokio::test]
async fn list_topics() {
    let app = common::setup().await;

    // Seed a topic with everyone_read=true (default from seed helper)
    common::seed::create_topic(&app.pool, 1, "visible-topic").await;

    let resp = app
        .router
        .clone()
        .oneshot(common::get("/api/topics", &app.user_token))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    let body = common::body_json(resp).await;
    assert!(body.is_array(), "Expected JSON array");
    let arr = body.as_array().unwrap();
    assert!(
        arr.iter().any(|t| t["name"] == "visible-topic"),
        "Seeded topic should appear in list"
    );
}

// ---------------------------------------------------------------------------
// Update topic
// ---------------------------------------------------------------------------

#[tokio::test]
async fn update_topic() {
    let app = common::setup().await;

    // Create topic owned by user 2 (testuser)
    let resp = app
        .router
        .clone()
        .oneshot(common::post_json(
            "/api/topics",
            &app.user_token,
            serde_json::json!({ "name": "update-me" }),
        ))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);

    // Owner updates the topic
    let resp = app
        .router
        .clone()
        .oneshot(common::put_json(
            "/api/topics/update-me",
            &app.user_token,
            serde_json::json!({
                "description": "updated description",
                "everyone_write": false
            }),
        ))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    let body = common::body_json(resp).await;
    assert_eq!(body["description"], "updated description");
    assert_eq!(body["everyone_write"], false);
}

#[tokio::test]
async fn update_topic_forbidden() {
    let app = common::setup().await;

    // Create topic owned by admin (user 1)
    common::seed::create_topic(&app.pool, 1, "admin-topic").await;

    // Regular user (user 2) tries to update it -> 403
    let resp = app
        .router
        .clone()
        .oneshot(common::put_json(
            "/api/topics/admin-topic",
            &app.user_token,
            serde_json::json!({ "description": "hijacked" }),
        ))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::FORBIDDEN);
}

// ---------------------------------------------------------------------------
// Delete topic
// ---------------------------------------------------------------------------

#[tokio::test]
async fn delete_topic() {
    let app = common::setup().await;

    // Create topic owned by user 2 (testuser)
    let resp = app
        .router
        .clone()
        .oneshot(common::post_json(
            "/api/topics",
            &app.user_token,
            serde_json::json!({ "name": "delete-me" }),
        ))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);

    // Owner deletes the topic
    let resp = app
        .router
        .clone()
        .oneshot(common::delete("/api/topics/delete-me", &app.user_token))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);

    // Confirm it no longer appears in the list
    let list_resp = app
        .router
        .clone()
        .oneshot(common::get("/api/topics", &app.user_token))
        .await
        .unwrap();
    let body = common::body_json(list_resp).await;
    let arr = body.as_array().expect("Expected array");
    assert!(
        !arr.iter().any(|t| t["name"] == "delete-me"),
        "Deleted topic should not appear in list"
    );
}

// ---------------------------------------------------------------------------
// Publish to topic — with permission
// ---------------------------------------------------------------------------

#[tokio::test]
async fn publish_to_topic_with_permission() {
    let app = common::setup().await;

    // Create topic owned by admin with everyone_write=false
    sqlx::query(
        "INSERT INTO topics (name, owner_id, everyone_read, everyone_write, created_at) \
         VALUES (?, ?, TRUE, FALSE, datetime('now'))",
    )
    .bind("restricted-pub")
    .bind(1_i64)
    .execute(&app.pool)
    .await
    .unwrap();

    // Grant write permission to user 2 for this topic
    common::seed::grant_topic_permission(&app.pool, 2, "restricted-pub", false, true).await;

    // User 2 publishes a message
    let resp = app
        .router
        .clone()
        .oneshot(common::post_json(
            "/api/topics/restricted-pub/publish",
            &app.user_token,
            serde_json::json!({ "message": "hello from permitted user" }),
        ))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    let body = common::body_json(resp).await;
    assert_eq!(body["message"], "hello from permitted user");
}

// ---------------------------------------------------------------------------
// Publish to topic — without permission
// ---------------------------------------------------------------------------

#[tokio::test]
async fn publish_to_topic_without_permission() {
    let app = common::setup().await;

    // Create topic owned by admin with everyone_write=false
    sqlx::query(
        "INSERT INTO topics (name, owner_id, everyone_read, everyone_write, created_at) \
         VALUES (?, ?, TRUE, FALSE, datetime('now'))",
    )
    .bind("no-write-topic")
    .bind(1_i64)
    .execute(&app.pool)
    .await
    .unwrap();

    // User 2 has no permission — should be forbidden
    let resp = app
        .router
        .clone()
        .oneshot(common::post_json(
            "/api/topics/no-write-topic/publish",
            &app.user_token,
            serde_json::json!({ "message": "should be rejected" }),
        ))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::FORBIDDEN);
}

// ---------------------------------------------------------------------------
// Publish to topic — everyone_write=true allows any user
// ---------------------------------------------------------------------------

#[tokio::test]
async fn topic_with_everyone_write() {
    let app = common::setup().await;

    // Create topic owned by admin with everyone_write=true (the default seed)
    common::seed::create_topic(&app.pool, 1, "open-topic").await;

    // User 2 has no explicit permission but everyone_write is true
    let resp = app
        .router
        .clone()
        .oneshot(common::post_json(
            "/api/topics/open-topic/publish",
            &app.user_token,
            serde_json::json!({ "message": "everyone can write" }),
        ))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    let body = common::body_json(resp).await;
    assert_eq!(body["message"], "everyone can write");
}
