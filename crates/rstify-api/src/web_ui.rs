use axum::http::{header, StatusCode, Uri};
use axum::response::{Html, IntoResponse, Response};
use rust_embed::Embed;

#[derive(Embed)]
#[folder = "../../web-ui/dist"]
struct WebUiAssets;

pub async fn web_ui_handler(uri: Uri) -> Response {
    let path = uri.path().trim_start_matches('/');

    // Try to serve the exact file
    if let Some(content) = WebUiAssets::get(path) {
        let mime = mime_guess::from_path(path).first_or_octet_stream();
        (
            StatusCode::OK,
            [(header::CONTENT_TYPE, mime.as_ref())],
            content.data,
        )
            .into_response()
    } else {
        // SPA fallback: serve index.html for any non-file route
        match WebUiAssets::get("index.html") {
            Some(content) => {
                Html(std::str::from_utf8(&content.data).unwrap_or("").to_string()).into_response()
            }
            None => (StatusCode::NOT_FOUND, "Web UI not found").into_response(),
        }
    }
}
