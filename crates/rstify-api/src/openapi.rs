use axum::Router;
use rstify_core::models::*;
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
        routes::health::health,
        routes::health::version,
        routes::auth::login,
        routes::users::current_user,
        routes::users::change_password,
        routes::users::list_users,
        routes::users::create_user,
        routes::users::delete_user,
        routes::applications::list_applications,
        routes::applications::create_application,
        routes::applications::update_application,
        routes::applications::delete_application,
        routes::clients::list_clients,
        routes::clients::create_client,
        routes::clients::update_client,
        routes::clients::delete_client,
        routes::messages::create_app_message,
        routes::messages::list_messages,
        routes::messages::delete_all_messages,
        routes::messages::delete_message,
        routes::topics::create_topic,
        routes::topics::list_topics,
        routes::topics::get_topic,
        routes::topics::delete_topic,
        routes::topics::publish_to_topic,
        routes::topics::create_permission,
        routes::topics::list_permissions,
        routes::topics::delete_permission,
        routes::attachments::upload_attachment,
        routes::attachments::download_attachment,
        routes::webhooks::create_webhook,
        routes::webhooks::list_webhooks,
        routes::webhooks::update_webhook,
        routes::webhooks::delete_webhook,
        routes::webhooks::receive_webhook,
        routes::users::update_user,
        routes::messages::list_application_messages,
        routes::topics::list_topic_messages,
        routes::stats::get_stats,
        routes::ntfy_publish::ntfy_publish,
        routes::unified_push::receive_up_message,
        routes::unified_push::register_up_device,
        routes::unified_push::list_up_registrations,
        routes::unified_push::delete_up_registration,
    ),
    components(schemas(
        UserResponse,
        CreateUser,
        ChangePassword,
        Application,
        CreateApplication,
        UpdateApplication,
        Client,
        CreateClient,
        UpdateClient,
        Topic,
        CreateTopic,
        TopicPermission,
        CreateTopicPermission,
        MessageResponse,
        CreateAppMessage,
        CreateTopicMessage,
        PagedMessages,
        Paging,
        MessageAction,
        Attachment,
        WebhookConfig,
        CreateWebhookConfig,
        UpdateWebhookConfig,
        routes::auth::LoginRequest,
        routes::auth::LoginResponse,
        routes::stats::StatsResponse,
        UpdateUser,
        UpRegistration,
        CreateUpRegistration,
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
