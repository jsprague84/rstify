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
        scopes: &str,
    ) -> Result<Client, CoreError> {
        sqlx::query_as::<_, Client>(
            "INSERT INTO clients (user_id, name, token, scopes) VALUES (?, ?, ?, ?) RETURNING *",
        )
        .bind(user_id)
        .bind(name)
        .bind(token)
        .bind(scopes)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| {
            if e.to_string().contains("UNIQUE") {
                CoreError::AlreadyExists(format!("Client '{}' already exists", name))
            } else {
                CoreError::Database(e.to_string())
            }
        })
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

    async fn update(
        &self,
        id: i64,
        name: Option<&str>,
        scopes: Option<&str>,
    ) -> Result<Client, CoreError> {
        let current = self
            .find_by_id(id)
            .await?
            .ok_or_else(|| CoreError::NotFound(format!("Client {} not found", id)))?;

        let new_name = name.unwrap_or(&current.name);
        let new_scopes = scopes.unwrap_or(&current.scopes);

        sqlx::query_as::<_, Client>(
            "UPDATE clients SET name = ?, scopes = ? WHERE id = ? RETURNING *",
        )
        .bind(new_name)
        .bind(new_scopes)
        .bind(id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn update_fcm_token(
        &self,
        id: i64,
        fcm_token: Option<&str>,
    ) -> Result<Client, CoreError> {
        sqlx::query_as::<_, Client>("UPDATE clients SET fcm_token = ? WHERE id = ? RETURNING *")
            .bind(fcm_token)
            .bind(id)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn list_fcm_tokens_by_user(&self, user_id: i64) -> Result<Vec<String>, CoreError> {
        let rows: Vec<(String,)> = sqlx::query_as(
            "SELECT fcm_token FROM clients WHERE user_id = ? AND fcm_token IS NOT NULL",
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| CoreError::Database(e.to_string()))?;
        Ok(rows.into_iter().map(|r| r.0).collect())
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
