use crate::error::CoreError;
use crate::models::{Attachment, Message, WebhookConfig};
use async_trait::async_trait;

#[allow(clippy::too_many_arguments)]
#[async_trait]
pub trait MessageRepository: Send + Sync {
    async fn create(
        &self,
        application_id: Option<i64>,
        topic_id: Option<i64>,
        user_id: Option<i64>,
        title: Option<&str>,
        message: &str,
        priority: i32,
        tags: Option<&str>,
        click_url: Option<&str>,
        icon_url: Option<&str>,
        actions: Option<&str>,
        extras: Option<&str>,
        content_type: Option<&str>,
        scheduled_for: Option<&str>,
    ) -> Result<Message, CoreError>;

    async fn find_by_id(&self, id: i64) -> Result<Option<Message>, CoreError>;
    async fn list_by_application(
        &self,
        app_id: i64,
        limit: i64,
        since: i64,
    ) -> Result<Vec<Message>, CoreError>;
    async fn list_by_user_apps(
        &self,
        user_id: i64,
        limit: i64,
        since: i64,
    ) -> Result<Vec<Message>, CoreError>;
    async fn list_by_topic(
        &self,
        topic_id: i64,
        limit: i64,
        since: i64,
    ) -> Result<Vec<Message>, CoreError>;
    async fn delete_by_id(&self, id: i64) -> Result<(), CoreError>;
    async fn delete_all_for_user(&self, user_id: i64) -> Result<(), CoreError>;
    async fn delete_all_for_application(&self, app_id: i64) -> Result<(), CoreError>;

    async fn count(&self) -> Result<i64, CoreError>;
    async fn count_since(&self, since: &str) -> Result<i64, CoreError>;

    async fn set_expires_at(&self, id: i64, expires_at: &str) -> Result<(), CoreError>;
    async fn delete_expired_messages(&self) -> Result<u64, CoreError>;

    async fn list_scheduled_due(&self) -> Result<Vec<Message>, CoreError>;
    async fn mark_delivered(&self, id: i64) -> Result<(), CoreError>;

    // Attachments
    async fn create_attachment(
        &self,
        message_id: i64,
        filename: &str,
        content_type: Option<&str>,
        size_bytes: i64,
        storage_type: &str,
        storage_path: &str,
        expires_at: Option<&str>,
    ) -> Result<Attachment, CoreError>;
    async fn find_attachment(&self, id: i64) -> Result<Option<Attachment>, CoreError>;
    async fn list_expired_attachments(&self) -> Result<Vec<Attachment>, CoreError>;
    async fn delete_attachment(&self, id: i64) -> Result<(), CoreError>;

    // Webhook configs
    async fn create_webhook_config(
        &self,
        user_id: i64,
        name: &str,
        token: &str,
        webhook_type: &str,
        target_topic_id: Option<i64>,
        target_application_id: Option<i64>,
        template: &str,
        enabled: bool,
    ) -> Result<WebhookConfig, CoreError>;
    async fn find_webhook_config_by_id(&self, id: i64) -> Result<Option<WebhookConfig>, CoreError>;
    async fn find_webhook_config_by_token(
        &self,
        token: &str,
    ) -> Result<Option<WebhookConfig>, CoreError>;
    async fn list_webhook_configs_by_user(
        &self,
        user_id: i64,
    ) -> Result<Vec<WebhookConfig>, CoreError>;
    async fn update_webhook_config(
        &self,
        id: i64,
        name: Option<&str>,
        template: Option<&str>,
        enabled: Option<bool>,
    ) -> Result<WebhookConfig, CoreError>;
    async fn delete_webhook_config(&self, id: i64) -> Result<(), CoreError>;
}
