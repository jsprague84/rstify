use std::net::{IpAddr, ToSocketAddrs};
use url::Url;
use uuid::Uuid;

/// Validate that a webhook target URL does not point to internal/private addresses (SSRF protection).
/// Returns Ok(()) if the URL is safe, or Err with a descriptive message if blocked.
pub fn validate_webhook_url(raw_url: &str) -> Result<(), String> {
    let url = Url::parse(raw_url).map_err(|e| format!("Invalid URL: {}", e))?;

    let scheme = url.scheme();
    if scheme != "http" && scheme != "https" {
        return Err(format!(
            "Unsupported scheme '{}': only http and https are allowed",
            scheme
        ));
    }

    let host = url.host_str().ok_or("URL has no host")?;

    // Try parsing as IP directly
    if let Ok(ip) = host.parse::<IpAddr>() {
        if is_private_ip(&ip) {
            return Err(format!("URL targets a private/reserved address: {}", ip));
        }
    } else {
        // Resolve hostname and check all resolved IPs
        let port = url.port_or_known_default().unwrap_or(80);
        let addr = format!("{}:{}", host, port);
        if let Ok(addrs) = addr.to_socket_addrs() {
            for socket_addr in addrs {
                if is_private_ip(&socket_addr.ip()) {
                    return Err(format!(
                        "URL hostname '{}' resolves to private/reserved address: {}",
                        host,
                        socket_addr.ip()
                    ));
                }
            }
        }
        // If DNS resolution fails, allow it — the outgoing webhook will fail at delivery time
    }

    Ok(())
}

fn is_private_ip(ip: &IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => {
            v4.is_loopback()                         // 127.0.0.0/8
                || v4.is_private()                    // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
                || v4.is_link_local()                 // 169.254.0.0/16
                || v4.is_broadcast()                  // 255.255.255.255
                || v4.is_unspecified()                // 0.0.0.0
                || (v4.octets()[0] == 100 && v4.octets()[1] >= 64 && v4.octets()[1] <= 127)
            // CGN 100.64.0.0/10
        }
        IpAddr::V6(v6) => {
            v6.is_loopback()          // ::1
                || v6.is_unspecified() // ::
        }
    }
}

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
