pub mod error;
pub mod extractors;
pub mod middleware;
pub mod openapi;
pub mod routes;
pub mod sse;
pub mod state;
pub mod websocket;

use axum::Router;
use state::AppState;

pub fn build_router(state: AppState) -> Router {
    let api_routes = routes::api_routes(state.clone());
    let gotify_routes = routes::gotify_routes(state.clone());

    let (router, _api) = openapi::build_openapi(state.clone());

    Router::new()
        .merge(router)
        .merge(gotify_routes)
        .merge(api_routes)
        .with_state(state)
}
