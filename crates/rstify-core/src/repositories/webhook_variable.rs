use crate::error::CoreError;
use crate::models::WebhookVariable;
use async_trait::async_trait;

#[async_trait]
pub trait WebhookVariableRepository: Send + Sync {
    async fn list_webhook_variables(&self, user_id: i64)
        -> Result<Vec<WebhookVariable>, CoreError>;
    async fn create_webhook_variable(
        &self,
        user_id: i64,
        key: &str,
        value: &str,
    ) -> Result<WebhookVariable, CoreError>;
    async fn update_webhook_variable(
        &self,
        id: i64,
        key: Option<&str>,
        value: Option<&str>,
    ) -> Result<WebhookVariable, CoreError>;
    async fn delete_webhook_variable(&self, id: i64) -> Result<(), CoreError>;
}
