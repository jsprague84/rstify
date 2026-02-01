use sqlx::SqlitePool;
use tokio_util::sync::CancellationToken;
use tracing::{error, info};

/// Background task that checks for scheduled messages due for delivery
pub async fn run_scheduled_delivery(pool: SqlitePool, cancel: CancellationToken) {
    info!("Scheduled delivery worker started");

    loop {
        tokio::select! {
            _ = cancel.cancelled() => {
                info!("Scheduled delivery worker shutting down");
                break;
            }
            _ = tokio::time::sleep(std::time::Duration::from_secs(10)) => {
                if let Err(e) = deliver_scheduled(&pool).await {
                    error!("Scheduled delivery error: {}", e);
                }
            }
        }
    }
}

async fn deliver_scheduled(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    let messages = sqlx::query_as::<_, rstify_core::models::Message>(
        "SELECT * FROM messages WHERE scheduled_for IS NOT NULL AND scheduled_for <= datetime('now') AND delivered_at IS NULL",
    )
    .fetch_all(pool)
    .await?;

    for msg in messages {
        sqlx::query("UPDATE messages SET delivered_at = datetime('now') WHERE id = ?")
            .bind(msg.id)
            .execute(pool)
            .await?;
        info!("Delivered scheduled message {}", msg.id);
    }

    Ok(())
}
