use async_trait::async_trait;
use rstify_core::error::CoreError;
use rstify_core::models::User;
use rstify_core::repositories::UserRepository;
use sqlx::SqlitePool;

#[derive(Clone)]
pub struct SqliteUserRepo {
    pool: SqlitePool,
}

impl SqliteUserRepo {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl UserRepository for SqliteUserRepo {
    async fn create(
        &self,
        username: &str,
        password_hash: &str,
        email: Option<&str>,
        is_admin: bool,
    ) -> Result<User, CoreError> {
        let result = sqlx::query_as::<_, User>(
            "INSERT INTO users (username, password_hash, email, is_admin) VALUES (?, ?, ?, ?) RETURNING *",
        )
        .bind(username)
        .bind(password_hash)
        .bind(email)
        .bind(is_admin)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| {
            if e.to_string().contains("UNIQUE") {
                CoreError::AlreadyExists(format!("User '{}' already exists", username))
            } else {
                CoreError::Database(e.to_string())
            }
        })?;
        Ok(result)
    }

    async fn find_by_id(&self, id: i64) -> Result<Option<User>, CoreError> {
        sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn find_by_username(&self, username: &str) -> Result<Option<User>, CoreError> {
        sqlx::query_as::<_, User>("SELECT * FROM users WHERE username = ?")
            .bind(username)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn list_all(&self) -> Result<Vec<User>, CoreError> {
        sqlx::query_as::<_, User>("SELECT * FROM users ORDER BY id")
            .fetch_all(&self.pool)
            .await
            .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn update(
        &self,
        id: i64,
        username: Option<&str>,
        email: Option<&str>,
        is_admin: Option<bool>,
    ) -> Result<User, CoreError> {
        let current = self
            .find_by_id(id)
            .await?
            .ok_or_else(|| CoreError::NotFound(format!("User {} not found", id)))?;

        let new_username = username.unwrap_or(&current.username);
        let new_email = email.or(current.email.as_deref());
        let new_admin = is_admin.unwrap_or(current.is_admin);

        sqlx::query_as::<_, User>(
            "UPDATE users SET username = ?, email = ?, is_admin = ?, updated_at = datetime('now') WHERE id = ? RETURNING *",
        )
        .bind(new_username)
        .bind(new_email)
        .bind(new_admin)
        .bind(id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn update_password(&self, id: i64, password_hash: &str) -> Result<(), CoreError> {
        sqlx::query(
            "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?",
        )
        .bind(password_hash)
        .bind(id)
        .execute(&self.pool)
        .await
        .map_err(|e| CoreError::Database(e.to_string()))?;
        Ok(())
    }

    async fn delete(&self, id: i64) -> Result<(), CoreError> {
        let result = sqlx::query("DELETE FROM users WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| CoreError::Database(e.to_string()))?;
        if result.rows_affected() == 0 {
            return Err(CoreError::NotFound(format!("User {} not found", id)));
        }
        Ok(())
    }

    async fn count(&self) -> Result<i64, CoreError> {
        let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users")
            .fetch_one(&self.pool)
            .await
            .map_err(|e| CoreError::Database(e.to_string()))?;
        Ok(count)
    }
}
