use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use rstify_core::error::CoreError;
use serde_json::json;

pub struct ApiError {
    pub status: StatusCode,
    pub message: String,
}

impl From<CoreError> for ApiError {
    fn from(err: CoreError) -> Self {
        match err {
            CoreError::NotFound(msg) => ApiError {
                status: StatusCode::NOT_FOUND,
                message: msg,
            },
            CoreError::AlreadyExists(msg) => ApiError {
                status: StatusCode::CONFLICT,
                message: msg,
            },
            CoreError::Unauthorized(msg) => ApiError {
                status: StatusCode::UNAUTHORIZED,
                message: msg,
            },
            CoreError::Forbidden(msg) => ApiError {
                status: StatusCode::FORBIDDEN,
                message: msg,
            },
            CoreError::Validation(msg) => ApiError {
                status: StatusCode::BAD_REQUEST,
                message: msg,
            },
            CoreError::Database(msg) => {
                tracing::error!("Database error: {}", msg);
                ApiError {
                    status: StatusCode::INTERNAL_SERVER_ERROR,
                    message: "Internal database error".to_string(),
                }
            }
            CoreError::Internal(msg) => ApiError {
                status: StatusCode::INTERNAL_SERVER_ERROR,
                message: msg,
            },
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let body = json!({
            "error": self.message,
            "errorCode": self.status.as_u16(),
        });
        (self.status, Json(body)).into_response()
    }
}
