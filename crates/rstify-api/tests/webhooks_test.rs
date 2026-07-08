#[allow(dead_code)]
mod common;

use axum::http::StatusCode;
use tower::ServiceExt;

// ---------------------------------------------------------------------------
// Create webhook
// ---------------------------------------------------------------------------

#[tokio::test]
async fn create_webhook() {
    let app = common::setup().await;

    // Create a topic to target
    let topic_id = common::seed::create_topic(&app.pool, 2, "wh-create-topic").await;

    let resp = app
        .router
        .clone()
        .oneshot(common::post_json(
            "/api/webhooks",
            &app.user_token,
            serde_json::json!({
                "name": "My Webhook",
                "webhookType": "generic",
                "targetTopicId": topic_id
            }),
        ))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    let body = common::body_json(resp).await;
    assert!(
        body["id"].as_i64().unwrap_or(0) > 0,
        "Expected numeric id in response"
    );
    assert!(
        body["token"].as_str().is_some_and(|t| !t.is_empty()),
        "Expected non-empty token in response"
    );
    assert_eq!(body["name"], "My Webhook");
    assert_eq!(body["webhook_type"], "generic");
}

#[tokio::test]
async fn create_incoming_webhook_requires_exactly_one_target() {
    let app = common::setup().await;
    let topic_id = common::seed::create_topic(&app.pool, 2, "wh-target-topic").await;

    // No target → 400 (a message must belong to exactly one topic or app,
    // so delivery would 500 otherwise)
    let resp = app
        .router
        .clone()
        .oneshot(common::post_json(
            "/api/webhooks",
            &app.user_token,
            serde_json::json!({ "name": "No target", "webhookType": "custom" }),
        ))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);

    // Both targets → 400
    let resp = app
        .router
        .clone()
        .oneshot(common::post_json(
            "/api/webhooks",
            &app.user_token,
            serde_json::json!({
                "name": "Both targets",
                "webhookType": "custom",
                "targetTopicId": topic_id,
                "targetApplicationId": 1
            }),
        ))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn incoming_webhook_logs_deliveries() {
    let app = common::setup().await;
    let topic_id = common::seed::create_topic(&app.pool, 2, "wh-log-topic").await;

    let resp = app
        .router
        .clone()
        .oneshot(common::post_json(
            "/api/webhooks",
            &app.user_token,
            serde_json::json!({
                "name": "Logged webhook",
                "webhookType": "custom",
                "targetTopicId": topic_id
            }),
        ))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let body = common::body_json(resp).await;
    let token = body["token"].as_str().unwrap().to_string();
    let wh_id = body["id"].as_i64().unwrap();

    // Successful delivery
    let resp = app
        .router
        .clone()
        .oneshot(common::unauthed_post_json(
            &format!("/api/wh/{}", token),
            serde_json::json!({ "title": "Hi", "message": "logged" }),
        ))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);

    // Invalid JSON body → rejected AND logged
    let resp = app
        .router
        .clone()
        .oneshot(
            axum::http::Request::builder()
                .method("POST")
                .uri(format!("/api/wh/{}", token))
                .header("content-type", "application/json")
                .body(axum::body::Body::from("not json"))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);

    // Both attempts must appear in the delivery log
    let resp = app
        .router
        .clone()
        .oneshot(common::get(
            &format!("/api/webhooks/{}/deliveries", wh_id),
            &app.user_token,
        ))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let logs = common::body_json(resp).await;
    let arr = logs.as_array().expect("array of delivery logs");
    assert_eq!(arr.len(), 2, "expected accepted + rejected entries");
    assert!(arr
        .iter()
        .any(|l| l["success"] == true && l["status_code"] == 200));
    assert!(arr
        .iter()
        .any(|l| l["success"] == false && l["status_code"] == 400));
}

// ---------------------------------------------------------------------------
// List webhooks
// ---------------------------------------------------------------------------

