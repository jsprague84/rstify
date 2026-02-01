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

        if let Some(v) = get_header(headers, "x-priority").or_else(|| get_header(headers, "priority")) {
            parsed.priority = Some(parse_priority(&v));
        }

        if let Some(v) = get_header(headers, "x-tags").or_else(|| get_header(headers, "tags")) {
            parsed.tags = Some(v.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect());
        }

        if let Some(v) = get_header(headers, "x-click").or_else(|| get_header(headers, "click")) {
            parsed.click_url = Some(v);
        }

        if let Some(v) = get_header(headers, "x-icon").or_else(|| get_header(headers, "icon")) {
            parsed.icon_url = Some(v);
        }

        if let Some(v) = get_header(headers, "x-actions").or_else(|| get_header(headers, "actions")) {
            parsed.actions = Some(v);
        }

        if let Some(v) = get_header(headers, "x-filename").or_else(|| get_header(headers, "filename")) {
            parsed.filename = Some(v);
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

        if let Some(v) = get_header(headers, "x-markdown").or_else(|| get_header(headers, "markdown")) {
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

fn parse_priority(s: &str) -> i32 {
    match s.to_lowercase().as_str() {
        "min" | "1" => 1,
        "low" | "2" => 2,
        "default" | "3" => 3,
        "high" | "4" => 4,
        "max" | "urgent" | "5" => 5,
        _ => s.parse().unwrap_or(3),
    }
}

fn parse_schedule(s: &str) -> Option<String> {
    // Try parsing as duration (e.g., "30m", "1h", "2h30m")
    if let Ok(duration) = humantime::parse_duration(s) {
        let scheduled = Utc::now() + Duration::from_std(duration).ok()?;
        return Some(scheduled.format("%Y-%m-%d %H:%M:%S").to_string());
    }

    // Try parsing as ISO 8601 / RFC 3339 datetime
    if let Ok(dt) = DateTime::parse_from_rfc3339(s) {
        return Some(dt.with_timezone(&Utc).format("%Y-%m-%d %H:%M:%S").to_string());
    }

    // Try parsing as a simple datetime string
    if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S") {
        return Some(dt.format("%Y-%m-%d %H:%M:%S").to_string());
    }

    None
}
