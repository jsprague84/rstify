use rstify_core::models::{Message, MessageResponse};
use sqlx::SqlitePool;
use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use tokio_util::sync::CancellationToken;
use tracing::{error, info};

/// Callback type for broadcasting a delivered message.
/// Receives the message and an optional topic name (resolved from topic_id).
pub type BroadcastFn =
    Arc<dyn Fn(MessageResponse, Option<String>) -> Pin<Box<dyn Future<Output = ()> + Send>> + Send + Sync>;

/// Background task that checks for scheduled messages due for delivery
pub async fn run_scheduled_delivery(
    pool: SqlitePool,
    cancel: CancellationToken,
    broadcast: Option<BroadcastFn>,
) {
    info!("Scheduled delivery worker started");

    loop {
        tokio::select! {
            _ = cancel.cancelled() => {
                info!("Scheduled delivery worker shutting down");
                break;
            }
            _ = tokio::time::sleep(std::time::Duration::from_secs(10)) => {
                if let Err(e) = deliver_scheduled(&pool, &broadcast).await {
                    error!("Scheduled delivery error: {}", e);
                }
            }
        }
    }
}

async fn deliver_scheduled(
    pool: &SqlitePool,
    broadcast: &Option<BroadcastFn>,
) -> Result<(), sqlx::Error> {
    // Use a transaction with UPDATE ... RETURNING to atomically claim messages,
    // preventing double-delivery if multiple workers run concurrently.
    let mut tx = pool.begin().await?;

    let messages = sqlx::query_as::<_, Message>(
        "UPDATE messages SET delivered_at = datetime('now') \
         WHERE id IN ( \
             SELECT id FROM messages \
             WHERE scheduled_for IS NOT NULL \
               AND scheduled_for <= datetime('now') \
               AND delivered_at IS NULL \
         ) RETURNING *",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    for msg in messages {
        info!("Delivered scheduled message {}", msg.id);

        // Broadcast to subscribers if callback provided
        if let Some(broadcast) = broadcast {
            let topic_name = if let Some(topic_id) = msg.topic_id {
                let row: Option<(String,)> =
                    sqlx::query_as("SELECT name FROM topics WHERE id = ?")
                        .bind(topic_id)
                        .fetch_optional(pool)
                        .await
                        .unwrap_or(None);
                row.map(|r| r.0)
            } else {
                None
            };

            let response = msg.to_response(topic_name.clone());
            broadcast(response, topic_name).await;
        }
    }

    Ok(())
}
