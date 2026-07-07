//! SSRF protection for user-configured outbound URLs (outgoing webhooks, attachment fetches).
//!
//! The security model has three parts, applied at *delivery* time on the *fully
//! substituted* URL (config-time validation alone is bypassable via `{{env.KEY}}`
//! substitution and DNS rebinding):
//!
//! 1. [`validate_outbound_url`] parses the URL, rejects non-HTTP(S) schemes and
//!    leftover template markers in the host, resolves the host **off-thread**, and
//!    rejects it if *any* resolved address is private/reserved. DNS failure fails
//!    **closed**.
//! 2. The returned addresses are pinned onto the reqwest client via
//!    `resolve_to_addrs`, so the connection cannot be rebound to an internal IP
//!    between validation and connect (TOCTOU).
//! 3. [`safe_redirect_policy`] only follows same-host redirects, so a public host
//!    cannot 302 the client inward to a fresh, unvalidated address.

use std::net::{IpAddr, Ipv4Addr, SocketAddr, ToSocketAddrs};
use std::sync::OnceLock;
use url::Url;

/// Process-wide policy: may outbound URLs target private/reserved addresses?
/// Set once at startup from config (`WEBHOOK_ALLOW_PRIVATE_TARGETS`). Defaults to
/// `false` (block) — the secure default for a multi-user instance. A single-user
/// homelab that fires webhooks at LAN services (n8n, Home Assistant, …) sets it
/// to `true`.
static ALLOW_PRIVATE_TARGETS: OnceLock<bool> = OnceLock::new();

/// Configure whether outbound URLs may target private/reserved addresses. Call
/// once at startup; later calls are ignored (the first value wins).
pub fn set_allow_private_targets(allow: bool) {
    let _ = ALLOW_PRIVATE_TARGETS.set(allow);
}

fn allow_private_targets() -> bool {
    *ALLOW_PRIVATE_TARGETS.get().unwrap_or(&false)
}

/// A URL was rejected as an SSRF risk.
#[derive(Debug, Clone)]
pub struct SsrfError(pub String);

impl std::fmt::Display for SsrfError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl std::error::Error for SsrfError {}

/// The outcome of validating an outbound URL: the host and the set of resolved,
/// vetted socket addresses to pin the connection to.
#[derive(Debug, Clone)]
pub struct ValidatedTarget {
    pub host: String,
    pub addrs: Vec<SocketAddr>,
}

/// True if `ip` is private, loopback, link-local, or otherwise not a safe
/// public destination. Covers IPv4 **and** IPv6 (including IPv4-mapped,
/// link-local `fe80::/10`, and unique-local `fc00::/7`).
pub fn is_blocked_ip(ip: &IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => is_blocked_v4(v4),
        IpAddr::V6(v6) => {
            if v6.is_loopback() || v6.is_unspecified() || v6.is_multicast() {
                return true;
            }
            // ::ffff:a.b.c.d — the IPv4-mapped bypass (e.g. ::ffff:169.254.169.254).
            if let Some(v4) = v6.to_ipv4_mapped() {
                return is_blocked_v4(&v4);
            }
            // Deprecated IPv4-compatible ::a.b.c.d notation.
            if let Some(v4) = v6.to_ipv4() {
                return is_blocked_v4(&v4);
            }
            let seg = v6.segments();
            // Link-local fe80::/10.
            if (seg[0] & 0xffc0) == 0xfe80 {
                return true;
            }
            // Unique-local fc00::/7 (fc00::/8 + fd00::/8).
            if (seg[0] & 0xfe00) == 0xfc00 {
                return true;
            }
            false
        }
    }
}

fn is_blocked_v4(v4: &Ipv4Addr) -> bool {
    let o = v4.octets();
    v4.is_loopback()          // 127.0.0.0/8
        || v4.is_private()     // 10/8, 172.16/12, 192.168/16
        || v4.is_link_local()  // 169.254.0.0/16
        || v4.is_broadcast()   // 255.255.255.255
        || v4.is_unspecified() // 0.0.0.0
        || v4.is_multicast()   // 224.0.0.0/4
        || (o[0] == 100 && (64..=127).contains(&o[1])) // CGNAT 100.64.0.0/10
}