#[tokio::test]
async fn list_webhooks() {
    let app = common::setup().await;

    // Seed a webhook for user 2 (testuser)
    common::seed::create_webhook(&app.pool, 2, "listed-webhook").await;

    let resp = app
        .router
        .clone()
        .oneshot(common::get("/api/webhooks", &app.user_token))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    let body = common::body_json(resp).await;
    assert!(body.is_array(), "Expected JSON array");
    let arr = body.as_array().unwrap();
    // WebhookConfigWithHealth uses #[serde(flatten)] so WebhookConfig fields
    // appear at the top level alongside health fields (last_delivery_at, etc.)
    assert!(
        arr.iter().any(|w| w["name"] == "listed-webhook"),
        "Seeded webhook should appear in list (fields are flattened)"
    );
}

// ---------------------------------------------------------------------------
// Update webhook
// ---------------------------------------------------------------------------

#[tokio::test]
async fn update_webhook() {
    let app = common::setup().await;

    // Seed a webhook owned by user 2 (testuser)
    let (wh_id, _token) = common::seed::create_webhook(&app.pool, 2, "update-me-webhook").await;

    let resp = app
        .router
        .clone()
        .oneshot(common::put_json(
            &format!("/api/webhooks/{}", wh_id),
            &app.user_token,
            serde_json::json!({
                "name": "Updated Webhook Name",
                "enabled": false
            }),
        ))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    let body = common::body_json(resp).await;
    assert_eq!(body["name"], "Updated Webhook Name");
    assert_eq!(body["enabled"], false);
}

// ---------------------------------------------------------------------------
// Update webhook — forbidden for non-owner
// ---------------------------------------------------------------------------

#[tokio::test]
async fn update_webhook_forbidden() {
    let app = common::setup().await;

    // Seed a webhook owned by admin (user 1)
    let (wh_id, _token) = common::seed::create_webhook(&app.pool, 1, "admin-webhook").await;

    // Regular user (user 2) tries to update it -> 403
    let resp = app
        .router
        .clone()
        .oneshot(common::put_json(
            &format!("/api/webhooks/{}", wh_id),
            &app.user_token,
            serde_json::json!({ "name": "hijacked" }),
        ))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::FORBIDDEN);
}

// ---------------------------------------------------------------------------
// Delete webhook
// ---------------------------------------------------------------------------

#[tokio::test]
async fn delete_webhook() {
    let app = common::setup().await;

    // Seed a webhook owned by user 2 (testuser)
    let (wh_id, _token) = common::seed::create_webhook(&app.pool, 2, "delete-me-webhook").await;

    let resp = app
        .router
        .clone()
        .oneshot(common::delete(
            &format!("/api/webhooks/{}", wh_id),
            &app.user_token,
        ))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    let body = common::body_json(resp).await;
    assert_eq!(body["success"], true);

    // Confirm it no longer appears in the list
    let list_resp = app
        .router
        .clone()
        .oneshot(common::get("/api/webhooks", &app.user_token))
        .await
        .unwrap();
    let list_body = common::body_json(list_resp).await;
    let arr = list_body.as_array().expect("Expected array");
    // Fields are flattened (no "config" wrapper), so id is at the top level
    assert!(
        !arr.iter().any(|w| w["id"].as_i64() == Some(wh_id)),
        "Deleted webhook should not appear in list"
    );
}

// ---------------------------------------------------------------------------
// Incoming webhook — creates a message
// ---------------------------------------------------------------------------

