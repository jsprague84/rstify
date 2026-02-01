mod config;
mod telemetry;

use rstify_api::state::AppState;
use rstify_db::pool::Database;
use rstify_jobs::JobRunner;
use tracing::info;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    telemetry::init();

    let config = config::Config::from_env();
    info!("Starting rstify server on {}", config.listen_addr);

    let db = Database::connect(&config.database_url).await?;
    db.migrate().await?;

    let pool = db.pool().clone();
    let job_runner = JobRunner::new(pool.clone());

    let state = AppState::new(pool, config.jwt_secret.clone());
    let app = rstify_api::build_router(state);

    let app = app.layer(
        tower_http::cors::CorsLayer::permissive()
    ).layer(
        tower_http::trace::TraceLayer::new_for_http()
    );

    job_runner.start().await;

    let listener = tokio::net::TcpListener::bind(&config.listen_addr).await?;
    info!("Listening on {}", config.listen_addr);
    axum::serve(listener, app).await?;

    job_runner.shutdown();
    Ok(())
}
