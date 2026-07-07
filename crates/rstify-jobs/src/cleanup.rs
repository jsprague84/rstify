use sqlx::SqlitePool;
use std::collections::HashSet;
use std::time::{Duration, SystemTime};
use tokio_util::sync::CancellationToken;
use tracing::{error, info, warn};

/// Grace period before an unreferenced file is treated as an orphan. Protects an
/// in-flight upload (file written just before its DB row is inserted).
const ORPHAN_GRACE: Duration = Duration::from_secs(3600);

/// Background task that cleans up expired and orphaned attachments.
pub async fn run_attachment_cleanup(
    pool: SqlitePool,
    upload_dir: Option<String>,
    cancel: CancellationToken,
) {
    info!("Attachment cleanup worker started");

    loop {
        tokio::select! {
            _ = cancel.cancelled() => {
                info!("Attachment cleanup worker shutting down");
                break;
            }
            _ = tokio::time::sleep(std::time::Duration::from_secs(3600)) => {
                if let Err(e) = cleanup_expired(&pool).await {
                    error!("Attachment cleanup error: {}", e);
                }
                // Sweep files left on disk when a message (and its attachment
                // rows via ON DELETE CASCADE) was deleted.
                if let Some(ref dir) = upload_dir {
                    match cleanup_orphan_files(&pool, dir, ORPHAN_GRACE).await {
                        Ok(n) if n > 0 => info!("Removed {} orphaned attachment file(s)", n),
                        Err(e) => error!("Orphan file sweep error: {}", e),
                        _ => {}
                    }
                }
            }
        }
    }
}

/// Remove attachment files on disk no longer referenced by any `local` row.
async fn cleanup_orphan_files(
    pool: &SqlitePool,
    upload_dir: &str,
    grace: Duration,
) -> Result<u64, sqlx::Error> {
    let rows: Vec<(String,)> =
        sqlx::query_as("SELECT storage_path FROM attachments WHERE storage_type = 'local'")
            .fetch_all(pool)
            .await?;
    let referenced: HashSet<String> = rows
        .into_iter()
        .filter_map(|(p,)| {
            std::path::Path::new(&p)
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
        })
        .collect();

    Ok(sweep_orphan_files(upload_dir, &referenced, grace).await)
}

/// Delete top-level files in `dir` whose name is not in `referenced` and that are
/// older than `grace`. Subdirectories (e.g. `icons/`) are skipped. Never fails —
/// per-file errors are logged so one bad file can't abort the sweep.
async fn sweep_orphan_files(dir: &str, referenced: &HashSet<String>, grace: Duration) -> u64 {
    let mut read_dir = match tokio::fs::read_dir(dir).await {
        Ok(d) => d,
        Err(e) => {
            warn!("Orphan sweep: cannot read upload dir {}: {}", dir, e);
            return 0;
        }
    };

    let now = SystemTime::now();
    let mut removed = 0u64;

    loop {
        let entry = match read_dir.next_entry().await {
            Ok(Some(e)) => e,
            Ok(None) => break,
            Err(e) => {
                warn!("Orphan sweep: error reading dir entry: {}", e);
                break;
            }
        };
        // Only top-level files; skip subdirectories like icons/.
        match entry.file_type().await {
            Ok(ft) if ft.is_file() => {}
            _ => continue,
        }
        // Grace period: skip anything recently written (possible in-flight upload)
        // or with a future mtime (clock skew).
        if let Ok(meta) = entry.metadata().await {
            if let Ok(modified) = meta.modified() {
                if now
                    .duration_since(modified)
                    .map(|a| a < grace)
                    .unwrap_or(true)
                {
                    continue;
                }
            }
        }
        let name = entry.file_name().to_string_lossy().into_owned();
        if !referenced.contains(&name) {
            match tokio::fs::remove_file(entry.path()).await {
                Ok(()) => {
                    removed += 1;
                    info!("Removed orphaned attachment file {}", name);
                }
                Err(e) => warn!("Failed to remove orphan file {}: {}", name, e),
            }
        }
    }
    removed
}

/// Background task that cleans up expired messages
pub async fn run_message_cleanup(pool: SqlitePool, cancel: CancellationToken) {
    info!("Message cleanup worker started");

    loop {
        tokio::select! {
            _ = cancel.cancelled() => {
                info!("Message cleanup worker shutting down");
                break;
            }
            _ = tokio::time::sleep(std::time::Duration::from_secs(300)) => {
                match cleanup_expired_messages(&pool).await {
                    Ok(count) if count > 0 => info!("Cleaned up {} expired messages", count),
                    Err(e) => error!("Message cleanup error: {}", e),
                    _ => {}
                }
            }
        }
    }
}

async fn cleanup_expired_messages(pool: &SqlitePool) -> Result<u64, sqlx::Error> {
    let result = sqlx::query(
        "DELETE FROM messages WHERE expires_at IS NOT NULL AND expires_at <= datetime('now')",
    )
    .execute(pool)
    .await?;
    Ok(result.rows_affected())
}