#[tokio::test]
async fn incoming_webhook() {
    let app = common::setup().await;

    // Seed a topic and a webhook targeting it
    let topic_id = common::seed::create_topic(&app.pool, 2, "incoming-wh-topic").await;

    // Insert a webhook config with target_topic_id set
    let wh_token = format!("WH_{}", uuid::Uuid::new_v4().to_string().replace('-', ""));
    sqlx::query(
        "INSERT INTO webhook_configs (user_id, name, token, webhook_type, template, enabled, target_topic_id, created_at) \
         VALUES (?, ?, ?, 'generic', '{{message}}', TRUE, ?, datetime('now'))",
    )
    .bind(2_i64)
    .bind("incoming-test-webhook")
    .bind(&wh_token)
    .bind(topic_id)
    .execute(&app.pool)
    .await
    .expect("Failed to seed webhook with topic target");

    // POST to /api/wh/{token} with a JSON payload
    let resp = app
        .router
        .clone()
        .oneshot(common::unauthed_post_json(
            &format!("/api/wh/{}", wh_token),
            serde_json::json!({
                "title": "Hello from Webhook",
                "message": "This is an incoming webhook message"
            }),
        ))
        .await
        .unwrap();

    assert!(
        resp.status() == StatusCode::OK || resp.status() == StatusCode::CREATED,
        "Expected 200 or 201, got {}",
        resp.status()
    );
    let body = common::body_json(resp).await;
    assert_eq!(body["success"], true, "Expected success: true in response");
    assert!(
        body["message_id"].as_i64().unwrap_or(0) > 0,
        "Expected a valid message_id in response"
    );
}

// ---------------------------------------------------------------------------
// Incoming webhook — bad/missing HMAC signature is rejected (403)
// ---------------------------------------------------------------------------

#[tokio::test]
async fn incoming_github_webhook_rejects_bad_signature() {
    let app = common::setup().await;
    let topic_id = common::seed::create_topic(&app.pool, 2, "gh-sig-topic").await;

    // Seed a github webhook WITH a secret — signature verification is now required.
    let wh_token = format!("WH_{}", uuid::Uuid::new_v4().to_string().replace('-', ""));
    sqlx::query(
        "INSERT INTO webhook_configs (user_id, name, token, webhook_type, template, enabled, target_topic_id, secret, created_at) \
         VALUES (?, ?, ?, 'github', '{{message}}', TRUE, ?, 'topsecret', datetime('now'))",
    )
    .bind(2_i64)
    .bind("gh-sig-webhook")
    .bind(&wh_token)
    .bind(topic_id)
    .execute(&app.pool)
    .await
    .expect("Failed to seed github webhook with secret");

    let body = br#"{"action":"opened"}"#;
    let uri = format!("/api/wh/{}", wh_token);

    // Wrong signature → 403
    let resp = app
        .router
        .clone()
        .oneshot(
            axum::http::Request::builder()
                .method("POST")
                .uri(&uri)
                .header("content-type", "application/json")
                .header("X-GitHub-Event", "push")
                .header("X-Hub-Signature-256", "sha256=deadbeef")
                .body(axum::body::Body::from(body.to_vec()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(
        resp.status(),
        StatusCode::FORBIDDEN,
        "wrong signature must be rejected"
    );

    // Missing signature → 403
    let resp = app
        .router
        .clone()
        .oneshot(
            axum::http::Request::builder()
                .method("POST")
                .uri(&uri)
                .header("content-type", "application/json")
                .header("X-GitHub-Event", "push")
                .body(axum::body::Body::from(body.to_vec()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(
        resp.status(),
        StatusCode::FORBIDDEN,
        "missing signature must be rejected"
    );
}

// ---------------------------------------------------------------------------
// Incoming webhook — invalid token returns 404
// ---------------------------------------------------------------------------

#[tokio::test]
async fn incoming_webhook_invalid_token() {
    let app = common::setup().await;

    let resp = app
        .router
        .clone()
        .oneshot(common::unauthed_post_json(
            "/api/wh/bad-token-that-does-not-exist",
            serde_json::json!({ "message": "should fail" }),
        ))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::NOT_FOUND);
}

// ---------------------------------------------------------------------------
// Create webhook — unauthenticated returns 401
// ---------------------------------------------------------------------------

#[tokio::test]
async fn create_webhook_unauthenticated() {
    let app = common::setup().await;

    let resp = app
        .router
        .clone()
        .oneshot(common::unauthed_post_json(
            "/api/webhooks",
            serde_json::json!({
                "name": "No Auth Webhook",
                "webhookType": "generic"
            }),
        ))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}
