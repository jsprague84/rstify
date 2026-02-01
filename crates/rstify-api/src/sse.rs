use axum::extract::{Path, State};
use axum::response::sse::{Event, KeepAlive, Sse};
use futures::stream::Stream;
use rstify_core::repositories::TopicRepository;
use std::convert::Infallible;
use tokio_stream::wrappers::BroadcastStream;
use tokio_stream::StreamExt;

use crate::error::ApiError;
use crate::state::AppState;

pub async fn topic_sse(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, ApiError> {
    let _topic = state
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
