//! Shared delivery for freshly-created, immediate messages.
//!
//! Every publish path (application message, topic publish, incoming webhook)
//! needs the same fan-out — broadcast to subscribers, fire push, and (for topics)
//! fire outgoing webhooks. Historically each path re-implemented this and they
//! drifted apart; this helper is the single source of truth so a new publish
//! path can't silently forget to push or chain.
//!
//! Do NOT call this for scheduled messages — their delivery happens later, from
//! the scheduled-delivery job.

use crate::state::AppState;
use rstify_core::models::{MessageResponse, Topic};

/// Where an immediate message should be delivered.
pub enum DeliveryTarget<'a> {
    /// Gotify-style application message → the owning user's stream + push.
    User(i64),
    /// Topic message → topic subscribers, outgoing webhooks, and the topic
    /// owner's push (gated by the topic's inbox + notify policy).
    Topic(&'a Topic),
}

/// Broadcast an immediate message and fire push notifications and (for topics)
/// outgoing webhooks. Fan-out work runs on spawned tasks so the caller returns
/// promptly.
pub async fn deliver_message(
    state: &AppState,
    response: &MessageResponse,
    target: DeliveryTarget<'_>,
) {
    match target {
        DeliveryTarget::User(user_id) => {
            state
                .connections
                .broadcast_to_user(user_id, response.clone())
                .await;
            spawn_fcm(state, user_id, response);
        }
        DeliveryTarget::Topic(topic) => {
            state
                .connections
                .broadcast_to_topic(&topic.name, response.clone())
                .await;
            spawn_outgoing_webhooks(state, &topic.name, response);
            // Push to the owner only if the message is inbox-routed and the
            // topic's notify policy allows it.
            if response.inbox && rstify_core::policy::should_notify(topic, response) {
                if let Some(owner_id) = topic.owner_id {
                    spawn_fcm(state, owner_id, response);
                }
            }
        }
    }
}

/// Fire push notifications to a user's registered devices (no-op if FCM is off).
fn spawn_fcm(state: &AppState, user_id: i64, response: &MessageResponse) {
    if let Some(ref fcm) = state.fcm {
        let fcm = fcm.clone();
        let client_repo = state.client_repo.clone();
        let resp = response.clone();
        tokio::spawn(async move {
            fcm.notify_user(&client_repo, user_id, &resp, resp.icon_url.as_deref())
                .await;
        });
    }
}

/// Fire any outgoing webhooks bound to the topic.
fn spawn_outgoing_webhooks(state: &AppState, topic_name: &str, response: &MessageResponse) {
    let pool = state.pool.clone();
    let topic_name = topic_name.to_string();
    let resp = response.clone();
    tokio::spawn(async move {
        rstify_jobs::outgoing_webhooks::fire_outgoing_webhooks(&pool, &topic_name, &resp).await;
    });
}
