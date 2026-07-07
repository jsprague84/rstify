pub mod error;
pub mod extractors;
pub mod fcm;
pub mod helpers;
pub mod middleware;
pub mod ntfy_headers;
pub mod openapi;
pub mod routes;
pub mod sse;
pub mod state;
pub mod utils;
pub mod web_ui;
pub mod webhooks;
pub mod websocket;

use axum::http::header::HeaderValue;
use axum::Router;
use middleware::rate_limit::RateLimiter;
use state::AppState;
use tower_http::compression::CompressionLayer;
use tower_http::limit::RequestBodyLimitLayer;

pub fn build_router(state: AppState, limiter: RateLimiter) -> Router {
    // Global request-body cap must accommodate the largest attachment (plus a
    // little multipart overhead); otherwise uploads are rejected here before the
    // per-attachment size check ever runs.
    let max_body = state.max_upload_size.saturating_add(1024 * 1024);

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
        .layer(RequestBodyLimitLayer::new(max_body))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            security_headers_middleware,
        ))
        // NOTE: order matters. The last layer added is the outermost (runs
        // first), so `Extension(limiter)` must be added AFTER the rate-limit
        // middleware — otherwise the middleware runs before the extension is
        // inserted, reads `None`, and silently skips rate limiting entirely.
        .layer(axum::middleware::from_fn(
            middleware::rate_limit::rate_limit_middleware,
        ))
        .layer(axum::Extension(limiter))
        .fallback(web_ui::web_ui_handler)
        .with_state(state)
}

async fn security_headers_middleware(
    axum::extract::State(state): axum::extract::State<AppState>,
    request: axum::extract::Request,
    next: axum::middleware::Next,
) -> axum::response::Response {
    state.metrics.inc_requests();

    // Capture request-derived signals before the body is consumed.
    let path = request.uri().path().to_string();
    let is_https = request
        .headers()
        .get("x-forwarded-proto")
        .and_then(|v| v.to_str().ok())
        .map(|v| v.eq_ignore_ascii_case("https"))
        .unwrap_or(false);

    let mut response = next.run(request).await;
    let headers = response.headers_mut();
    headers.insert(
        "x-content-type-options",
        HeaderValue::from_static("nosniff"),
    );
    headers.insert("x-frame-options", HeaderValue::from_static("DENY"));
    // Disable the legacy XSS auditor: it's deprecated and can introduce its own
    // vulnerabilities. CSP below is the real defense.
    headers.insert("x-xss-protection", HeaderValue::from_static("0"));
    headers.insert(
        "referrer-policy",
        HeaderValue::from_static("strict-origin-when-cross-origin"),
    );
    headers.insert(
        "permissions-policy",
        HeaderValue::from_static("camera=(), microphone=(), geolocation=()"),
    );

    // Content-Security-Policy. The app shell has no inline scripts, so it gets a
    // strict `script-src 'self'` that blocks injected <script> (the token-theft
    // vector). Swagger UI at /docs needs inline scripts/styles, so it gets a
    // looser policy. Don't clobber a stricter CSP a handler already set (icons).
    if !headers.contains_key("content-security-policy") {
        let csp = if path.starts_with("/docs") {
            "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
        } else {
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: http:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
        };
        headers.insert("content-security-policy", HeaderValue::from_static(csp));
    }

    // HSTS only when the request arrived over HTTPS (behind a TLS-terminating
    // proxy). Never sent over plain HTTP, so http-only homelab access isn't
    // locked out.
    if is_https {
        headers.insert(
            "strict-transport-security",
            HeaderValue::from_static("max-age=31536000"),
        );
    }

    response
}
