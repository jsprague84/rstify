use async_trait::async_trait;
use rstify_core::error::CoreError;
use rstify_core::models::{Topic, TopicPermission};
use rstify_core::repositories::TopicRepository;
use sqlx::SqlitePool;

#[derive(Clone)]
pub struct SqliteTopicRepo {
    pool: SqlitePool,
}

impl SqliteTopicRepo {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl TopicRepository for SqliteTopicRepo {
    async fn create(
        &self,
        name: &str,
        owner_id: Option<i64>,
        description: Option<&str>,
        everyone_read: bool,
        everyone_write: bool,
    ) -> Result<Topic, CoreError> {
        sqlx::query_as::<_, Topic>(
            "INSERT INTO topics (name, owner_id, description, everyone_read, everyone_write) VALUES (?, ?, ?, ?, ?) RETURNING *",
        )
        .bind(name)
        .bind(owner_id)
        .bind(description)
        .bind(everyone_read)
        .bind(everyone_write)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| {
            if e.to_string().contains("UNIQUE") {
                CoreError::AlreadyExists(format!("Topic '{}' already exists", name))
            } else {
                CoreError::Database(e.to_string())
            }
        })
    }

    async fn find_by_id(&self, id: i64) -> Result<Option<Topic>, CoreError> {
        sqlx::query_as::<_, Topic>("SELECT * FROM topics WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn find_by_name(&self, name: &str) -> Result<Option<Topic>, CoreError> {
        sqlx::query_as::<_, Topic>("SELECT * FROM topics WHERE name = ?")
            .bind(name)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn list_all(&self) -> Result<Vec<Topic>, CoreError> {
        sqlx::query_as::<_, Topic>("SELECT * FROM topics ORDER BY id")
            .fetch_all(&self.pool)
            .await
            .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn list_visible(&self, user_id: i64) -> Result<Vec<Topic>, CoreError> {
        sqlx::query_as::<_, Topic>(
            r#"SELECT DISTINCT t.* FROM topics t
            LEFT JOIN topic_permissions tp ON tp.user_id = ? AND tp.can_read = 1
            WHERE t.everyone_read = 1
               OR t.owner_id = ?
               OR (tp.id IS NOT NULL AND (
                   t.name = tp.topic_pattern
                   OR t.name LIKE REPLACE(REPLACE(tp.topic_pattern, '*', '%'), '?', '_')
               ))
            ORDER BY t.id"#,
        )
        .bind(user_id)
        .bind(user_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn update(
        &self,
        id: i64,
        description: Option<&str>,
        everyone_read: Option<bool>,
        everyone_write: Option<bool>,
    ) -> Result<Topic, CoreError> {
        let current = self
            .find_by_id(id)
            .await?
            .ok_or_else(|| CoreError::NotFound(format!("Topic {} not found", id)))?;

        let new_desc = description.or(current.description.as_deref());
        let new_read = everyone_read.unwrap_or(current.everyone_read);
        let new_write = everyone_write.unwrap_or(current.everyone_write);

        sqlx::query_as::<_, Topic>(
            "UPDATE topics SET description = ?, everyone_read = ?, everyone_write = ? WHERE id = ? RETURNING *",
        )
        .bind(new_desc)
        .bind(new_read)
        .bind(new_write)
        .bind(id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn delete(&self, id: i64) -> Result<(), CoreError> {
        let result = sqlx::query("DELETE FROM topics WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| CoreError::Database(e.to_string()))?;
        if result.rows_affected() == 0 {
            return Err(CoreError::NotFound(format!("Topic {} not found", id)));
        }
        Ok(())
    }

    async fn count(&self) -> Result<i64, CoreError> {
        let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM topics")
            .fetch_one(&self.pool)
            .await
            .map_err(|e| CoreError::Database(e.to_string()))?;
        Ok(count)
    }

    async fn create_permission(
        &self,
        user_id: i64,
        topic_pattern: &str,
        can_read: bool,
        can_write: bool,
    ) -> Result<TopicPermission, CoreError> {
        sqlx::query_as::<_, TopicPermission>(
            "INSERT INTO topic_permissions (user_id, topic_pattern, can_read, can_write) VALUES (?, ?, ?, ?) RETURNING *",
        )
        .bind(user_id)
        .bind(topic_pattern)
        .bind(can_read)
        .bind(can_write)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn list_permissions_for_user(
        &self,
        user_id: i64,
    ) -> Result<Vec<TopicPermission>, CoreError> {
        sqlx::query_as::<_, TopicPermission>(
            "SELECT * FROM topic_permissions WHERE user_id = ? ORDER BY id",
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn list_all_permissions(&self) -> Result<Vec<TopicPermission>, CoreError> {
        sqlx::query_as::<_, TopicPermission>("SELECT * FROM topic_permissions ORDER BY id")
            .fetch_all(&self.pool)
            .await
            .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn delete_permission(&self, id: i64) -> Result<(), CoreError> {
        let result = sqlx::query("DELETE FROM topic_permissions WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| CoreError::Database(e.to_string()))?;
        if result.rows_affected() == 0 {
            return Err(CoreError::NotFound(format!("Permission {} not found", id)));
        }
        Ok(())
    }
}
