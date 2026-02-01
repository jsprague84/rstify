use axum::extract::{Path, State};
use axum::response::sse::{Event, KeepAlive, Sse};
use futures::stream::Stream;
use rstify_auth::acl::topic_matches;
use rstify_core::repositories::TopicRepository;
use std::convert::Infallible;
use tokio_stream::wrappers::BroadcastStream;
use tokio_stream::StreamExt;

use crate::error::ApiError;
use crate::extractors::auth::AuthUser;
use crate::state::AppState;

pub async fn topic_sse(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(name): Path<String>,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, ApiError> {
    let topic = state
        .topic_repo
        .find_by_name(&name)
        .await
        .map_err(ApiError::from)?
        .ok_or_else(|| {
            ApiError::from(rstify_core::error::CoreError::NotFound(format!(
                "Topic '{}' not found",
                name
            )))
        })?;

    // Check read permission
    if !auth.user.is_admin && !topic.everyone_read && topic.owner_id != Some(auth.user.id) {
        let permissions = state
            .topic_repo
            .list_permissions_for_user(auth.user.id)
            .await
            .map_err(ApiError::from)?;

        let has_read = permissions
            .iter()
            .any(|p| p.can_read && topic_matches(&p.topic_pattern, &topic.name));

        if !has_read {
            return Err(ApiError::from(rstify_core::error::CoreError::Forbidden(
                "No read permission for this topic".to_string(),
            )));
        }
    }

    let rx = state.connections.subscribe_topic(&name).await;
    let stream = BroadcastStream::new(rx).filter_map(|result| match result {
        Ok(msg) => {
            let data = serde_json::to_string(msg.as_ref()).unwrap_or_default();
            Some(Ok(Event::default().data(data)))
        }
        Err(_) => None,
    });

    Ok(Sse::new(stream).keep_alive(KeepAlive::default()))
}
