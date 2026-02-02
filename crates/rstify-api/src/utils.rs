use uuid::Uuid;

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
