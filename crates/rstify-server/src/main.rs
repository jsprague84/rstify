mod config;
mod telemetry;

use rstify_api::state::AppState;
use rstify_auth::password::hash_password;
use rstify_db::pool::Database;
use rstify_jobs::JobRunner;
use std::sync::Arc;
use tracing::{info, warn};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    telemetry::init();

    let config = config::Config::from_env();
    info!("Starting rstify server on {}", config.listen_addr);

    let db = Database::connect(&config.database_url).await?;
    db.migrate().await?;

    let pool = db.pool().clone();

    // Seed default admin user if no users exist (like Gotify)
    let user_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users")
        .fetch_one(&pool)
        .await?;
    if user_count.0 == 0 {
        let password_hash = hash_password("admin".to_string()).await
            .map_err(|e| anyhow::anyhow!("Failed to hash default password: {}", e))?;
        sqlx::query("INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, ?)")
            .bind("admin")
            .bind(&password_hash)
            .bind(true)
            .execute(&pool)
            .await?;
        warn!("Created default admin user (username: admin, password: admin) — change the password immediately!");
    }

    let state = AppState::new(pool.clone(), config.jwt_secret.clone(), config.upload_dir.clone());

    // Create broadcast callback for scheduled message delivery
    let connections = state.connections.clone();
    let broadcast_fn: rstify_jobs::scheduled::BroadcastFn = Arc::new(move |msg, topic_name| {
        let connections = connections.clone();
        Box::pin(async move {
            if let Some(ref name) = topic_name {
                connections.broadcast_to_topic(name, msg).await;
            }
            // For app messages, we'd need user_id which is available from the message's
            // application, but the current callback signature covers the topic case which
            // is what scheduled messages use.
        })
    });

    let job_runner = JobRunner::new(pool).with_broadcast(broadcast_fn);

    let app = rstify_api::build_router(state);

    let app = app
        .layer(tower_http::cors::CorsLayer::permissive())
        .layer(tower_http::trace::TraceLayer::new_for_http());

    job_runner.start().await;

    let listener = tokio::net::TcpListener::bind(&config.listen_addr).await?;
    info!("Listening on {}", config.listen_addr);

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    info!("Shutting down background jobs...");
    job_runner.shutdown();
    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    info!("Shutdown signal received");
}
