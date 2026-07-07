use axum::body::Body;
use axum::http::{Request, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::Mutex;

/// Simple per-IP token bucket rate limiter.
#[derive(Clone)]
pub struct RateLimiter {
    state: Arc<Mutex<HashMap<String, Bucket>>>,
    max_tokens: u32,
    refill_rate: f64, // tokens per second
    /// Whether to honor `X-Forwarded-For` (only safe behind a trusted proxy).
    trust_forwarded_for: bool,
}

struct Bucket {
    tokens: f64,
    last_refill: Instant,
}

impl RateLimiter {
    /// Create a new rate limiter.
    /// - `max_tokens`: burst capacity per IP
    /// - `refill_rate`: tokens restored per second
    pub fn new(max_tokens: u32, refill_rate: f64) -> Self {
        Self {
            state: Arc::new(Mutex::new(HashMap::new())),
            max_tokens,
            refill_rate,
            trust_forwarded_for: false,
        }
    }

    /// When true, key on the rightmost `X-Forwarded-For` value (set this only if
    /// a trusted reverse proxy fronts the server). When false — the safe default
    /// for a directly-exposed server — key strictly on the TCP peer IP, so a
    /// client cannot spoof its identity or bypass the limit by rotating headers.
    pub fn trust_forwarded_for(mut self, trust: bool) -> Self {
        self.trust_forwarded_for = trust;
        self
    }

    /// Derive the rate-limit bucket key for a request.
    fn request_key(&self, req: &Request<Body>) -> String {
        if self.trust_forwarded_for {
            if let Some(ip) = req
                .headers()
                .get("x-forwarded-for")
                .and_then(|v| v.to_str().ok())
                .and_then(|s| s.rsplit(',').next())
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
            {
                return ip;
            }
        }
        // The real TCP peer, present because the server is served with
        // `into_make_service_with_connect_info`. "unknown" should be unreachable.
        req.extensions()
            .get::<axum::extract::ConnectInfo<std::net::SocketAddr>>()
            .map(|ci| ci.0.ip().to_string())
            .unwrap_or_else(|| "unknown".to_string())
    }

    pub async fn check(&self, key: &str) -> bool {
        let mut state = self.state.lock().await;
        let now = Instant::now();

        let bucket = state.entry(key.to_string()).or_insert(Bucket {
            tokens: self.max_tokens as f64,
            last_refill: now,
        });

        // Refill tokens based on elapsed time
        let elapsed = now.duration_since(bucket.last_refill).as_secs_f64();
        bucket.tokens = (bucket.tokens + elapsed * self.refill_rate).min(self.max_tokens as f64);
        bucket.last_refill = now;

        if bucket.tokens >= 1.0 {
            bucket.tokens -= 1.0;
            true
        } else {
            false
        }
    }

    /// Returns true if at least one token is available, WITHOUT consuming it.
    /// Used to gate an action whose cost should only be charged on failure
    /// (e.g. login: penalize wrong passwords, not successful logins).
    pub async fn peek(&self, key: &str) -> bool {
        let mut state = self.state.lock().await;
        let now = Instant::now();
        let bucket = state.entry(key.to_string()).or_insert(Bucket {
            tokens: self.max_tokens as f64,
            last_refill: now,
        });
        let elapsed = now.duration_since(bucket.last_refill).as_secs_f64();
        bucket.tokens = (bucket.tokens + elapsed * self.refill_rate).min(self.max_tokens as f64);
        bucket.last_refill = now;
        bucket.tokens >= 1.0
    }

    /// Consume one token to record a failed/expensive attempt. Exhaustion is
    /// ignored — the gate is enforced separately via [`peek`](Self::peek).
    pub async fn penalize(&self, key: &str) {
        let _ = self.check(key).await;
    }

    /// Remove stale entries (inactive for >10 minutes) to prevent unbounded memory growth.
    pub async fn cleanup(&self) {
        let mut state = self.state.lock().await;
        let now = Instant::now();
        let stale_threshold = std::time::Duration::from_secs(600);
        state.retain(|_, bucket| now.duration_since(bucket.last_refill) < stale_threshold);
    }
}

/// Axum middleware function for rate limiting.
/// Uses the `RateLimiter` from request extensions (set via Extension layer).
pub async fn rate_limit_middleware(req: Request<Body>, next: Next) -> Response {
    // Extract rate limiter from extensions
    let limiter = match req.extensions().get::<RateLimiter>() {
        Some(l) => l.clone(),
        None => return next.run(req).await,
    };

    let key = limiter.request_key(&req);

    if !limiter.check(&key).await {
        return (
            StatusCode::TOO_MANY_REQUESTS,
            [(
                axum::http::header::RETRY_AFTER,
                axum::http::HeaderValue::from_static("1"),
            )],
            "Rate limit exceeded",
        )
            .into_response();
    }

    next.run(req).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn blocks_after_burst_is_exhausted() {
        // 2-token bucket, no refill: 3rd request is the one that 429s.
        let rl = RateLimiter::new(2, 0.0);
        assert!(rl.check("ip").await);
        assert!(rl.check("ip").await);
        assert!(!rl.check("ip").await);
    }

    #[tokio::test]
    async fn buckets_are_per_key() {
        let rl = RateLimiter::new(1, 0.0);
        assert!(rl.check("a").await);
        assert!(!rl.check("a").await); // a exhausted
        assert!(rl.check("b").await); // b unaffected
    }

    #[tokio::test]
    async fn refills_over_time() {
        // 1-token bucket refilling at 1000/s: after exhaustion, a few ms restores it.
        let rl = RateLimiter::new(1, 1000.0);
        assert!(rl.check("ip").await);
        assert!(!rl.check("ip").await);
        tokio::time::sleep(std::time::Duration::from_millis(10)).await;
        assert!(
            rl.check("ip").await,
            "bucket should refill after elapsed time"
        );
    }
}
