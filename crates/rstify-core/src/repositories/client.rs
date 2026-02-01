use crate::error::CoreError;
use crate::models::Client;
use async_trait::async_trait;

#[async_trait]
pub trait ClientRepository: Send + Sync {
    async fn create(&self, user_id: i64, name: &str, token: &str) -> Result<Client, CoreError>;
    async fn find_by_id(&self, id: i64) -> Result<Option<Client>, CoreError>;
    async fn find_by_token(&self, token: &str) -> Result<Option<Client>, CoreError>;
    async fn list_by_user(&self, user_id: i64) -> Result<Vec<Client>, CoreError>;
    async fn update(&self, id: i64, name: Option<&str>) -> Result<Client, CoreError>;
    async fn delete(&self, id: i64) -> Result<(), CoreError>;
}
