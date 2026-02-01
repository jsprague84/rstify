use axum::extract::State;
use axum::Json;
use serde_json::{json, Value};

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
        "database": db_status
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
