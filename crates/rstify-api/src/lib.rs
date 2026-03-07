pub mod error;
pub mod extractors;
pub mod fcm;
pub mod middleware;
pub mod ntfy_headers;
pub mod openapi;
pub mod routes;
pub mod sse;
pub mod state;
pub mod utils;
pub mod web_ui;
pub mod websocket;

use axum::http::header::HeaderValue;
use axum::Router;
use middleware::rate_limit::RateLimiter;
use state::AppState;
use tower_http::compression::CompressionLayer;
use tower_http::limit::RequestBodyLimitLayer;

pub fn build_router(state: AppState, limiter: RateLimiter) -> Router {
    let api_routes = routes::api_routes(state.clone());
    let gotify_routes = routes::gotify_routes(state.clone());
    let ntfy_routes = routes::ntfy_routes(state.clone());

    let (router, _api) = openapi::build_openapi(state.clone());

    Router::new()
        .merge(router)
        .merge(gotify_routes)
        .merge(api_routes)
        // ntfy catch-all routes must be last so specific routes take priority
        .merge(ntfy_routes)
        // The ntfy /{topic} catch-all only handles POST/PUT. Without this,
        // GET requests to unknown paths (e.g. /icon-512.png) would return 405
        // instead of falling through to the web UI. This handler ensures those
        // requests are served by the web UI instead.
        .method_not_allowed_fallback(web_ui::web_ui_handler)
        .layer(CompressionLayer::new().gzip(true).br(true))
        .layer(RequestBodyLimitLayer::new(1024 * 1024))
        .layer(axum::middleware::from_fn_with_state(state.clone(), security_headers_middleware))
        .layer(axum::Extension(limiter))
        .layer(axum::middleware::from_fn(
            middleware::rate_limit::rate_limit_middleware,
        ))
        .fallback(web_ui::web_ui_handler)
        .with_state(state)
}

async fn security_headers_middleware(
    axum::extract::State(state): axum::extract::State<AppState>,
    request: axum::extract::Request,
    next: axum::middleware::Next,
) -> axum::response::Response {
    state.metrics.inc_requests();
    let mut response = next.run(request).await;
    let headers = response.headers_mut();
    headers.insert("x-content-type-options", HeaderValue::from_static("nosniff"));
    headers.insert("x-frame-options", HeaderValue::from_static("DENY"));
    headers.insert("x-xss-protection", HeaderValue::from_static("1; mode=block"));
    headers.insert(
        "referrer-policy",
        HeaderValue::from_static("strict-origin-when-cross-origin"),
    );
    headers.insert(
        "permissions-policy",
        HeaderValue::from_static("camera=(), microphone=(), geolocation=()"),
    );
    response
}