/// Validate a fully-substituted outbound URL. Returns the host and the vetted
/// resolved addresses to pin the connection to, or an [`SsrfError`] if the URL
/// is unsafe. DNS resolution runs on a blocking thread and fails **closed**.
pub async fn validate_outbound_url(raw_url: &str) -> Result<ValidatedTarget, SsrfError> {
    let url = Url::parse(raw_url).map_err(|e| SsrfError(format!("invalid URL: {e}")))?;

    let scheme = url.scheme();
    if scheme != "http" && scheme != "https" {
        return Err(SsrfError(format!(
            "unsupported scheme '{scheme}': only http and https are allowed"
        )));
    }

    let host = url
        .host_str()
        .ok_or_else(|| SsrfError("URL has no host".into()))?;

    // An unsubstituted `{{env.KEY}}` in the host means the host is attacker-chosen
    // at delivery time. Reject rather than resolve a bogus host.
    if host.contains('{') || host.contains('}') {
        return Err(SsrfError(
            "URL host contains unresolved template markers".into(),
        ));
    }

    let port = url.port_or_known_default().unwrap_or(80);
    let block_private = !allow_private_targets();

    // Host is a literal IP: validate directly, no DNS.
    if let Ok(ip) = host.parse::<IpAddr>() {
        if block_private && is_blocked_ip(&ip) {
            return Err(SsrfError(format!(
                "URL targets a private/reserved address: {ip}"
            )));
        }
        return Ok(ValidatedTarget {
            host: host.to_string(),
            addrs: vec![SocketAddr::new(ip, port)],
        });
    }

    // Resolve the hostname off the async runtime; fail closed on any error.
    let host_owned = host.to_string();
    let addrs: Vec<SocketAddr> = tokio::task::spawn_blocking(move || {
        (host_owned.as_str(), port)
            .to_socket_addrs()
            .map(|it| it.collect::<Vec<_>>())
    })
    .await
    .map_err(|e| SsrfError(format!("resolver task failed: {e}")))?
    .map_err(|e| SsrfError(format!("DNS resolution failed: {e}")))?;

    if addrs.is_empty() {
        return Err(SsrfError("host did not resolve to any address".into()));
    }
    for addr in &addrs {
        if block_private && is_blocked_ip(&addr.ip()) {
            return Err(SsrfError(format!(
                "host '{host}' resolves to a private/reserved address: {}",
                addr.ip()
            )));
        }
    }

    Ok(ValidatedTarget {
        host: host.to_string(),
        addrs,
    })
}

/// A reqwest redirect policy that only follows redirects to the **same host**
/// as the original (already-validated) request, capped at `max` hops. A
/// cross-host redirect (the SSRF vector: public host → internal IP) is stopped,
/// returning the redirect response as-is rather than following it inward.
pub fn safe_redirect_policy(
    follow: bool,
    original_host: String,
    max: usize,
) -> reqwest::redirect::Policy {
    if !follow {
        return reqwest::redirect::Policy::none();
    }
    reqwest::redirect::Policy::custom(move |attempt| {
        if attempt.previous().len() >= max {
            return attempt.error("too many redirects");
        }
        match attempt.url().host_str() {
            Some(h) if h.eq_ignore_ascii_case(&original_host) => {
                if matches!(attempt.url().scheme(), "http" | "https") {
                    attempt.follow()
                } else {
                    attempt.stop()
                }
            }
            // Cross-host (or host-less) redirect: do not follow it inward.
            _ => attempt.stop(),
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ip(s: &str) -> IpAddr {
        s.parse().unwrap()
    }

    #[test]
    fn blocks_ipv4_internal_ranges() {
        assert!(is_blocked_ip(&ip("127.0.0.1")));
        assert!(is_blocked_ip(&ip("10.0.0.5")));
        assert!(is_blocked_ip(&ip("192.168.1.1")));
        assert!(is_blocked_ip(&ip("172.16.0.1")));
        assert!(is_blocked_ip(&ip("169.254.169.254"))); // cloud metadata
        assert!(is_blocked_ip(&ip("100.100.0.1"))); // CGNAT
        assert!(is_blocked_ip(&ip("0.0.0.0")));
    }

    #[test]
    fn allows_public_ipv4() {
        assert!(!is_blocked_ip(&ip("1.1.1.1")));
        assert!(!is_blocked_ip(&ip("8.8.8.8")));
        assert!(!is_blocked_ip(&ip("93.184.216.34")));
    }

    #[test]
    fn blocks_ipv6_internal_and_mapped_bypasses() {
        assert!(is_blocked_ip(&ip("::1"))); // loopback
        assert!(is_blocked_ip(&ip("::"))); // unspecified
        assert!(is_blocked_ip(&ip("fe80::1"))); // link-local
        assert!(is_blocked_ip(&ip("fd00::1"))); // unique-local
        assert!(is_blocked_ip(&ip("fc00::1"))); // unique-local
                                                // The IPv4-mapped bypasses that the old validator let through:
        assert!(is_blocked_ip(&ip("::ffff:169.254.169.254")));
        assert!(is_blocked_ip(&ip("::ffff:127.0.0.1")));
        assert!(is_blocked_ip(&ip("::ffff:10.0.0.1")));
    }

    #[test]
    fn allows_public_ipv6() {
        assert!(!is_blocked_ip(&ip("2606:4700:4700::1111"))); // Cloudflare DNS
        assert!(!is_blocked_ip(&ip("2001:4860:4860::8888"))); // Google DNS
    }

    #[tokio::test]
    async fn rejects_non_http_scheme() {
        assert!(validate_outbound_url("file:///etc/passwd").await.is_err());
        assert!(validate_outbound_url("gopher://x").await.is_err());
    }

    #[tokio::test]
    async fn rejects_template_marker_in_host() {
        let err = validate_outbound_url("http://{{env.TARGET}}/path")
            .await
            .unwrap_err();
        assert!(err.0.contains("template"));
    }

    #[tokio::test]
    async fn rejects_ip_literal_metadata_and_mapped() {
        assert!(
            validate_outbound_url("http://169.254.169.254/latest/meta-data/")
                .await
                .is_err()
        );
        assert!(validate_outbound_url("http://[::ffff:169.254.169.254]/")
            .await
            .is_err());
        assert!(validate_outbound_url("http://[fd00::1]/").await.is_err());
    }

    #[tokio::test]
    async fn accepts_public_ip_literal() {
        let t = validate_outbound_url("https://1.1.1.1/hook").await.unwrap();
        assert_eq!(t.addrs.len(), 1);
        assert_eq!(t.addrs[0].port(), 443);
    }
}
