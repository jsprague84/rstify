use axum::extract::{Query, State};
use axum::Json;
use rstify_core::models::MessageResponse;
use rstify_core::repositories::MessageRepository;
use serde::Deserialize;

use crate::error::ApiError;
use crate::extractors::auth::AuthUser;
use crate::state::AppState;

use super::crud::enrich_with_attachments;

#[derive(Deserialize)]
pub struct SearchParams {
    pub q: Option<String>,
    pub tag: Option<String>,
    pub priority_min: Option<i32>,
    pub priority_max: Option<i32>,
    pub since: Option<String>,
    pub until: Option<String>,
    pub appid: Option<i64>,
    pub limit: Option<i64>,
}

/// GET /message/search - Search/filter messages
#[utoipa::path(
    get,
    path = "/message/search",
    responses((status = 200, body = Vec<MessageResponse>))
)]
pub async fn search_messages(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(params): Query<SearchParams>,
) -> Result<Json<Vec<MessageResponse>>, ApiError> {
    auth.require_scope("read")?;
    let limit = params.limit.unwrap_or(100).clamp(1, 500);
    let messages = state
        .message_repo
        .search(
            auth.user.id,
            params.q.as_deref(),
            params.tag.as_deref(),
            params.priority_min,
            params.priority_max,
            params.since.as_deref(),
            params.until.as_deref(),
            params.appid,
            limit,
        )
        .await
        .map_err(ApiError::from)?;

    let responses = enrich_with_attachments(&state, &messages, None).await?;
    Ok(Json(responses))
}
