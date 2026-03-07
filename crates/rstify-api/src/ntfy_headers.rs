use axum::http::HeaderMap;
use chrono::{DateTime, Duration, Utc};

/// Parsed metadata from ntfy-style HTTP headers
#[derive(Debug, Default)]
pub struct NtfyHeaders {
    pub title: Option<String>,
    pub priority: Option<i32>,
    pub tags: Option<Vec<String>>,
    pub click_url: Option<String>,
    pub icon_url: Option<String>,
    pub actions: Option<String>,
    pub filename: Option<String>,
    pub attach_url: Option<String>,
    pub scheduled_for: Option<String>,
    pub content_type: Option<String>,
    pub email: Option<String>,
    pub cache_duration: Option<String>,
}

impl NtfyHeaders {
    pub fn from_headers(headers: &HeaderMap) -> Self {
        let mut parsed = NtfyHeaders::default();

        if let Some(v) = get_header(headers, "x-title").or_else(|| get_header(headers, "title")) {
            parsed.title = Some(v);
        }

        if let Some(v) =
            get_header(headers, "x-priority").or_else(|| get_header(headers, "priority"))
        {
            parsed.priority = Some(parse_priority(&v));
        }

        if let Some(v) = get_header(headers, "x-tags").or_else(|| get_header(headers, "tags")) {
            parsed.tags = Some(
                v.split(',')
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect(),
            );
        }

        if let Some(v) = get_header(headers, "x-click").or_else(|| get_header(headers, "click")) {
            parsed.click_url = Some(v);
        }

        if let Some(v) = get_header(headers, "x-icon").or_else(|| get_header(headers, "icon")) {
            parsed.icon_url = Some(v);
        }

        if let Some(v) = get_header(headers, "x-actions").or_else(|| get_header(headers, "actions"))
        {
            // Parse ntfy action format and convert to rstify JSON actions
            parsed.actions = Some(parse_ntfy_actions(&v));
        }

        if let Some(v) =
            get_header(headers, "x-filename").or_else(|| get_header(headers, "filename"))
        {
            parsed.filename = Some(v);
        }

        if let Some(v) = get_header(headers, "x-attach").or_else(|| get_header(headers, "attach")) {
            parsed.attach_url = Some(v);
        }

        // Delay/At/In headers for scheduling
        if let Some(v) = get_header(headers, "x-delay")
            .or_else(|| get_header(headers, "delay"))
            .or_else(|| get_header(headers, "x-at"))
            .or_else(|| get_header(headers, "at"))
            .or_else(|| get_header(headers, "x-in"))
            .or_else(|| get_header(headers, "in"))
        {
            parsed.scheduled_for = parse_schedule(&v);
        }

        if let Some(v) =
            get_header(headers, "x-markdown").or_else(|| get_header(headers, "markdown"))
        {
            if v == "yes" || v == "true" || v == "1" {
                parsed.content_type = Some("text/markdown".to_string());
            }
        }

        if let Some(v) = get_header(headers, "x-email").or_else(|| get_header(headers, "email")) {
            parsed.email = Some(v);
        }

        if let Some(v) = get_header(headers, "x-cache").or_else(|| get_header(headers, "cache")) {
            parsed.cache_duration = Some(v);
        }

        parsed
    }
}

