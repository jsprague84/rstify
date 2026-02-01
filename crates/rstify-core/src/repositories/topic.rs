use crate::error::CoreError;
use crate::models::{Topic, TopicPermission};
use async_trait::async_trait;

#[async_trait]
pub trait TopicRepository: Send + Sync {
    async fn create(&self, name: &str, owner_id: Option<i64>, description: Option<&str>, everyone_read: bool, everyone_write: bool) -> Result<Topic, CoreError>;
    async fn find_by_id(&self, id: i64) -> Result<Option<Topic>, CoreError>;
    async fn find_by_name(&self, name: &str) -> Result<Option<Topic>, CoreError>;
    async fn list_all(&self) -> Result<Vec<Topic>, CoreError>;
    async fn delete(&self, id: i64) -> Result<(), CoreError>;
    async fn count(&self) -> Result<i64, CoreError>;

    async fn create_permission(&self, user_id: i64, topic_pattern: &str, can_read: bool, can_write: bool) -> Result<TopicPermission, CoreError>;
    async fn list_permissions_for_user(&self, user_id: i64) -> Result<Vec<TopicPermission>, CoreError>;
    async fn list_all_permissions(&self) -> Result<Vec<TopicPermission>, CoreError>;
    async fn delete_permission(&self, id: i64) -> Result<(), CoreError>;
}
