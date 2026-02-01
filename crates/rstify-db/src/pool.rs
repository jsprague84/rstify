use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::SqlitePool;
use std::str::FromStr;
use tracing::info;

#[derive(Clone)]
pub struct Database {
    pool: SqlitePool,
}

impl Database {
    pub async fn connect(url: &str) -> Result<Self, sqlx::Error> {
        let opts = SqliteConnectOptions::from_str(url)?
            .create_if_missing(true)
            .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
            .foreign_keys(true);

        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect_with(opts)
            .await?;

        info!("Connected to SQLite database");
        Ok(Self { pool })
    }

    pub async fn migrate(&self) -> Result<(), sqlx::Error> {
        // Run migrations in order
        let migrations = [
            include_str!("../../../migrations/001_users.sql"),
            include_str!("../../../migrations/002_applications.sql"),
            include_str!("../../../migrations/003_clients.sql"),
            include_str!("../../../migrations/004_topics.sql"),
            include_str!("../../../migrations/005_topic_permissions.sql"),
            include_str!("../../../migrations/006_messages.sql"),
            include_str!("../../../migrations/007_attachments.sql"),
            include_str!("../../../migrations/008_webhook_configs.sql"),
        ];

        for migration in &migrations {
            sqlx::query(migration).execute(&self.pool).await?;
        }

        info!("Database migrations applied successfully");
        Ok(())
    }

    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }
}
