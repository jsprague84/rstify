use uuid::Uuid;

// SSRF validation for outbound URLs lives in `rstify_jobs::ssrf` so that it can
// run at *delivery* time (on the fully substituted URL) as well as at config
// time. See that module for the IPv6-complete, DNS-fail-closed validator.

/// Sanitize a filename by stripping path components and falling back to a UUID if empty.
pub fn sanitize_filename(raw: &str) -> String {
    // Strip any directory components (防 path traversal)
    let name = raw.rsplit(['/', '\\']).next().unwrap_or("attachment");

    // Remove any remaining problematic characters
    let sanitized: String = name
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '.' || *c == '-' || *c == '_')
        .collect();

    if sanitized.is_empty() || sanitized == "." || sanitized == ".." {
        format!("{}.bin", Uuid::new_v4())
    } else {
        sanitized
    }
}
