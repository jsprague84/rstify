pub mod applications;
pub mod attachments;
pub mod auth;
pub mod clients;
pub mod health;
pub mod messages;
pub mod topics;
pub mod users;
pub mod webhooks;

use axum::routing::{delete, get, post, put};
use axum::Router;

use crate::state::AppState;

/// Gotify-compatible routes
pub fn gotify_routes(_state: AppState) -> Router<AppState> {
    Router::new()
        // Messages
        .route("/message", post(messages::create_app_message))
        .route("/message", get(messages::list_messages))
        .route("/message", delete(messages::delete_all_messages))
        .route("/message/{id}", delete(messages::delete_message))
        // Applications
        .route("/application", get(applications::list_applications))
        .route("/application", post(applications::create_application))
        .route("/application/{id}", put(applications::update_application))
        .route(
            "/application/{id}",
            delete(applications::delete_application),
        )
        // Clients
        .route("/client", get(clients::list_clients))
        .route("/client", post(clients::create_client))
        .route("/client/{id}", put(clients::update_client))
        .route("/client/{id}", delete(clients::delete_client))
        // Current user
        .route("/current/user", get(users::current_user))
        .route("/current/user/password", post(users::change_password))
        // Admin user management
        .route("/user", get(users::list_users))
        .route("/user", post(users::create_user))
        .route("/user/{id}", delete(users::delete_user))
        // WebSocket stream
        .route("/stream", get(messages::websocket_stream))
        // Health & version
        .route("/health", get(health::health))
        .route("/version", get(health::version))
}

/// Enhanced API routes (ntfy-inspired)
pub fn api_routes(_state: AppState) -> Router<AppState> {
    Router::new()
        // Auth
        .route("/api/auth/login", post(auth::login))
        // Topics
        .route("/api/topics", post(topics::create_topic))
        .route("/api/topics", get(topics::list_topics))
        .route("/api/topics/{name}", get(topics::get_topic))
        .route("/api/topics/{name}", delete(topics::delete_topic))
        .route("/api/topics/{name}/publish", post(topics::publish_to_topic))
        .route(
            "/api/topics/{name}/ws",
            get(topics::topic_websocket),
        )
        .route(
            "/api/topics/{name}/sse",
            get(crate::sse::topic_sse),
        )
        .route(
            "/api/topics/{name}/json",
            get(topics::topic_json_stream),
        )
        // Attachments
        .route(
            "/api/messages/{id}/attachments",
            post(attachments::upload_attachment),
        )
        .route(
            "/api/attachments/{id}",
            get(attachments::download_attachment),
        )
        // Webhooks
        .route("/api/webhooks", post(webhooks::create_webhook))
        .route("/api/webhooks", get(webhooks::list_webhooks))
        .route("/api/webhooks/{id}", put(webhooks::update_webhook))
        .route("/api/webhooks/{id}", delete(webhooks::delete_webhook))
        .route("/api/wh/{token}", post(webhooks::receive_webhook))
        // Permissions
        .route(
            "/api/permissions",
            post(topics::create_permission),
        )
        .route(
            "/api/permissions",
            get(topics::list_permissions),
        )
        .route(
            "/api/permissions/{id}",
            delete(topics::delete_permission),
        )
}
