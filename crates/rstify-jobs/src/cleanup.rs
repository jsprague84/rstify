use sqlx::SqlitePool;
use tokio_util::sync::CancellationToken;
use tracing::{error, info, warn};

/// Background task that cleans up expired attachments
pub async fn run_attachment_cleanup(pool: SqlitePool, cancel: CancellationToken) {
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
            }
        }
    }
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
