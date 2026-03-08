use crate::error::CoreError;
use crate::models::MqttBridge;
use async_trait::async_trait;

#[async_trait]
pub trait MqttBridgeRepository: Send + Sync {
    async fn create(
        &self,
        user_id: i64,
        name: &str,
        remote_url: &str,
        subscribe_topics: &str,
        publish_topics: &str,
        username: Option<&str>,
        password: Option<&str>,
        qos: i32,
        topic_prefix: Option<&str>,
        auto_create_topics: bool,
    ) -> Result<MqttBridge, CoreError>;
    async fn find_by_id(&self, id: i64) -> Result<Option<MqttBridge>, CoreError>;
    async fn list_by_user(&self, user_id: i64) -> Result<Vec<MqttBridge>, CoreError>;
    async fn list_enabled(&self) -> Result<Vec<MqttBridge>, CoreError>;
    async fn update(
        &self,
        id: i64,
        name: Option<&str>,
        remote_url: Option<&str>,
        subscribe_topics: Option<&str>,
        publish_topics: Option<&str>,
        username: Option<&str>,
        password: Option<&str>,
        qos: Option<i32>,
        topic_prefix: Option<&str>,
        auto_create_topics: Option<bool>,
        enabled: Option<bool>,
    ) -> Result<MqttBridge, CoreError>;
    async fn delete(&self, id: i64) -> Result<(), CoreError>;
}
