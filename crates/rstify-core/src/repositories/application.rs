use crate::error::CoreError;
use crate::models::Application;
use async_trait::async_trait;

#[async_trait]
pub trait ApplicationRepository: Send + Sync {
    async fn create(
        &self,
        user_id: i64,
        name: &str,
        description: Option<&str>,
        token: &str,
        default_priority: i32,
    ) -> Result<Application, CoreError>;
    async fn find_by_id(&self, id: i64) -> Result<Option<Application>, CoreError>;
    async fn find_by_token(&self, token: &str) -> Result<Option<Application>, CoreError>;
    async fn list_by_user(&self, user_id: i64) -> Result<Vec<Application>, CoreError>;
    async fn update(
        &self,
        id: i64,
        name: Option<&str>,
        description: Option<&str>,
        default_priority: Option<i32>,
    ) -> Result<Application, CoreError>;
    async fn update_image(&self, id: i64, image: Option<&str>) -> Result<Application, CoreError>;
    async fn delete(&self, id: i64) -> Result<(), CoreError>;
}
