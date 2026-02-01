use async_trait::async_trait;
use rstify_core::error::CoreError;
use rstify_core::models::Client;
use rstify_core::repositories::ClientRepository;
use sqlx::SqlitePool;

#[derive(Clone)]
pub struct SqliteClientRepo {
    pool: SqlitePool,
}

impl SqliteClientRepo {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl ClientRepository for SqliteClientRepo {
    async fn create(
        &self,
        user_id: i64,
        name: &str,
        token: &str,
    ) -> Result<Client, CoreError> {
        sqlx::query_as::<_, Client>(
            "INSERT INTO clients (user_id, name, token) VALUES (?, ?, ?) RETURNING *",
        )
        .bind(user_id)
        .bind(name)
        .bind(token)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn find_by_id(&self, id: i64) -> Result<Option<Client>, CoreError> {
        sqlx::query_as::<_, Client>("SELECT * FROM clients WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn find_by_token(&self, token: &str) -> Result<Option<Client>, CoreError> {
        sqlx::query_as::<_, Client>("SELECT * FROM clients WHERE token = ?")
            .bind(token)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn list_by_user(&self, user_id: i64) -> Result<Vec<Client>, CoreError> {
        sqlx::query_as::<_, Client>("SELECT * FROM clients WHERE user_id = ? ORDER BY id")
            .bind(user_id)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn update(&self, id: i64, name: Option<&str>) -> Result<Client, CoreError> {
        let current = self
            .find_by_id(id)
            .await?
            .ok_or_else(|| CoreError::NotFound(format!("Client {} not found", id)))?;

        let new_name = name.unwrap_or(&current.name);

        sqlx::query_as::<_, Client>(
            "UPDATE clients SET name = ? WHERE id = ? RETURNING *",
        )
        .bind(new_name)
        .bind(id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn delete(&self, id: i64) -> Result<(), CoreError> {
        let result = sqlx::query("DELETE FROM clients WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| CoreError::Database(e.to_string()))?;
        if result.rows_affected() == 0 {
            return Err(CoreError::NotFound(format!("Client {} not found", id)));
        }
        Ok(())
    }
}
