use axum::extract::{Path, State};
use axum::Json;
use rstify_auth::tokens::generate_client_token;
use rstify_core::models::{Client, CreateClient, UpdateClient};
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
    let client = state
        .client_repo
        .create(auth.user.id, &req.name, &token)
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

    let client = state
        .client_repo
        .update(id, req.name.as_deref())
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

    state
        .client_repo
        .delete(id)
        .await
        .map_err(ApiError::from)?;
    Ok(Json(serde_json::json!({"success": true})))
}
