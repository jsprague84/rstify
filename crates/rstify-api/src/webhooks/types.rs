use serde_json;

pub struct WebhookMessageOutput {
    pub title: String,
    pub message: String,
    pub priority: i32,
    pub click_url: Option<String>,
    pub tags: Vec<String>,
    pub content_type: Option<String>,
}

impl WebhookMessageOutput {
    pub fn extras_json(&self) -> Option<String> {
        if self.content_type.as_deref() == Some("text/markdown") {
            Some(r#"{"client::display":{"contentType":"text/markdown"}}"#.to_string())
        } else {
            None
        }
    }

    pub fn tags_json(&self) -> Option<String> {
        if self.tags.is_empty() {
            None
        } else {
            serde_json::to_string(&self.tags).ok()
        }
    }
}
