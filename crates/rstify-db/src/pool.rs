use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::SqlitePool;
use std::str::FromStr;
use std::time::Duration;
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
            .foreign_keys(true)
            // Performance optimizations
            .busy_timeout(Duration::from_secs(5)) // Wait up to 5s for locks
            .pragma("cache_size", "-64000") // 64MB cache (negative = KB)
            .pragma("temp_store", "memory") // Store temp tables in memory
            .pragma("mmap_size", "268435456") // 256MB memory-mapped I/O
            .pragma("synchronous", "NORMAL") // Balance safety/performance
            .pragma("wal_autocheckpoint", "1000"); // Checkpoint every 1000 pages

        let pool = SqlitePoolOptions::new()
            .max_connections(20) // Increased from 5
            .min_connections(2) // Keep 2 warm connections
            .acquire_timeout(Duration::from_secs(3)) // Fail fast if pool exhausted
            .idle_timeout(Duration::from_secs(600)) // Close idle after 10min
            .max_lifetime(Duration::from_secs(1800)) // Recreate after 30min
            .connect_with(opts)
            .await?;

        info!("Connected to SQLite database with optimized pool (max: 20, min: 2)");
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
            (
                "014_fcm_tokens",
                include_str!("../../../migrations/014_fcm_tokens.sql"),
            ),
            (
                "015_fts5_messages",
                include_str!("../../../migrations/015_fts5_messages.sql"),
            ),
            (
                "016_retention_days",
                include_str!("../../../migrations/016_retention_days.sql"),
            ),
            (
                "017_client_scopes",
                include_str!("../../../migrations/017_client_scopes.sql"),
            ),
            (
                "018_webhook_delivery_log",
                include_str!("../../../migrations/018_webhook_delivery_log.sql"),
            ),
            (
                "019_message_source",
                include_str!("../../../migrations/019_message_source.sql"),
            ),
            (
                "020_topic_notification_policy",
                include_str!("../../../migrations/020_topic_notification_policy.sql"),
            ),
            (
                "021_mqtt_bridges",
                include_str!("../../../migrations/021_mqtt_bridges.sql"),
            ),
            (
                "022_webhook_timeout",
                include_str!("../../../migrations/022_webhook_timeout.sql"),
            ),
        ];

        for (name, sql) in migrations {
            let applied: bool =
                sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM _migrations WHERE name = ?)")
                    .bind(name)
                    .fetch_one(&self.pool)
                    .await?;

            if !applied {
                // Execute each statement separately for multi-statement migrations.
                // Use a simple state machine to avoid splitting inside BEGIN...END blocks
                // (e.g., trigger definitions contain semicolons in their body).
                for stmt in split_sql_statements(sql) {
                    sqlx::query(&stmt).execute(&self.pool).await?;
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

/// Split SQL text into individual statements, respecting BEGIN...END blocks
/// so that trigger bodies (which contain semicolons) are kept intact.
fn split_sql_statements(sql: &str) -> Vec<String> {
    let mut statements = Vec::new();
    let mut current = String::new();
    let mut depth = 0; // Track BEGIN...END nesting

    for line in sql.lines() {
        let upper = line.trim().to_uppercase();

        // Detect BEGIN (e.g., "... BEGIN" at end of CREATE TRIGGER line)
        if upper.ends_with("BEGIN") || upper.ends_with("BEGIN ") {
            depth += 1;
        }

        current.push_str(line);
        current.push('\n');

        // END; closes a BEGIN block
        if upper == "END;" && depth > 0 {
            depth -= 1;
            if depth == 0 {
                let stmt = current.trim().trim_end_matches(';').trim().to_string();
                if !stmt.is_empty() {
                    statements.push(stmt);
                }
                current.clear();
            }
        } else if depth == 0 && upper.ends_with(';') {
            let stmt = current.trim().trim_end_matches(';').trim().to_string();
            if !stmt.is_empty() {
                statements.push(stmt);
            }
            current.clear();
        }
    }

    // Handle any trailing statement without semicolon
    let stmt = current.trim().trim_end_matches(';').trim().to_string();
    if !stmt.is_empty() {
        statements.push(stmt);
    }

    statements
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_split_sql_with_triggers() {
        let sql = r#"
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(title, message);

INSERT INTO messages_fts(rowid, title, message) SELECT id, title, message FROM messages;

CREATE TRIGGER messages_fts_insert AFTER INSERT ON messages BEGIN
    INSERT INTO messages_fts(rowid, title, message) VALUES (new.id, new.title, new.message);
END;

CREATE TRIGGER messages_fts_delete AFTER DELETE ON messages BEGIN
    INSERT INTO messages_fts(messages_fts, rowid, title, message) VALUES ('delete', old.id, old.title, old.message);
END;
"#;
        let stmts = split_sql_statements(sql);
        assert_eq!(stmts.len(), 4);
        assert!(stmts[0].starts_with("CREATE VIRTUAL TABLE"));
        assert!(stmts[1].starts_with("INSERT INTO messages_fts"));
        assert!(stmts[2].contains("BEGIN"));
        assert!(stmts[2].contains("END"));
        assert!(stmts[3].contains("BEGIN"));
        assert!(stmts[3].contains("END"));
    }
}