/// Background task that enforces per-app message retention policies
pub async fn run_retention_cleanup(pool: SqlitePool, cancel: CancellationToken) {
    info!("Retention cleanup worker started");

    loop {
        tokio::select! {
            _ = cancel.cancelled() => {
                info!("Retention cleanup worker shutting down");
                break;
            }
            _ = tokio::time::sleep(std::time::Duration::from_secs(3600)) => {
                match cleanup_retention(&pool).await {
                    Ok(count) if count > 0 => info!("Retention cleanup removed {} old messages", count),
                    Err(e) => error!("Retention cleanup error: {}", e),
                    _ => {}
                }
            }
        }
    }
}

async fn cleanup_retention(pool: &SqlitePool) -> Result<u64, sqlx::Error> {
    let result = sqlx::query(
        r#"DELETE FROM messages WHERE application_id IN (
            SELECT id FROM applications WHERE retention_days IS NOT NULL
        ) AND created_at < datetime('now', '-' || (
            SELECT retention_days FROM applications WHERE applications.id = messages.application_id
        ) || ' days')"#,
    )
    .execute(pool)
    .await?;
    Ok(result.rows_affected())
}

/// Background task that cleans up old webhook delivery logs (older than 30 days)
pub async fn run_delivery_log_cleanup(pool: SqlitePool, cancel: CancellationToken) {
    info!("Delivery log cleanup worker started");

    loop {
        tokio::select! {
            _ = cancel.cancelled() => {
                info!("Delivery log cleanup worker shutting down");
                break;
            }
            _ = tokio::time::sleep(std::time::Duration::from_secs(86400)) => {
                match cleanup_old_delivery_logs(&pool).await {
                    Ok(count) if count > 0 => info!("Cleaned up {} old delivery log entries", count),
                    Err(e) => error!("Delivery log cleanup error: {}", e),
                    _ => {}
                }
            }
        }
    }
}

async fn cleanup_old_delivery_logs(pool: &SqlitePool) -> Result<u64, sqlx::Error> {
    let result = sqlx::query(
        "DELETE FROM webhook_delivery_log WHERE attempted_at < datetime('now', '-30 days')",
    )
    .execute(pool)
    .await?;
    Ok(result.rows_affected())
}

async fn cleanup_expired(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    let expired = sqlx::query_as::<_, rstify_core::models::Attachment>(
        "SELECT * FROM attachments WHERE expires_at IS NOT NULL AND expires_at <= datetime('now')",
    )
    .fetch_all(pool)
    .await?;

    for attachment in expired {
        // Delete file from disk
        if attachment.storage_type == "local" {
            if let Err(e) = tokio::fs::remove_file(&attachment.storage_path).await {
                warn!("Failed to delete file {}: {}", attachment.storage_path, e);
            }
        }

        sqlx::query("DELETE FROM attachments WHERE id = ?")
            .bind(attachment.id)
            .execute(pool)
            .await?;

        info!("Cleaned up expired attachment {}", attachment.id);
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn sweep_removes_orphans_keeps_referenced_and_subdirs() {
        let dir = std::env::temp_dir().join(format!("rstify-orphan-sweep-{}", std::process::id()));
        let _ = tokio::fs::remove_dir_all(&dir).await;
        tokio::fs::create_dir_all(&dir).await.unwrap();

        // Two top-level files: one referenced, one orphaned.
        tokio::fs::write(dir.join("keep.bin"), b"x").await.unwrap();
        tokio::fs::write(dir.join("orphan.bin"), b"y")
            .await
            .unwrap();
        // A subdirectory (like icons/) must be left entirely alone.
        let icons = dir.join("icons");
        tokio::fs::create_dir_all(&icons).await.unwrap();
        tokio::fs::write(icons.join("icon.png"), b"i")
            .await
            .unwrap();

        let mut referenced = HashSet::new();
        referenced.insert("keep.bin".to_string());

        // grace = ZERO so the freshly written files are eligible.
        let removed = sweep_orphan_files(dir.to_str().unwrap(), &referenced, Duration::ZERO).await;

        assert_eq!(removed, 1, "exactly the orphan should be removed");
        assert!(dir.join("keep.bin").exists(), "referenced file kept");
        assert!(!dir.join("orphan.bin").exists(), "orphan removed");
        assert!(icons.join("icon.png").exists(), "subdirectory untouched");

        let _ = tokio::fs::remove_dir_all(&dir).await;
    }

    #[tokio::test]
    async fn sweep_respects_grace_period() {
        let dir = std::env::temp_dir().join(format!("rstify-orphan-grace-{}", std::process::id()));
        let _ = tokio::fs::remove_dir_all(&dir).await;
        tokio::fs::create_dir_all(&dir).await.unwrap();
        tokio::fs::write(dir.join("fresh.bin"), b"y").await.unwrap();

        // Large grace: the just-written file is within the window, so it is kept
        // even though it is unreferenced (guards against racing an in-flight upload).
        let removed = sweep_orphan_files(
            dir.to_str().unwrap(),
            &HashSet::new(),
            Duration::from_secs(3600),
        )
        .await;

        assert_eq!(removed, 0);
        assert!(dir.join("fresh.bin").exists());

        let _ = tokio::fs::remove_dir_all(&dir).await;
    }
}
