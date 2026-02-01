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
        // Create migration tracking table
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS _migrations (
                name TEXT PRIMARY KEY,
                applied_at TEXT NOT NULL DEFAULT (datetime('now'))
            )",
        )
        .execute(&self.pool)
        .await?;

        let migrations: &[(&str, &str)] = &[
            (
                "001_users",
                include_str!("../../../migrations/001_users.sql"),
            ),
            (
                "002_applications",
                include_str!("../../../migrations/002_applications.sql"),
            ),
            (
                "003_clients",
                include_str!("../../../migrations/003_clients.sql"),
            ),
            (
                "004_topics",
                include_str!("../../../migrations/004_topics.sql"),
            ),
            (
                "005_topic_permissions",
                include_str!("../../../migrations/005_topic_permissions.sql"),
            ),
            (
                "006_messages",
                include_str!("../../../migrations/006_messages.sql"),
            ),
            (
                "007_attachments",
                include_str!("../../../migrations/007_attachments.sql"),
            ),
            (
                "008_webhook_configs",
                include_str!("../../../migrations/008_webhook_configs.sql"),
            ),
            (
                "009_indexes",
                include_str!("../../../migrations/009_indexes.sql"),
            ),
            (
                "010_message_expiry",
                include_str!("../../../migrations/010_message_expiry.sql"),
            ),
            (
                "011_outgoing_webhooks",
                include_str!("../../../migrations/011_outgoing_webhooks.sql"),
            ),
            (
                "012_unified_push",
                include_str!("../../../migrations/012_unified_push.sql"),
            ),
            (
                "013_additional_indexes",
                include_str!("../../../migrations/013_additional_indexes.sql"),
            ),
        ];

        for (name, sql) in migrations {
            let applied: bool =
                sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM _migrations WHERE name = ?)")
                    .bind(name)
                    .fetch_one(&self.pool)
                    .await?;

            if !applied {
                // Execute each statement separately for multi-statement migrations
                for stmt in sql.split(';').map(|s| s.trim()).filter(|s| !s.is_empty()) {
                    sqlx::query(stmt).execute(&self.pool).await?;
                }
                sqlx::query("INSERT INTO _migrations (name) VALUES (?)")
                    .bind(name)
                    .execute(&self.pool)
                    .await?;
                info!("Applied migration: {}", name);
            }
        }

        info!("Database migrations applied successfully");
        Ok(())
    }

    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }
}
