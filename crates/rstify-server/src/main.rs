mod config;
mod telemetry;

use axum::http::{HeaderValue, Method};
use rstify_api::middleware::rate_limit::RateLimiter;
use rstify_api::state::AppState;
use rstify_auth::password::hash_password;
use rstify_db::pool::Database;
use rstify_jobs::JobRunner;
use std::sync::Arc;
use std::time::Duration;
use tower_http::cors::CorsLayer;
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
        let password_hash = hash_password("admin".to_string())
            .await
            .map_err(|e| anyhow::anyhow!("Failed to hash default password: {}", e))?;
        sqlx::query("INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, ?)")
            .bind("admin")
            .bind(&password_hash)
            .bind(true)
            .execute(&pool)
            .await?;
        warn!("Created default admin user (username: admin, password: admin) — change the password immediately!");
    }

    let mut state = AppState::new(
        pool.clone(),
        config.jwt_secret.clone(),
        config.upload_dir.clone(),
    );

    // Initialize FCM push notifications if configured
    if config.fcm_enabled {
        if let Some(fcm_config) = rstify_api::fcm::FcmConfig::from_env() {
            info!(
                "FCM push notifications enabled (project: {})",
                fcm_config.project_id
            );
            state = state.with_fcm(rstify_api::fcm::FcmClient::new(fcm_config));
        } else {
            tracing::error!("FCM_PROJECT_ID is set but FCM configuration is incomplete — check FCM_SERVICE_ACCOUNT_PATH");
        }
    } else {
        info!("FCM push notifications disabled (set FCM_PROJECT_ID and FCM_SERVICE_ACCOUNT_PATH to enable)");
    }

    // Start periodic connection cleanup
    let connections_for_cleanup = state.connections.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(60));
        loop {
            interval.tick().await;
            connections_for_cleanup.cleanup_stale_channels().await;
        }
    });

    // Create broadcast callback for scheduled message delivery
    let connections = state.connections.clone();
    let fcm_for_scheduled = state.fcm.clone();
    let client_repo_for_scheduled = state.client_repo.clone();
    let topic_repo_for_scheduled = state.topic_repo.clone();
    let broadcast_fn: rstify_jobs::scheduled::BroadcastFn = Arc::new(move |msg, topic_name| {
        let connections = connections.clone();
        let fcm = fcm_for_scheduled.clone();
        let client_repo = client_repo_for_scheduled.clone();
        let topic_repo = topic_repo_for_scheduled.clone();
        Box::pin(async move {
            if let Some(ref name) = topic_name {
                connections.broadcast_to_topic(name, msg.clone()).await;

                // FCM for scheduled topic messages (respecting notification policy)
                if let Some(ref fcm) = fcm {
                    if let Ok(Some(topic)) =
                        rstify_core::repositories::TopicRepository::find_by_name(&topic_repo, name)
                            .await
                    {
                        if rstify_core::policy::should_notify(&topic, &msg) {
                            if let Some(owner_id) = topic.owner_id {
                                fcm.notify_user(&client_repo, owner_id, &msg).await;
                            }
                        }
                    }
                }
            }
        })
    });

    let job_runner = JobRunner::new(pool).with_broadcast(broadcast_fn);

    // Build rate limiter
    let limiter = RateLimiter::new(config.rate_limit_max, config.rate_limit_rps);

    // Periodic rate limiter cleanup
    let limiter_cleanup = limiter.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(300));
        loop {
            interval.tick().await;
            limiter_cleanup.cleanup().await;
        }
    });

    // Start MQTT broker if enabled (must clone state before build_router takes ownership)
    if config.mqtt_enabled {
        let mqtt_config = rstify_mqtt::MqttConfig::from_env();
        let mqtt_pool = state.pool.clone();
        let mqtt_jwt_secret = state.jwt_secret.clone();
        let mqtt_topic_repo = state.topic_repo.clone();
        let mqtt_message_repo = state.message_repo.clone();
        let mqtt_connections = state.connections.clone();

        match rstify_mqtt::MqttService::start(mqtt_config, mqtt_pool.clone(), mqtt_jwt_secret) {
            Ok((link_tx, link_rx)) => {
                let global_tx = mqtt_connections.global_topic_sender();
                let global_rx = mqtt_connections.subscribe_all_topics();

                let ingest_pool = mqtt_pool.clone();
                std::thread::Builder::new()
                    .name("mqtt-ingest".to_string())
                    .spawn(move || {
                        rstify_mqtt::ingest::run_mqtt_ingest(
                            link_rx,
                            mqtt_topic_repo,
                            mqtt_message_repo,
                            global_tx,
                            ingest_pool,
                        );
                    })
                    .expect("Failed to spawn MQTT ingest thread");

                std::thread::Builder::new()
                    .name("mqtt-publisher".to_string())
                    .spawn(move || {
                        rstify_mqtt::publish::run_mqtt_publisher(link_tx, global_rx);
                    })
                    .expect("Failed to spawn MQTT publisher thread");

                info!("MQTT broker, ingest, and publisher started");
            }
            Err(e) => {
                tracing::error!("Failed to start MQTT service: {e}");
            }
        }

        // Create and wire BridgeManager
        let bridge_topic_broadcast = state.connections.global_topic_sender();
        let bridge_manager = rstify_mqtt::bridge::BridgeManager::new(
            state.topic_repo.clone(),
            state.message_repo.clone(),
            state.mqtt_bridge_repo.clone(),
            bridge_topic_broadcast,
            state.pool.clone(),
        );
        let bridge_manager = std::sync::Arc::new(tokio::sync::Mutex::new(bridge_manager));
        // Start all enabled bridges
        bridge_manager.lock().await.start_all_enabled().await;
        state = state.with_bridge_manager(bridge_manager);
    } else {
        info!("MQTT broker disabled (set MQTT_ENABLED=true to enable)");
    }

    let app = rstify_api::build_router(state, limiter);

    // CORS configuration
    let cors = if config.cors_origins.is_empty() {
        warn!("CORS_ORIGINS not set — defaulting to same-origin only. Set CORS_ORIGINS env var for cross-origin access.");
        CorsLayer::new()
    } else {
        let origins: Vec<HeaderValue> = config
            .cors_origins
            .iter()
            .filter_map(|o| o.parse::<HeaderValue>().ok())
            .collect();
        CorsLayer::new()
            .allow_origin(origins)
            .allow_methods([
                Method::GET,
                Method::POST,
                Method::PUT,
                Method::DELETE,
                Method::OPTIONS,
            ])
            .allow_headers(tower_http::cors::Any)
            .allow_credentials(true)
    };

    let app = app
        .layer(cors)
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
