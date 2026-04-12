use axum::extract::State;
use axum::response::IntoResponse;
use axum::Json;
use serde::Serialize;
use std::sync::atomic::Ordering;
use ts_rs::TS;
use utoipa::ToSchema;

use crate::state::AppState;

#[derive(Debug, Serialize, ToSchema, TS)]
#[ts(export)]
pub struct HealthResponse {
    pub health: String,
    pub database: String,
    pub version: String,
}

#[derive(Debug, Serialize, ToSchema, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct VersionResponse {
    pub version: String,
    pub name: String,
    pub build_date: String,
}

#[utoipa::path(get, path = "/health", responses((status = 200, body = HealthResponse)))]
pub async fn health(State(state): State<AppState>) -> Json<HealthResponse> {
    let db_status = match sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(&state.pool)
        .await
    {
        Ok(_) => "ok",
        Err(_) => "error",
    };

    let health = if db_status == "ok" { "green" } else { "red" };

    Json(HealthResponse {
        health: health.to_string(),
        database: db_status.to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

#[utoipa::path(get, path = "/version", responses((status = 200, body = VersionResponse)))]
pub async fn version() -> Json<VersionResponse> {
    let build_date = option_env!("BUILD_DATE").unwrap_or("");

    Json(VersionResponse {
        version: env!("CARGO_PKG_VERSION").to_string(),
        name: "rstify".to_string(),
        build_date: build_date.to_string(),
    })
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
        [(
            axum::http::header::CONTENT_TYPE,
            "text/plain; version=0.0.4",
        )],
        body,
    )
}
