use super::types::WebhookMessageOutput;

pub fn parse_github_event(event_type: &str, body: &[u8]) -> Option<WebhookMessageOutput> {
    super::forgejo::parse_forgejo_event(event_type, body)
}
