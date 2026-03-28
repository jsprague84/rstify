use super::types::WebhookMessageOutput;

pub fn parse_forgejo_event(_event_type: &str, _body: &[u8]) -> WebhookMessageOutput {
    WebhookMessageOutput {
        title: "Forgejo event".to_string(),
        message: "Placeholder".to_string(),
        priority: 5,
        click_url: None,
        tags: vec![],
        content_type: None,
    }
}
