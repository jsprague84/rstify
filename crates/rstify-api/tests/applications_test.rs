#[allow(dead_code)]
mod common;

use axum::http::StatusCode;
use tower::ServiceExt;

// ---------------------------------------------------------------------------
// List applications
// ---------------------------------------------------------------------------

#[tokio::test]
async fn list_applications_returns_own_apps() {
    let app = common::setup().await;
    let (app_id, _) = common::seed::create_application(&app.pool, 2, "my-app").await;

    let resp = app
        .router
        .clone()
        .oneshot(common::get("/application", &app.user_token))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    let body = common::body_json(resp).await;
    assert!(body.is_array(), "Expected JSON array");
    let arr = body.as_array().unwrap();
    assert!(
        arr.iter().any(|a| a["id"] == app_id),
        "Seeded app should appear in list"
    );
    // Should not contain apps from other users
    for entry in arr {
        assert_eq!(
            entry["user_id"], 2,
            "List should only contain user 2's apps"
        );
    }
}

// ---------------------------------------------------------------------------
// Create application
// ---------------------------------------------------------------------------

#[tokio::test]
async fn create_application() {
    let app = common::setup().await;

    let resp = app
        .router
        .clone()
        .oneshot(common::post_json(
            "/application",
            &app.user_token,
            serde_json::json!({ "name": "test-app" }),
        ))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    let body = common::body_json(resp).await;
    assert!(body["id"].as_i64().unwrap_or(0) > 0, "Expected numeric id");
    assert!(
        body["token"].as_str().is_some_and(|t| !t.is_empty()),
        "Expected non-empty token"
    );
    assert_eq!(body["name"], "test-app");
}

#[tokio::test]
async fn create_application_unauthenticated() {
    let app = common::setup().await;

    let resp = app
        .router
        .clone()
        .oneshot(common::unauthed_post_json(
            "/application",
            serde_json::json!({ "name": "no-auth-app" }),
        ))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}

// ---------------------------------------------------------------------------
// Get application by id
// ---------------------------------------------------------------------------

#[tokio::test]
async fn get_application_by_id() {
    let app = common::setup().await;
    // NOTE: There is no GET /application/{id} route in the Gotify-compat router;
    // applications are listed via GET /application (the full list). This test
    // verifies that the created app is visible in the list under its id.
    let (app_id, _) = common::seed::create_application(&app.pool, 2, "fetch-me").await;

    let resp = app
        .router
        .clone()
        .oneshot(common::get("/application", &app.user_token))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    let body = common::body_json(resp).await;
    let arr = body.as_array().expect("Expected array");
    let found = arr.iter().find(|a| a["id"] == app_id);
    assert!(found.is_some(), "Seeded app should appear in list");
    assert_eq!(found.unwrap()["name"], "fetch-me");
}

#[tokio::test]
async fn get_application_forbidden() {
    // App owned by admin (user 1); regular user should not see it in their list.
    let app = common::setup().await;
    let (admin_app_id, _) = common::seed::create_application(&app.pool, 1, "admin-app").await;

    let resp = app
        .router
        .clone()
        .oneshot(common::get("/application", &app.user_token))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    let body = common::body_json(resp).await;
    let arr = body.as_array().expect("Expected array");
    assert!(
        !arr.iter().any(|a| a["id"] == admin_app_id),
        "Regular user must not see admin's app"
    );
}

// ---------------------------------------------------------------------------
// Update application
// ---------------------------------------------------------------------------

#[tokio::test]
async fn update_application() {
    let app = common::setup().await;
    let (app_id, _) = common::seed::create_application(&app.pool, 2, "old-name").await;

    let resp = app
        .router
        .clone()
        .oneshot(common::put_json(
            &format!("/application/{}", app_id),
            &app.user_token,
            serde_json::json!({ "name": "updated-name" }),
        ))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    let body = common::body_json(resp).await;
    assert_eq!(body["name"], "updated-name");
    assert_eq!(body["id"], app_id);
}

#[tokio::test]
async fn update_application_forbidden() {
    // App owned by admin (user 1); regular user tries to update it → 403.
    let app = common::setup().await;
    let (admin_app_id, _) = common::seed::create_application(&app.pool, 1, "admin-owned").await;

    let resp = app
        .router
        .clone()
        .oneshot(common::put_json(
            &format!("/application/{}", admin_app_id),
            &app.user_token,
            serde_json::json!({ "name": "stolen-name" }),
        ))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::FORBIDDEN);
}

// ---------------------------------------------------------------------------
// Delete application
// ---------------------------------------------------------------------------

#[tokio::test]
async fn delete_application() {
    let app = common::setup().await;
    let (app_id, _) = common::seed::create_application(&app.pool, 2, "to-delete").await;

    let resp = app
        .router
        .clone()
        .oneshot(common::delete(
            &format!("/application/{}", app_id),
            &app.user_token,
        ))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);

    // Confirm it no longer appears in the list
    let list_resp = app
        .router
        .clone()
        .oneshot(common::get("/application", &app.user_token))
        .await
        .unwrap();
    let body = common::body_json(list_resp).await;
    let arr = body.as_array().expect("Expected array");
    assert!(
        !arr.iter().any(|a| a["id"] == app_id),
        "Deleted app should not appear in list"
    );
}

#[tokio::test]
async fn delete_application_forbidden() {
    // App owned by admin (user 1); regular user tries to delete it → 403.
    let app = common::setup().await;
    let (admin_app_id, _) = common::seed::create_application(&app.pool, 1, "admin-only").await;

    let resp = app
        .router
        .clone()
        .oneshot(common::delete(
            &format!("/application/{}", admin_app_id),
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
async fn admin_can_access_any_application() {
    // App owned by regular user (user 2); admin should be able to update it.
    let app = common::setup().await;
    let (app_id, _) = common::seed::create_application(&app.pool, 2, "user-app").await;

    let resp = app
        .router
        .clone()
        .oneshot(common::put_json(
            &format!("/application/{}", app_id),
            &app.admin_token,
            serde_json::json!({ "name": "admin-renamed" }),
        ))
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    let body = common::body_json(resp).await;
    assert_eq!(body["name"], "admin-renamed");
}
