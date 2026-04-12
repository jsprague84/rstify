use sqlx::SqlitePool;
use uuid::Uuid;

/// Create an application owned by `user_id`. Returns `(id, token)`.
pub async fn create_application(pool: &SqlitePool, user_id: i64, name: &str) -> (i64, String) {
    let token = format!("AP_{}", Uuid::new_v4().to_string().replace('-', ""));
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO applications (user_id, name, token, default_priority, created_at, updated_at) \
         VALUES (?, ?, ?, 5, datetime('now'), datetime('now')) RETURNING id",
    )
    .bind(user_id)
    .bind(name)
    .bind(&token)
    .fetch_one(pool)
    .await
    .expect("Failed to seed application");
    (id, token)
}

/// Create a client token owned by `user_id`. Returns `(id, token)`.
pub async fn create_client(pool: &SqlitePool, user_id: i64, name: &str) -> (i64, String) {
    let token = format!("CL_{}", Uuid::new_v4().to_string().replace('-', ""));
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO clients (user_id, name, token, created_at) \
         VALUES (?, ?, ?, datetime('now')) RETURNING id",
    )
    .bind(user_id)
    .bind(name)
    .bind(&token)
    .fetch_one(pool)
    .await
    .expect("Failed to seed client");
    (id, token)
}

/// Create a topic owned by `owner_id`. Returns the topic id.
pub async fn create_topic(pool: &SqlitePool, owner_id: i64, name: &str) -> i64 {
    sqlx::query_scalar(
        "INSERT INTO topics (name, owner_id, everyone_read, everyone_write, created_at) \
         VALUES (?, ?, TRUE, TRUE, datetime('now')) RETURNING id",
    )
    .bind(name)
    .bind(owner_id)
    .fetch_one(pool)
    .await
    .expect("Failed to seed topic")
}

/// Create a message in an application. Returns the message id.
pub async fn create_message(pool: &SqlitePool, app_id: i64, user_id: i64, text: &str) -> i64 {
    sqlx::query_scalar(
        "INSERT INTO messages (application_id, user_id, message, priority, created_at) \
         VALUES (?, ?, ?, 5, datetime('now')) RETURNING id",
    )
    .bind(app_id)
    .bind(user_id)
    .bind(text)
    .fetch_one(pool)
    .await
    .expect("Failed to seed message")
}

/// Create a webhook config owned by `user_id`. Returns `(id, token)`.
pub async fn create_webhook(pool: &SqlitePool, user_id: i64, name: &str) -> (i64, String) {
    let token = format!("WH_{}", Uuid::new_v4().to_string().replace('-', ""));
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO webhook_configs (user_id, name, token, webhook_type, template, enabled, created_at) \
         VALUES (?, ?, ?, 'generic', '{{message}}', TRUE, datetime('now')) RETURNING id",
    )
    .bind(user_id)
    .bind(name)
    .bind(&token)
    .fetch_one(pool)
    .await
    .expect("Failed to seed webhook config");
    (id, token)
}

/// Grant a topic permission to a user. Returns the permission id.
pub async fn grant_topic_permission(
    pool: &SqlitePool,
    user_id: i64,
    pattern: &str,
    read: bool,
    write: bool,
) -> i64 {
    sqlx::query_scalar(
        "INSERT INTO topic_permissions (user_id, topic_pattern, can_read, can_write) \
         VALUES (?, ?, ?, ?) RETURNING id",
    )
    .bind(user_id)
    .bind(pattern)
    .bind(read)
    .bind(write)
    .fetch_one(pool)
    .await
    .expect("Failed to seed topic permission")
}
