pub mod error;
pub mod extractors;
pub mod middleware;
pub mod ntfy_headers;
pub mod openapi;
pub mod routes;
pub mod sse;
pub mod state;
pub mod utils;
pub mod web_ui;
pub mod websocket;

use axum::Router;
use middleware::rate_limit::RateLimiter;
use state::AppState;
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
        .layer(RequestBodyLimitLayer::new(1024 * 1024)) // 1MB body limit
        .layer(axum::Extension(limiter))
        .layer(axum::middleware::from_fn(
            middleware::rate_limit::rate_limit_middleware,
        ))
        .fallback(web_ui::web_ui_handler)
        .with_state(state)
}
