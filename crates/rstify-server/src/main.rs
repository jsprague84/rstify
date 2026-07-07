mod config;
mod telemetry;

use axum::http::{header, HeaderValue, Method};
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

    let config = config::Config::from_env().expect("Failed to load configuration");
    info!("Starting rstify server on {}", config.server.listen_addr);

    // Apply the outbound-URL SSRF policy for outgoing webhooks / attachment fetches.
    rstify_jobs::ssrf::set_allow_private_targets(config.webhook_allow_private_targets);
    if config.webhook_allow_private_targets {
        warn!("WEBHOOK_ALLOW_PRIVATE_TARGETS=true — outgoing webhooks and attachment fetches may reach private/LAN/reserved addresses. Enable only on a trusted single-user instance.");
    }

    let db = Database::connect(&config.database.url).await?;
    db.migrate().await?;

    let pool = db.pool().clone();

    // Seed default admin user if no users exist (like Gotify)
    let user_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users")
        .fetch_one(&pool)
        .await?;
    if user_count.0 == 0 {
        // Generate a random initial password instead of the well-known admin/admin,
        // and print it once so the operator can log in and change it.
        let initial_password = uuid::Uuid::new_v4().simple().to_string();
        let password_hash = hash_password(initial_password.clone())
            .await
            .map_err(|e| anyhow::anyhow!("Failed to hash default password: {}", e))?;
        sqlx::query("INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, ?)")
            .bind("admin")
            .bind(&password_hash)
            .bind(true)
            .execute(&pool)
            .await?;
        warn!(
            "Created initial admin user — username: admin, password: {} — \
             log in and change it now (shown only once).",
            initial_password
        );
    }

    // Load inbox_priority_threshold setting from DB (default 5)
    let inbox_threshold_value: i32 = sqlx::query_scalar(
        "SELECT CAST(value AS INTEGER) FROM settings WHERE key = 'inbox_priority_threshold'",
    )
    .fetch_optional(&pool)
    .await
    .ok()
    .flatten()
    .unwrap_or(5);

    let mut state = AppState::new(
        pool.clone(),
        config.auth.jwt_secret.clone(),
        config.server.upload_dir.clone(),
        config.server.max_attachment_size,
    );
    state
        .inbox_threshold
        .store(inbox_threshold_value, std::sync::atomic::Ordering::Relaxed);

    // Initialize FCM push notifications if configured
    if let Some(ref fcm_cfg) = config.fcm {
        if let Some(fcm_config) = rstify_api::fcm::FcmConfig::from_path(
            fcm_cfg.project_id.clone(),
            &fcm_cfg.service_account_path,
        ) {
            info!(
                "FCM push notifications enabled (project: {})",
                fcm_cfg.project_id
            );
            state = state.with_fcm(rstify_api::fcm::FcmClient::new(fcm_config));
        } else {
            tracing::error!("FCM configuration invalid — push notifications disabled");
        }
    } else {
        info!("FCM push notifications disabled (set FCM_PROJECT_ID and FCM_SERVICE_ACCOUNT_PATH to enable)");
    }

    // Wire SMTP email config if configured
    if let Some(ref smtp_cfg) = config.smtp {
        let email_config = rstify_jobs::email::EmailConfig::new(
            smtp_cfg.host.clone(),
            smtp_cfg.port,
            smtp_cfg.username.clone(),
            smtp_cfg.password.clone(),
            smtp_cfg.from.clone(),
        );
        state = state.with_email_config(email_config);
        info!("SMTP email notifications enabled (host: {})", smtp_cfg.host);
    }

    // Background jobs and the ad-hoc cleanup loops below share one cancellation
    // token so shutdown stops everything cleanly.
    let job_runner = JobRunner::new(pool.clone());
    let cancel = job_runner.cancel_token();

    // Periodic connection cleanup (cancellable + joined on shutdown).
    let connections_for_cleanup = state.connections.clone();
    let conn_cancel = cancel.clone();
    let conn_cleanup_handle = tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(60));
        loop {
            tokio::select! {
                _ = conn_cancel.cancelled() => break,
                _ = interval.tick() => connections_for_cleanup.cleanup_stale_channels().await,
            }
        }
    });

    // Create broadcast callback for scheduled message delivery. This runs at SEND
    // time (not creation), so it fires the full delivery — broadcast + outgoing
    // webhooks + push — mirroring the immediate path's deliver_message().
    let connections = state.connections.clone();
    let fcm_for_scheduled = state.fcm.clone();
    let client_repo_for_scheduled = state.client_repo.clone();
    let topic_repo_for_scheduled = state.topic_repo.clone();
    let pool_for_scheduled = pool.clone();
    let broadcast_fn: rstify_jobs::scheduled::BroadcastFn = Arc::new(move |msg, topic_name| {
        let connections = connections.clone();
        let fcm = fcm_for_scheduled.clone();
        let client_repo = client_repo_for_scheduled.clone();
        let topic_repo = topic_repo_for_scheduled.clone();
        let pool = pool_for_scheduled.clone();
        Box::pin(async move {
            if let Some(ref name) = topic_name {
                connections.broadcast_to_topic(name, msg.clone()).await;

                // Outgoing webhooks fire now (delivery time), matching immediate sends.
                rstify_jobs::outgoing_webhooks::fire_outgoing_webhooks(&pool, name, &msg).await;

                // FCM for scheduled topic messages (respecting notification policy)
                if let Some(ref fcm) = fcm {
                    if let Ok(Some(topic)) =
                        rstify_core::repositories::TopicRepository::find_by_name(&topic_repo, name)
                            .await
                    {
                        if msg.inbox && rstify_core::policy::should_notify(&topic, &msg) {
                            if let Some(owner_id) = topic.owner_id {
                                fcm.notify_user(
                                    &client_repo,
                                    owner_id,
                                    &msg,
                                    msg.icon_url.as_deref(),
                                )
                                .await;
                            }
                        }
                    }
                }
            }
        })
    });

    let job_runner = job_runner
        .with_broadcast(broadcast_fn)
        .with_upload_dir(config.server.upload_dir.clone());

    // Build rate limiter. Keys on the real TCP peer IP unless a trusted proxy is
    // declared (RATE_LIMIT_TRUST_PROXY), preventing X-Forwarded-For spoofing.
    let limiter = RateLimiter::new(config.rate_limit.burst, config.rate_limit.rps)
        .trust_forwarded_for(config.rate_limit.trust_proxy);

    // Periodic rate limiter cleanup (cancellable + joined on shutdown).
    let limiter_cleanup = limiter.clone();
    let limiter_cancel = cancel.clone();
    let limiter_cleanup_handle = tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(300));
        loop {
            tokio::select! {
                _ = limiter_cancel.cancelled() => break,
                _ = interval.tick() => limiter_cleanup.cleanup().await,
            }
        }
    });

    let app = rstify_api::build_router(state, limiter);

    // CORS configuration
    let cors = if config.cors.origins.is_empty() {
        warn!("CORS_ORIGINS not set — defaulting to same-origin only. Set CORS_ORIGINS env var for cross-origin access.");
        CorsLayer::new()
    } else {
        let origins: Vec<HeaderValue> = config
            .cors
            .origins
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
            .allow_headers([
                header::AUTHORIZATION,
                header::CONTENT_TYPE,
                header::ACCEPT,
                header::HeaderName::from_static("x-gotify-key"),
                header::HeaderName::from_static("x-requested-with"),
            ])
            .allow_credentials(true)
    };

    let app = app
        .layer(cors)
        .layer(tower_http::trace::TraceLayer::new_for_http());

    job_runner.start().await;

    let listener = tokio::net::TcpListener::bind(&config.server.listen_addr).await?;
    info!("Listening on {}", config.server.listen_addr);

    // Serve with connection info so the rate limiter can key on the real peer IP.
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<std::net::SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown_signal())
    .await?;

    info!("Shutting down background jobs...");
    job_runner.shutdown().await;
    // The ad-hoc cleanup loops share the runner's cancel token (cancelled above);
    // join them too, bounded by a timeout.
    let _ = tokio::time::timeout(Duration::from_secs(5), async {
        let _ = conn_cleanup_handle.await;
        let _ = limiter_cleanup_handle.await;
    })
    .await;
    info!("Shutdown complete");
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
