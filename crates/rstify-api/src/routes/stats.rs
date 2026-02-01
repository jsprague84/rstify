use axum::extract::State;
use axum::Json;
use rstify_core::repositories::{MessageRepository, TopicRepository, UserRepository};
use serde::Serialize;
use utoipa::ToSchema;

use crate::error::ApiError;
use crate::extractors::auth::AuthUser;
use crate::state::AppState;

#[derive(Debug, Serialize, ToSchema)]
pub struct StatsResponse {
    pub users: i64,
    pub topics: i64,
    pub messages: i64,
    pub messages_last_24h: i64,
}

/// GET /api/stats - Admin dashboard statistics
#[utoipa::path(get, path = "/api/stats", responses((status = 200, body = StatsResponse)))]
pub async fn get_stats(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<StatsResponse>, ApiError> {
    if !auth.user.is_admin {
        return Err(ApiError::from(rstify_core::error::CoreError::Forbidden(
            "Admin access required".to_string(),
        )));
    }

    let users = state.user_repo.count().await.map_err(ApiError::from)?;
    let topics = state.topic_repo.count().await.map_err(ApiError::from)?;
    let messages = state.message_repo.count().await.map_err(ApiError::from)?;

    let since_24h = chrono::Utc::now()
        .checked_sub_signed(chrono::Duration::hours(24))
        .unwrap_or_else(chrono::Utc::now)
        .format("%Y-%m-%d %H:%M:%S")
        .to_string();
    let messages_last_24h = state
        .message_repo
        .count_since(&since_24h)
        .await
        .map_err(ApiError::from)?;

    Ok(Json(StatsResponse {
        users,
        topics,
        messages,
        messages_last_24h,
    }))
}
