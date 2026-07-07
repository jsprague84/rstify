// Regression test: the rate limiter must actually fire through the production
// router. Guards against two bugs found in the P0 security audit — the
// `Extension(limiter)`/middleware layer-ordering bug (middleware ran before the
// limiter extension was inserted and silently no-op'd) and unwired ConnectInfo.
mod common;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::ServiceExt;

#[tokio::test]
async fn rate_limiter_fires_through_router() {
    // Build the production router with a 1-token, zero-refill limiter.
    let jwt_secret = "test-jwt-secret-for-integration-tests".to_string();
    let db = rstify_db::pool::Database::connect("sqlite::memory:")
        .await
        .unwrap();
    db.migrate().await.unwrap();
    let state = rstify_api::state::AppState::new(
        db.pool().clone(),
        jwt_secret,
        "/tmp/rstify-probe-uploads".into(),
        1024 * 1024,
    );
    let limiter = rstify_api::middleware::rate_limit::RateLimiter::new(1, 0.0);
    let router = rstify_api::build_router(state, limiter);

    // First request: should pass (consumes the only token).
    let r1 = router
        .clone()
        .oneshot(
            Request::builder()
                .uri("/health")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(r1.status(), StatusCode::OK, "first request should pass");

    // Second request: if the limiter is wired, this MUST be 429.
    let r2 = router
        .clone()
        .oneshot(
            Request::builder()
                .uri("/health")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(
        r2.status(),
        StatusCode::TOO_MANY_REQUESTS,
        "second request should be rate limited — if this fails with 200, the limiter is bypassed"
    );
}