fn get_header(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

/// Map ntfy priority levels (1-5) to rstify priority levels (0-10).
/// ntfy: 1=min, 2=low, 3=default, 4=high, 5=max/urgent
/// rstify: 0-10 scale
fn parse_priority(s: &str) -> i32 {
    match s.to_lowercase().as_str() {
        "min" | "1" => 1,
        "low" | "2" => 3,
        "default" | "3" => 5,
        "high" | "4" => 7,
        "max" | "urgent" | "5" => 10,
        _ => s.parse().unwrap_or(5),
    }
}

/// Parse ntfy action strings into a JSON array of action objects.
/// ntfy format: "action_type, label, url[, param=value]*"
/// Multiple actions separated by ";"
/// Example: "view, Open portal, https://example.com; http, Turn off, https://api.example.com/off"
fn parse_ntfy_actions(s: &str) -> String {
    let actions: Vec<serde_json::Value> = s
        .split(';')
        .filter_map(|action_str| {
            let parts: Vec<&str> = action_str.splitn(3, ',').map(|p| p.trim()).collect();
            if parts.len() < 3 {
                return None;
            }
            let action_type = parts[0].to_lowercase();
            let label = parts[1];
            // Third part may have additional params after the URL
            let rest = parts[2];
            let url_and_params: Vec<&str> = rest.splitn(2, ',').collect();
            let url = url_and_params[0].trim();

            let mut obj = serde_json::json!({
                "action": action_type,
                "label": label,
                "url": url,
            });

            // Parse additional key=value params (e.g., body=..., method=..., headers=...)
            if url_and_params.len() > 1 {
                for param in url_and_params[1].split(',') {
                    let param = param.trim();
                    if let Some((key, value)) = param.split_once('=') {
                        obj[key.trim()] = serde_json::Value::String(value.trim().to_string());
                    }
                }
            }

            Some(obj)
        })
        .collect();

    serde_json::to_string(&actions).unwrap_or_else(|_| "[]".to_string())
}

fn parse_schedule(s: &str) -> Option<String> {
    // Try parsing as duration (e.g., "30m", "1h", "2h30m")
    if let Ok(duration) = humantime::parse_duration(s) {
        let scheduled = Utc::now() + Duration::from_std(duration).ok()?;
        return Some(scheduled.format("%Y-%m-%d %H:%M:%S").to_string());
    }

    // Try parsing as ISO 8601 / RFC 3339 datetime
    if let Ok(dt) = DateTime::parse_from_rfc3339(s) {
        return Some(
            dt.with_timezone(&Utc)
                .format("%Y-%m-%d %H:%M:%S")
                .to_string(),
        );
    }

    // Try parsing as a simple datetime string
    if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S") {
        return Some(dt.format("%Y-%m-%d %H:%M:%S").to_string());
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_priority_mapping() {
        assert_eq!(parse_priority("1"), 1);
        assert_eq!(parse_priority("min"), 1);
        assert_eq!(parse_priority("2"), 3);
        assert_eq!(parse_priority("low"), 3);
        assert_eq!(parse_priority("3"), 5);
        assert_eq!(parse_priority("default"), 5);
        assert_eq!(parse_priority("4"), 7);
        assert_eq!(parse_priority("high"), 7);
        assert_eq!(parse_priority("5"), 10);
        assert_eq!(parse_priority("urgent"), 10);
        assert_eq!(parse_priority("max"), 10);
    }

    #[test]
    fn test_parse_ntfy_actions() {
        let result = parse_ntfy_actions("view, Open portal, https://example.com");
        let actions: Vec<serde_json::Value> = serde_json::from_str(&result).unwrap();
        assert_eq!(actions.len(), 1);
        assert_eq!(actions[0]["action"], "view");
        assert_eq!(actions[0]["label"], "Open portal");
        assert_eq!(actions[0]["url"], "https://example.com");
    }

    #[test]
    fn test_parse_multiple_ntfy_actions() {
        let result =
            parse_ntfy_actions("view, Open, https://a.com; http, Turn off, https://b.com/off");
        let actions: Vec<serde_json::Value> = serde_json::from_str(&result).unwrap();
        assert_eq!(actions.len(), 2);
        assert_eq!(actions[0]["action"], "view");
        assert_eq!(actions[1]["action"], "http");
    }

    #[test]
    fn test_ntfy_headers_from_headermap() {
        let mut headers = HeaderMap::new();
        headers.insert("x-title", "Test Alert".parse().unwrap());
        headers.insert("x-priority", "high".parse().unwrap());
        headers.insert("x-tags", "warning,server".parse().unwrap());
        headers.insert("x-click", "https://example.com".parse().unwrap());

        let h = NtfyHeaders::from_headers(&headers);
        assert_eq!(h.title.as_deref(), Some("Test Alert"));
        assert_eq!(h.priority, Some(7));
        assert_eq!(
            h.tags,
            Some(vec!["warning".to_string(), "server".to_string()])
        );
        assert_eq!(h.click_url.as_deref(), Some("https://example.com"));
    }
}
