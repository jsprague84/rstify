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
