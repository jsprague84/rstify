use axum::extract::{Path, State};
use axum::Json;
use rstify_core::models::{CreateMqttBridge, MqttBridge, UpdateMqttBridge};
use rstify_core::repositories::MqttBridgeRepository;
use rstify_mqtt::bridge::BridgeStatusInfo;
use serde::Serialize;
use ts_rs::TS;
use utoipa::ToSchema;

use crate::error::ApiError;
use crate::extractors::auth::AuthUser;
use crate::state::AppState;

#[derive(Debug, Serialize, ToSchema, TS)]
#[ts(export)]
pub struct MqttStatusResponse {
    pub enabled: bool,
    pub listen_addr: Option<String>,
    pub ws_listen_addr: Option<String>,
    pub bridges_active: usize,
    pub bridges: Vec<BridgeStatusInfo>,
}

#[utoipa::path(
    get,
    path = "/api/mqtt/status",
    responses((status = 200, body = MqttStatusResponse))
)]
pub async fn mqtt_status(
    State(state): State<AppState>,
    _auth: AuthUser,
) -> Result<Json<MqttStatusResponse>, ApiError> {
    let (mqtt_enabled, listen_addr, ws_listen_addr) = match &state.mqtt_config {
        Some(cfg) => (
            true,
            Some(cfg.listen_addr.clone()),
            cfg.ws_listen_addr.clone(),
        ),
        None => (false, None, None),
    };

    let (bridges_active, bridges) = if let Some(ref bm) = state.bridge_manager {
        let manager = bm.lock().await;
        let statuses = manager.bridge_statuses();
        let active = statuses.iter().filter(|b| b.connected).count();
        (active, statuses)
    } else {
        (0, vec![])
    };

    Ok(Json(MqttStatusResponse {
        enabled: mqtt_enabled,
        listen_addr,
        ws_listen_addr,
        bridges_active,
        bridges,
    }))
}

#[utoipa::path(
    get,
    path = "/api/mqtt/bridges",
    responses((status = 200, body = Vec<MqttBridge>))
)]
pub async fn list_bridges(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<MqttBridge>>, ApiError> {
    let bridges = state
        .mqtt_bridge_repo
        .list_by_user(auth.user.id)
        .await
        .map_err(ApiError::from)?;
    Ok(Json(bridges))
}

#[utoipa::path(
    post,
    path = "/api/mqtt/bridges",
    request_body = CreateMqttBridge,
    responses((status = 201, body = MqttBridge))
)]
pub async fn create_bridge(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<CreateMqttBridge>,
) -> Result<Json<MqttBridge>, ApiError> {
    if !auth.user.is_admin {
        return Err(ApiError::from(rstify_core::error::CoreError::Forbidden(
            "Admin access required".to_string(),
        )));
    }

    let subscribe_json = serde_json::to_string(&req.subscribe_topics).unwrap_or_default();
    let publish_json = serde_json::to_string(&req.publish_topics).unwrap_or_default();

    let bridge = state
        .mqtt_bridge_repo
        .create(
            auth.user.id,
            &req.name,
            &req.remote_url,
            &subscribe_json,
            &publish_json,
            req.username.as_deref(),
            req.password.as_deref(),
            req.qos.unwrap_or(0),
            req.topic_prefix.as_deref(),
            req.auto_create_topics.unwrap_or(true),
        )
        .await
        .map_err(ApiError::from)?;

    // Start the bridge if enabled and BridgeManager is available
    if bridge.enabled {
        if let Some(ref bm) = state.bridge_manager {
            bm.lock().await.start_bridge(bridge.clone());
        }
    }

    Ok(Json(bridge))
}

#[utoipa::path(
    put,
    path = "/api/mqtt/bridges/{id}",
    request_body = UpdateMqttBridge,
    responses((status = 200, body = MqttBridge))
)]
pub async fn update_bridge(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<i64>,
    Json(req): Json<UpdateMqttBridge>,
) -> Result<Json<MqttBridge>, ApiError> {
    if !auth.user.is_admin {
        return Err(ApiError::from(rstify_core::error::CoreError::Forbidden(
            "Admin access required".to_string(),
        )));
    }

    let subscribe_json = req
        .subscribe_topics
        .as_ref()
        .map(|t| serde_json::to_string(t).unwrap_or_default());
    let publish_json = req
        .publish_topics
        .as_ref()
        .map(|t| serde_json::to_string(t).unwrap_or_default());

    let bridge = state
        .mqtt_bridge_repo
        .update(
            id,
            req.name.as_deref(),
            req.remote_url.as_deref(),
            subscribe_json.as_deref(),
            publish_json.as_deref(),
            req.username.as_deref(),
            req.password.as_deref(),
            req.qos,
            req.topic_prefix.as_deref(),
            req.auto_create_topics,
            req.enabled,
        )
        .await
        .map_err(ApiError::from)?;

    // Restart the bridge via BridgeManager if available
    if let Some(ref bm) = state.bridge_manager {
        let mut manager = bm.lock().await;
        manager.stop_bridge(id);
        if bridge.enabled {
            manager.start_bridge(bridge.clone());
        }
    }

    Ok(Json(bridge))
}

#[utoipa::path(
    delete,
    path = "/api/mqtt/bridges/{id}",
    responses((status = 200))
)]
pub async fn delete_bridge(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<i64>,
) -> Result<Json<serde_json::Value>, ApiError> {
    if !auth.user.is_admin {
        return Err(ApiError::from(rstify_core::error::CoreError::Forbidden(
            "Admin access required".to_string(),
        )));
    }

    // Stop the bridge via BridgeManager before deleting
    if let Some(ref bm) = state.bridge_manager {
        bm.lock().await.stop_bridge(id);
    }

    state
        .mqtt_bridge_repo
        .delete(id)
        .await
        .map_err(ApiError::from)?;
    Ok(Json(serde_json::json!({"success": true})))
}
