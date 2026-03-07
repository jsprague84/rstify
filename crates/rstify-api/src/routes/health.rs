use axum::extract::State;
use axum::response::IntoResponse;
use axum::Json;
use serde_json::{json, Value};
use std::sync::atomic::Ordering;

use crate::state::AppState;

#[utoipa::path(get, path = "/health", responses((status = 200, body = Value)))]
pub async fn health(State(state): State<AppState>) -> Json<Value> {
    let db_status = match sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(&state.pool)
        .await
    {
        Ok(_) => "ok",
        Err(_) => "error",
    };

    let health = if db_status == "ok" { "green" } else { "red" };

    Json(json!({
        "health": health,
        "database": db_status,
        "version": env!("CARGO_PKG_VERSION")
    }))
}

#[utoipa::path(get, path = "/version", responses((status = 200, body = Value)))]
pub async fn version() -> Json<Value> {
    // Build date can be set via BUILD_DATE env var during compilation
    let build_date = option_env!("BUILD_DATE").unwrap_or("");

    Json(json!({
        "version": env!("CARGO_PKG_VERSION"),
        "name": "rstify",
        "buildDate": build_date
    }))
}

/// GET /metrics - Prometheus-format metrics
pub async fn metrics(State(state): State<AppState>) -> impl IntoResponse {
    let requests = state.metrics.http_requests_total.load(Ordering::Relaxed);
    let messages = state.metrics.messages_created_total.load(Ordering::Relaxed);
    let ws_connections = state.connections.active_count().await;

    let body = format!(
        "# HELP rstify_http_requests_total Total HTTP requests\n\
         # TYPE rstify_http_requests_total counter\n\
         rstify_http_requests_total {}\n\
         # HELP rstify_messages_created_total Total messages created\n\
         # TYPE rstify_messages_created_total counter\n\
         rstify_messages_created_total {}\n\
         # HELP rstify_websocket_connections Current WebSocket connections\n\
         # TYPE rstify_websocket_connections gauge\n\
         rstify_websocket_connections {}\n",
        requests, messages, ws_connections,
    );

    (
        [(axum::http::header::CONTENT_TYPE, "text/plain; version=0.0.4")],
        body,
    )
}
