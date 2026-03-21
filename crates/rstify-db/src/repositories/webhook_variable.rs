use async_trait::async_trait;
use rstify_core::error::CoreError;
use rstify_core::models::WebhookVariable;
use rstify_core::repositories::WebhookVariableRepository;
use sqlx::SqlitePool;

#[derive(Clone)]
pub struct SqliteWebhookVariableRepo {
    pool: SqlitePool,
}

impl SqliteWebhookVariableRepo {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl WebhookVariableRepository for SqliteWebhookVariableRepo {
    async fn list_webhook_variables(
        &self,
        user_id: i64,
    ) -> Result<Vec<WebhookVariable>, CoreError> {
        sqlx::query_as::<_, WebhookVariable>(
            "SELECT * FROM webhook_variables WHERE user_id = ? ORDER BY key",
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn create_webhook_variable(
        &self,
        user_id: i64,
        key: &str,
        value: &str,
    ) -> Result<WebhookVariable, CoreError> {
        sqlx::query_as::<_, WebhookVariable>(
            "INSERT INTO webhook_variables (user_id, key, value) VALUES (?, ?, ?) RETURNING *",
        )
        .bind(user_id)
        .bind(key)
        .bind(value)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn update_webhook_variable(
        &self,
        id: i64,
        key: Option<&str>,
        value: Option<&str>,
    ) -> Result<WebhookVariable, CoreError> {
        let current =
            sqlx::query_as::<_, WebhookVariable>("SELECT * FROM webhook_variables WHERE id = ?")
                .bind(id)
                .fetch_optional(&self.pool)
                .await
                .map_err(|e| CoreError::Database(e.to_string()))?
                .ok_or_else(|| CoreError::NotFound(format!("Variable {} not found", id)))?;

        let new_key = key.unwrap_or(&current.key);
        let new_value = value.unwrap_or(&current.value);

        sqlx::query_as::<_, WebhookVariable>(
            "UPDATE webhook_variables SET key = ?, value = ? WHERE id = ? RETURNING *",
        )
        .bind(new_key)
        .bind(new_value)
        .bind(id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn delete_webhook_variable(&self, id: i64) -> Result<(), CoreError> {
        let result = sqlx::query("DELETE FROM webhook_variables WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| CoreError::Database(e.to_string()))?;
        if result.rows_affected() == 0 {
            return Err(CoreError::NotFound(format!("Variable {} not found", id)));
        }
        Ok(())
    }
}
