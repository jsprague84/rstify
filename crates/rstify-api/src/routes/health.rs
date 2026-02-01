use axum::Json;
use serde_json::{json, Value};

#[utoipa::path(get, path = "/health", responses((status = 200, body = Value)))]
pub async fn health() -> Json<Value> {
    Json(json!({
        "health": "green",
        "database": "ok"
    }))
}

#[utoipa::path(get, path = "/version", responses((status = 200, body = Value)))]
pub async fn version() -> Json<Value> {
    Json(json!({
        "version": env!("CARGO_PKG_VERSION"),
        "name": "rstify",
        "buildDate": ""
    }))
}
