use crate::error::CoreError;
use crate::models::User;
use async_trait::async_trait;

#[async_trait]
pub trait UserRepository: Send + Sync {
    async fn create(&self, username: &str, password_hash: &str, email: Option<&str>, is_admin: bool) -> Result<User, CoreError>;
    async fn find_by_id(&self, id: i64) -> Result<Option<User>, CoreError>;
    async fn find_by_username(&self, username: &str) -> Result<Option<User>, CoreError>;
    async fn list_all(&self) -> Result<Vec<User>, CoreError>;
    async fn update(&self, id: i64, username: Option<&str>, email: Option<&str>, is_admin: Option<bool>) -> Result<User, CoreError>;
    async fn update_password(&self, id: i64, password_hash: &str) -> Result<(), CoreError>;
    async fn delete(&self, id: i64) -> Result<(), CoreError>;
}
