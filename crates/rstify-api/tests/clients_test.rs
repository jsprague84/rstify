#[allow(dead_code)]
mod common;

use axum::http::StatusCode;
use tower::ServiceExt;

// ---------------------------------------------------------------------------
// List clients
// ---------------------------------------------------------------------------

#[tokio::test]
async fn list_clients_returns_own_clients() {
    let app = common::setup().await;
    let (client_id, _) = common::seed::create_client(&app.pool, 2, "my-client").await;

    let resp = app
        .router
        .clone()
        .oneshot(common::get("/client", &app.user_token))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    let body = common::body_json(resp).await;
    assert!(body.is_array(), "Expected JSON array");
    let arr = body.as_array().unwrap();
    assert!(
        arr.iter().any(|c| c["id"] == client_id),
        "Seeded client should appear in list"
    );
    // Should not contain clients from other users
    for entry in arr {
        assert_eq!(
            entry["user_id"], 2,
            "List should only contain user 2's clients"
        );
    }
}

// ---------------------------------------------------------------------------
// Create client
// ---------------------------------------------------------------------------

#[tokio::test]
async fn create_client() {
    let app = common::setup().await;

    let resp = app
        .router
        .clone()
        .oneshot(common::post_json(
            "/client",
            &app.user_token,
            serde_json::json!({ "name": "test-client" }),
        ))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    let body = common::body_json(resp).await;
    assert!(body["id"].as_i64().unwrap_or(0) > 0, "Expected numeric id");
    let token = body["token"].as_str().expect("Expected token field");
    assert!(
        token.starts_with("CL_"),
        "Token should start with 'CL_', got: {}",
        token
    );
    assert_eq!(body["name"], "test-client");
}

#[tokio::test]
async fn create_client_unauthenticated() {
    let app = common::setup().await;

    let resp = app
        .router
        .clone()
        .oneshot(common::unauthed_post_json(
            "/client",
            serde_json::json!({ "name": "no-auth-client" }),
        ))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}

// ---------------------------------------------------------------------------
// Delete client
// ---------------------------------------------------------------------------

#[tokio::test]
async fn delete_client() {
    let app = common::setup().await;
    let (client_id, _) = common::seed::create_client(&app.pool, 2, "to-delete").await;

    let resp = app
        .router
        .clone()
        .oneshot(common::delete(
            &format!("/client/{}", client_id),
            &app.user_token,
        ))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);

    // Confirm it no longer appears in the list
    let list_resp = app
        .router
        .clone()
        .oneshot(common::get("/client", &app.user_token))
        .await
        .unwrap();
    let body = common::body_json(list_resp).await;
    let arr = body.as_array().expect("Expected array");
    assert!(
        !arr.iter().any(|c| c["id"] == client_id),
        "Deleted client should not appear in list"
    );
}

#[tokio::test]
async fn delete_client_forbidden() {
    // Client owned by admin (user 1); regular user tries to delete it → 403.
    let app = common::setup().await;
    let (admin_client_id, _) = common::seed::create_client(&app.pool, 1, "admin-client").await;

    let resp = app
        .router
        .clone()
        .oneshot(common::delete(
            &format!("/client/{}", admin_client_id),
            &app.user_token,
        ))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::FORBIDDEN);
}

// ---------------------------------------------------------------------------
// Admin bypass
// ---------------------------------------------------------------------------

#[tokio::test]
async fn admin_can_manage_any_client() {
    // Client owned by regular user (user 2); admin should be able to delete it.
    let app = common::setup().await;
    let (client_id, _) = common::seed::create_client(&app.pool, 2, "user-client").await;

    let resp = app
        .router
        .clone()
        .oneshot(common::delete(
            &format!("/client/{}", client_id),
            &app.admin_token,
        ))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);

    // Confirm the client is gone (admin's list should not include user 2's deleted client)
    let list_resp = app
        .router
        .clone()
        .oneshot(common::get("/client", &app.admin_token))
        .await
        .unwrap();
    let body = common::body_json(list_resp).await;
    let arr = body.as_array().expect("Expected array");
    assert!(
        !arr.iter().any(|c| c["id"] == client_id),
        "Deleted client should not appear in admin's list"
    );
}
