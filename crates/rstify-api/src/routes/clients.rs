use axum::extract::{Path, State};
use axum::Json;
use rstify_auth::tokens::generate_client_token;
use rstify_core::models::{Client, CreateClient, RegisterFcmToken, UpdateClient};
use rstify_core::repositories::ClientRepository;

use crate::error::ApiError;
use crate::extractors::auth::AuthUser;
use crate::state::AppState;

#[utoipa::path(get, path = "/client", responses((status = 200, body = Vec<Client>)))]
pub async fn list_clients(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<Client>>, ApiError> {
    let clients = state
        .client_repo
        .list_by_user(auth.user.id)
        .await
        .map_err(ApiError::from)?;
    Ok(Json(clients))
}

#[utoipa::path(
    post,
    path = "/client",
    request_body = CreateClient,
    responses((status = 201, body = Client))
)]
pub async fn create_client(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<CreateClient>,
) -> Result<Json<Client>, ApiError> {
    let token = generate_client_token();
    let scopes = req
        .scopes
        .unwrap_or_else(|| vec!["read".into(), "write".into()]);
    let scopes_json = serde_json::to_string(&scopes).unwrap();
    let client = state
        .client_repo
        .create(auth.user.id, &req.name, &token, &scopes_json)
        .await
        .map_err(ApiError::from)?;
    Ok(Json(client))
}

#[utoipa::path(
    put,
    path = "/client/{id}",
    request_body = UpdateClient,
    responses((status = 200, body = Client))
)]
pub async fn update_client(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<i64>,
    Json(req): Json<UpdateClient>,
) -> Result<Json<Client>, ApiError> {
    let existing = state
        .client_repo
        .find_by_id(id)
        .await
        .map_err(ApiError::from)?
        .ok_or_else(|| {
            ApiError::from(rstify_core::error::CoreError::NotFound(
                "Client not found".to_string(),
            ))
        })?;

    if existing.user_id != auth.user.id && !auth.user.is_admin {
        return Err(ApiError::from(rstify_core::error::CoreError::Forbidden(
            "Not your client".to_string(),
        )));
    }

    let scopes_json = req.scopes.map(|s| serde_json::to_string(&s).unwrap());
    let client = state
        .client_repo
        .update(id, req.name.as_deref(), scopes_json.as_deref())
        .await
        .map_err(ApiError::from)?;
    Ok(Json(client))
}

#[utoipa::path(delete, path = "/client/{id}", responses((status = 200)))]
pub async fn delete_client(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<i64>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let existing = state
        .client_repo
        .find_by_id(id)
        .await
        .map_err(ApiError::from)?
        .ok_or_else(|| {
            ApiError::from(rstify_core::error::CoreError::NotFound(
                "Client not found".to_string(),
            ))
        })?;

    if existing.user_id != auth.user.id && !auth.user.is_admin {
        return Err(ApiError::from(rstify_core::error::CoreError::Forbidden(
            "Not your client".to_string(),
        )));
    }

    state.client_repo.delete(id).await.map_err(ApiError::from)?;
    Ok(Json(serde_json::json!({"success": true})))
}

/// PUT /client/{id}/fcm-token - Register FCM push token for a client
#[utoipa::path(
    put,
    path = "/client/{id}/fcm-token",
    request_body = RegisterFcmToken,
    responses((status = 200, body = Client))
)]
pub async fn register_fcm_token(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<i64>,
    Json(req): Json<RegisterFcmToken>,
) -> Result<Json<Client>, ApiError> {
    let existing = state
        .client_repo
        .find_by_id(id)
        .await
        .map_err(ApiError::from)?
        .ok_or_else(|| {
            ApiError::from(rstify_core::error::CoreError::NotFound(
                "Client not found".to_string(),
            ))
        })?;

    if existing.user_id != auth.user.id && !auth.user.is_admin {
        return Err(ApiError::from(rstify_core::error::CoreError::Forbidden(
            "Not your client".to_string(),
        )));
    }

    let client = state
        .client_repo
        .update_fcm_token(id, Some(&req.fcm_token))
        .await
        .map_err(ApiError::from)?;
    Ok(Json(client))
}

/// DELETE /client/{id}/fcm-token - Remove FCM push token from a client
#[utoipa::path(delete, path = "/client/{id}/fcm-token", responses((status = 200, body = Client)))]
pub async fn remove_fcm_token(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<i64>,
) -> Result<Json<Client>, ApiError> {
    let existing = state
        .client_repo
        .find_by_id(id)
        .await
        .map_err(ApiError::from)?
        .ok_or_else(|| {
            ApiError::from(rstify_core::error::CoreError::NotFound(
                "Client not found".to_string(),
            ))
        })?;

    if existing.user_id != auth.user.id && !auth.user.is_admin {
        return Err(ApiError::from(rstify_core::error::CoreError::Forbidden(
            "Not your client".to_string(),
        )));
    }

    let client = state
        .client_repo
        .update_fcm_token(id, None)
        .await
        .map_err(ApiError::from)?;
    Ok(Json(client))
}
