use axum::Router;
use rstify_core::models::*;
use rstify_mqtt::bridge::BridgeStatusInfo;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use crate::routes;
use crate::state::AppState;

#[derive(OpenApi)]
#[openapi(
    info(
        title = "rstify",
        description = "Self-hosted push notification server",
        version = "0.1.0"
    ),
    paths(
        // Health & version
        routes::health::health,
        routes::health::version,
        routes::health::metrics,
        // Auth
        routes::auth::login,
        // Users
        routes::users::current_user,
        routes::users::change_password,
        routes::users::list_users,
        routes::users::create_user,
        routes::users::update_user,
        routes::users::delete_user,
        // Applications
        routes::applications::list_applications,
        routes::applications::create_application,
        routes::applications::update_application,
        routes::applications::delete_application,
        routes::applications::upload_icon,
        routes::applications::get_icon,
        routes::applications::delete_icon,
        // Clients
        routes::clients::list_clients,
        routes::clients::create_client,
        routes::clients::update_client,
        routes::clients::delete_client,
        routes::clients::register_fcm_token,
        routes::clients::remove_fcm_token,
        // Messages
        routes::messages::create_app_message,
        routes::messages::list_messages,
        routes::messages::list_application_messages,
        routes::messages::search_messages,
        routes::messages::update_message,
        routes::messages::delete_message,
        routes::messages::delete_all_messages,
        routes::messages::delete_batch_messages,
        routes::messages::delete_all_app_messages,
        routes::messages::websocket_stream,
        // Topics
        routes::topics::create_topic,
        routes::topics::list_topics,
        routes::topics::get_topic,
        routes::topics::update_topic,
        routes::topics::delete_topic,
        routes::topics::publish_to_topic,
        routes::topics::list_topic_messages,
        routes::topics::topic_websocket,
        routes::topics::topic_json_stream,
        crate::sse::topic_sse,
        // Permissions
        routes::topics::create_permission,
        routes::topics::list_permissions,
        routes::topics::delete_permission,
        // Attachments
        routes::attachments::download_attachment,
        routes::attachments::list_message_attachments,
        routes::attachments::delete_attachment,
        // Webhooks
        routes::webhooks::create_webhook,
        routes::webhooks::list_webhooks,
        routes::webhooks::update_webhook,
        routes::webhooks::delete_webhook,
        routes::webhooks::receive_webhook,
        routes::webhooks::regenerate_webhook_token,
        routes::webhooks::list_webhook_deliveries,
        routes::webhooks::test_webhook,
        // Webhook variables
        routes::webhook_variables::list_variables,
        routes::webhook_variables::create_variable,
        routes::webhook_variables::update_variable,
        routes::webhook_variables::delete_variable,
        // MQTT
        routes::mqtt::mqtt_status,
        routes::mqtt::list_bridges,
        routes::mqtt::create_bridge,
        routes::mqtt::update_bridge,
        routes::mqtt::delete_bridge,
        // Settings
        routes::settings::list_settings,
        routes::settings::update_setting,
        // Stats
        routes::stats::get_stats,
        // ntfy-style publish
        routes::ntfy_publish::ntfy_publish,
    ),
    components(schemas(
        UserResponse,
        CreateUser,
        ChangePassword,
        UpdateUser,
        Application,
        CreateApplication,
        UpdateApplication,
        Client,
        CreateClient,
        UpdateClient,
        RegisterFcmToken,
        Topic,
        CreateTopic,
        UpdateTopic,
        TopicPermission,
        CreateTopicPermission,
        MessageResponse,
        CreateAppMessage,
        CreateTopicMessage,
        UpdateMessage,
        PagedMessages,
        Paging,
        MessageAction,
        AttachmentInfo,
        Attachment,
        WebhookConfig,
        CreateWebhookConfig,
        UpdateWebhookConfig,
        WebhookDeliveryLog,
        WebhookVariable,
        CreateWebhookVariable,
        UpdateWebhookVariable,
        MqttBridge,
        CreateMqttBridge,
        UpdateMqttBridge,
        routes::auth::LoginRequest,
        routes::auth::LoginResponse,
        routes::stats::StatsResponse,
        routes::health::HealthResponse,
        routes::health::VersionResponse,
        routes::settings::Setting,
        routes::settings::UpdateSetting,
        routes::mqtt::MqttStatusResponse,
        routes::webhooks::WebhookConfigWithHealth,
        routes::webhooks::TestWebhookPayload,
        routes::webhooks::WebhookTestResult,
        routes::messages::BatchDeleteRequest,
        BridgeStatusInfo,
    ))
)]
struct ApiDoc;

pub fn build_openapi(_state: AppState) -> (Router<AppState>, utoipa::openapi::OpenApi) {
    let api = ApiDoc::openapi();

    let swagger_router: Router<AppState> = SwaggerUi::new("/docs")
        .url("/docs/openapi.json", api.clone())
        .into();
    let router = Router::new().merge(swagger_router);

    (router, api)
}
