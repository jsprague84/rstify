use async_trait::async_trait;
use rstify_core::error::CoreError;
use rstify_core::models::MqttBridge;
use rstify_core::repositories::MqttBridgeRepository;
use sqlx::SqlitePool;

#[derive(Clone)]
pub struct SqliteMqttBridgeRepo {
    pool: SqlitePool,
}

impl SqliteMqttBridgeRepo {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl MqttBridgeRepository for SqliteMqttBridgeRepo {
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
    ) -> Result<MqttBridge, CoreError> {
        sqlx::query_as::<_, MqttBridge>(
            "INSERT INTO mqtt_bridges (user_id, name, remote_url, subscribe_topics, publish_topics, \
             username, password, qos, topic_prefix, auto_create_topics) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *",
        )
        .bind(user_id)
        .bind(name)
        .bind(remote_url)
        .bind(subscribe_topics)
        .bind(publish_topics)
        .bind(username)
        .bind(password)
        .bind(qos)
        .bind(topic_prefix)
        .bind(auto_create_topics)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn find_by_id(&self, id: i64) -> Result<Option<MqttBridge>, CoreError> {
        sqlx::query_as::<_, MqttBridge>("SELECT * FROM mqtt_bridges WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn list_by_user(&self, user_id: i64) -> Result<Vec<MqttBridge>, CoreError> {
        sqlx::query_as::<_, MqttBridge>("SELECT * FROM mqtt_bridges WHERE user_id = ? ORDER BY id")
            .bind(user_id)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn list_enabled(&self) -> Result<Vec<MqttBridge>, CoreError> {
        sqlx::query_as::<_, MqttBridge>("SELECT * FROM mqtt_bridges WHERE enabled = 1 ORDER BY id")
            .fetch_all(&self.pool)
            .await
            .map_err(|e| CoreError::Database(e.to_string()))
    }

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
    ) -> Result<MqttBridge, CoreError> {
        let current = self
            .find_by_id(id)
            .await?
            .ok_or_else(|| CoreError::NotFound(format!("MQTT bridge {} not found", id)))?;

        let new_name = name.unwrap_or(&current.name);
        let new_remote_url = remote_url.unwrap_or(&current.remote_url);
        let new_subscribe = subscribe_topics.unwrap_or(&current.subscribe_topics);
        let default_publish = current.publish_topics.clone().unwrap_or_default();
        let new_publish = publish_topics.unwrap_or(&default_publish);
        let new_username = username.or(current.username.as_deref());
        let new_password = password.or(current.password.as_deref());
        let new_qos = qos.or(current.qos).unwrap_or(0);
        let new_topic_prefix = topic_prefix.map(|s| s.to_string()).or(current.topic_prefix);
        let new_auto_create = auto_create_topics.unwrap_or(current.auto_create_topics);
        let new_enabled = enabled.unwrap_or(current.enabled);

        sqlx::query_as::<_, MqttBridge>(
            "UPDATE mqtt_bridges SET name = ?, remote_url = ?, subscribe_topics = ?, \
             publish_topics = ?, username = ?, password = ?, qos = ?, topic_prefix = ?, \
             auto_create_topics = ?, enabled = ? WHERE id = ? RETURNING *",
        )
        .bind(new_name)
        .bind(new_remote_url)
        .bind(new_subscribe)
        .bind(new_publish)
        .bind(new_username)
        .bind(new_password)
        .bind(new_qos)
        .bind(new_topic_prefix)
        .bind(new_auto_create)
        .bind(new_enabled)
        .bind(id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn delete(&self, id: i64) -> Result<(), CoreError> {
        let result = sqlx::query("DELETE FROM mqtt_bridges WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| CoreError::Database(e.to_string()))?;
        if result.rows_affected() == 0 {
            return Err(CoreError::NotFound(format!("MQTT bridge {} not found", id)));
        }
        Ok(())
    }
}
