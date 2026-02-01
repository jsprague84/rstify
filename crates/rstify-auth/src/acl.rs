/// Match a topic name against a wildcard pattern.
///
/// Patterns:
/// - `*` matches a single path segment (e.g., `alerts.*` matches `alerts.cpu` but not `alerts.cpu.high`)
/// - `**` matches any number of segments (e.g., `alerts.**` matches `alerts.cpu.high`)
/// - Exact match: `alerts.cpu` matches only `alerts.cpu`
pub fn topic_matches(pattern: &str, topic: &str) -> bool {
    let pattern_parts: Vec<&str> = pattern.split('.').collect();
    let topic_parts: Vec<&str> = topic.split('.').collect();

    match_parts(&pattern_parts, &topic_parts)
}

fn match_parts(pattern: &[&str], topic: &[&str]) -> bool {
    if pattern.is_empty() && topic.is_empty() {
        return true;
    }
    if pattern.is_empty() {
        return false;
    }

    match pattern[0] {
        "**" => {
            // ** matches zero or more segments
            if topic.is_empty() {
                // ** can match zero segments, but only if it's the last pattern part
                return pattern.len() == 1;
            }
            // Try matching zero segments (skip **) or one+ segments (advance topic)
            match_parts(&pattern[1..], topic) || match_parts(pattern, &topic[1..])
        }
        "*" => {
            if topic.is_empty() {
                return false;
            }
            // * matches exactly one segment
            match_parts(&pattern[1..], &topic[1..])
        }
        exact => {
            if topic.is_empty() {
                return false;
            }
            if exact == topic[0] {
                match_parts(&pattern[1..], &topic[1..])
            } else {
                false
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_exact_match() {
        assert!(topic_matches("alerts.cpu", "alerts.cpu"));
        assert!(!topic_matches("alerts.cpu", "alerts.mem"));
    }

    #[test]
    fn test_single_wildcard() {
        assert!(topic_matches("alerts.*", "alerts.cpu"));
        assert!(topic_matches("alerts.*", "alerts.mem"));
        assert!(!topic_matches("alerts.*", "alerts.cpu.high"));
        assert!(!topic_matches("alerts.*", "logs.cpu"));
    }

    #[test]
    fn test_double_wildcard() {
        assert!(topic_matches("alerts.**", "alerts.cpu"));
        assert!(topic_matches("alerts.**", "alerts.cpu.high"));
        assert!(topic_matches("alerts.**", "alerts.cpu.high.critical"));
        assert!(!topic_matches("alerts.**", "logs.cpu"));
    }

    #[test]
    fn test_complex_patterns() {
        assert!(topic_matches("*.cpu.**", "alerts.cpu.high"));
        assert!(topic_matches("*.cpu.**", "logs.cpu.usage.percent"));
        assert!(!topic_matches("*.cpu.**", "alerts.mem.high"));
    }

    #[test]
    fn test_full_wildcard() {
        assert!(topic_matches("**", "anything.at.all"));
        assert!(topic_matches("**", "single"));
    }
}
