use async_trait::async_trait;
use rstify_core::error::CoreError;
use rstify_core::models::Application;
use rstify_core::repositories::ApplicationRepository;
use sqlx::SqlitePool;

#[derive(Clone)]
pub struct SqliteApplicationRepo {
    pool: SqlitePool,
}

impl SqliteApplicationRepo {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl ApplicationRepository for SqliteApplicationRepo {
    async fn create(
        &self,
        user_id: i64,
        name: &str,
        description: Option<&str>,
        token: &str,
        default_priority: i32,
    ) -> Result<Application, CoreError> {
        sqlx::query_as::<_, Application>(
            "INSERT INTO applications (user_id, name, description, token, default_priority) VALUES (?, ?, ?, ?, ?) RETURNING *",
        )
        .bind(user_id)
        .bind(name)
        .bind(description)
        .bind(token)
        .bind(default_priority)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn find_by_id(&self, id: i64) -> Result<Option<Application>, CoreError> {
        sqlx::query_as::<_, Application>("SELECT * FROM applications WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn find_by_token(&self, token: &str) -> Result<Option<Application>, CoreError> {
        sqlx::query_as::<_, Application>("SELECT * FROM applications WHERE token = ?")
            .bind(token)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn list_by_user(&self, user_id: i64) -> Result<Vec<Application>, CoreError> {
        sqlx::query_as::<_, Application>("SELECT * FROM applications WHERE user_id = ? ORDER BY id")
            .bind(user_id)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn update(
        &self,
        id: i64,
        name: Option<&str>,
        description: Option<&str>,
        default_priority: Option<i32>,
    ) -> Result<Application, CoreError> {
        let current = self
            .find_by_id(id)
            .await?
            .ok_or_else(|| CoreError::NotFound(format!("Application {} not found", id)))?;

        let new_name = name.unwrap_or(&current.name);
        let new_desc = description.or(current.description.as_deref());
        let new_priority = default_priority.unwrap_or(current.default_priority);

        sqlx::query_as::<_, Application>(
            "UPDATE applications SET name = ?, description = ?, default_priority = ?, updated_at = datetime('now') WHERE id = ? RETURNING *",
        )
        .bind(new_name)
        .bind(new_desc)
        .bind(new_priority)
        .bind(id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn update_image(
        &self,
        id: i64,
        image: Option<&str>,
    ) -> Result<Application, CoreError> {
        sqlx::query_as::<_, Application>(
            "UPDATE applications SET image = ?, updated_at = datetime('now') WHERE id = ? RETURNING *",
        )
        .bind(image)
        .bind(id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn delete(&self, id: i64) -> Result<(), CoreError> {
        let result = sqlx::query("DELETE FROM applications WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| CoreError::Database(e.to_string()))?;
        if result.rows_affected() == 0 {
            return Err(CoreError::NotFound(format!("Application {} not found", id)));
        }
        Ok(())
    }
}
