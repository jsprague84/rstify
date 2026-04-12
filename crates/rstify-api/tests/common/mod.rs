pub mod seed;

use axum::body::Body;
use axum::http::{self, Request};
use axum::response::Response;
use axum::Router;
use http_body_util::BodyExt;
use rstify_api::middleware::rate_limit::RateLimiter;
use rstify_api::state::AppState;
use rstify_auth::password::hash_password;
use rstify_auth::tokens::create_jwt;
use rstify_db::pool::Database;
use sqlx::SqlitePool;

/// Fully wired test application with in-memory DB, production router, and auth fixtures.
pub struct TestApp {
    pub router: Router,
    pub pool: SqlitePool,
    pub admin_token: String,
    pub user_token: String,
    pub jwt_secret: String,
}

/// Spin up a fresh in-memory database, apply all migrations, seed two users,
/// and return a ready-to-use `TestApp`.
pub async fn setup() -> TestApp {
    let jwt_secret = "test-jwt-secret-for-integration-tests".to_string();
    let upload_dir = "/tmp/rstify-test-uploads".to_string();
    let max_upload_size: usize = 10 * 1024 * 1024; // 10 MB

    // 1. Connect to in-memory SQLite and run all 29 migrations
    let db = Database::connect("sqlite::memory:")
        .await
        .expect("Failed to connect to in-memory SQLite");
    db.migrate()
        .await
        .expect("Failed to apply migrations to in-memory DB");

    let pool = db.pool().clone();

    // 2. Seed admin user (id=1)
    let admin_hash = hash_password("admin123".to_string())
        .await
        .expect("Failed to hash admin password");
    sqlx::query(
        "INSERT INTO users (username, password_hash, is_admin, created_at, updated_at) \
         VALUES (?, ?, ?, datetime('now'), datetime('now'))",
    )
    .bind("admin")
    .bind(&admin_hash)
    .bind(true)
    .execute(&pool)
    .await
    .expect("Failed to seed admin user");

    // 3. Seed regular user (id=2)
    let user_hash = hash_password("user123".to_string())
        .await
        .expect("Failed to hash user password");
    sqlx::query(
        "INSERT INTO users (username, password_hash, is_admin, created_at, updated_at) \
         VALUES (?, ?, ?, datetime('now'), datetime('now'))",
    )
    .bind("testuser")
    .bind(&user_hash)
    .bind(false)
    .execute(&pool)
    .await
    .expect("Failed to seed regular user");

    // 4. Generate JWT tokens
    let admin_token =
        create_jwt(1, "admin", true, &jwt_secret).expect("Failed to create admin JWT");
    let user_token =
        create_jwt(2, "testuser", false, &jwt_secret).expect("Failed to create user JWT");

    // 5. Build AppState and production router
    let state = AppState::new(
        pool.clone(),
        jwt_secret.clone(),
        upload_dir,
        max_upload_size,
    );

    // Use a generous rate limiter so tests never get throttled
    let limiter = RateLimiter::new(10_000, 10_000.0);
    let router = rstify_api::build_router(state, limiter);

    TestApp {
        router,
        pool,
        admin_token,
        user_token,
        jwt_secret,
    }
}

// ---------------------------------------------------------------------------
// Request builder helpers
// ---------------------------------------------------------------------------

/// Build a GET request with Bearer auth.
pub fn get(uri: &str, token: &str) -> Request<Body> {
    Request::builder()
        .method(http::Method::GET)
        .uri(uri)
        .header(http::header::AUTHORIZATION, format!("Bearer {}", token))
        .body(Body::empty())
        .expect("Failed to build GET request")
}

/// Build a POST request with JSON body and Bearer auth.
pub fn post_json(uri: &str, token: &str, body: serde_json::Value) -> Request<Body> {
    Request::builder()
        .method(http::Method::POST)
        .uri(uri)
        .header(http::header::AUTHORIZATION, format!("Bearer {}", token))
        .header(http::header::CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_vec(&body).unwrap()))
        .expect("Failed to build POST request")
}

/// Build a PUT request with JSON body and Bearer auth.
pub fn put_json(uri: &str, token: &str, body: serde_json::Value) -> Request<Body> {
    Request::builder()
        .method(http::Method::PUT)
        .uri(uri)
        .header(http::header::AUTHORIZATION, format!("Bearer {}", token))
        .header(http::header::CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_vec(&body).unwrap()))
        .expect("Failed to build PUT request")
}

/// Build a DELETE request with Bearer auth.
pub fn delete(uri: &str, token: &str) -> Request<Body> {
    Request::builder()
        .method(http::Method::DELETE)
        .uri(uri)
        .header(http::header::AUTHORIZATION, format!("Bearer {}", token))
        .body(Body::empty())
        .expect("Failed to build DELETE request")
}

/// Build a GET request without auth.
pub fn unauthed_get(uri: &str) -> Request<Body> {
    Request::builder()
        .method(http::Method::GET)
        .uri(uri)
        .body(Body::empty())
        .expect("Failed to build unauthenticated GET request")
}

/// Build a POST request with JSON body but no auth.
pub fn unauthed_post_json(uri: &str, body: serde_json::Value) -> Request<Body> {
    Request::builder()
        .method(http::Method::POST)
        .uri(uri)
        .header(http::header::CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_vec(&body).unwrap()))
        .expect("Failed to build unauthenticated POST request")
}

// ---------------------------------------------------------------------------
// Response body helpers
// ---------------------------------------------------------------------------

/// Read the response body as a `serde_json::Value`.
pub async fn body_json(resp: Response) -> serde_json::Value {
    let bytes = resp
        .into_body()
        .collect()
        .await
        .expect("Failed to collect response body")
        .to_bytes();
    serde_json::from_slice(&bytes).expect("Failed to parse response body as JSON")
}

/// Read the response body as a plain `String`.
pub async fn body_string(resp: Response) -> String {
    let bytes = resp
        .into_body()
        .collect()
        .await
        .expect("Failed to collect response body")
        .to_bytes();
    String::from_utf8(bytes.to_vec()).expect("Response body is not valid UTF-8")
}
