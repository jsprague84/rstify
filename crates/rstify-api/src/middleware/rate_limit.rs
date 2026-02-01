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
        }
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

    /// Remove fully-refilled entries to prevent unbounded memory growth.
    pub async fn cleanup(&self) {
        let mut state = self.state.lock().await;
        let now = Instant::now();
        let max = self.max_tokens as f64;
        let rate = self.refill_rate;
        state.retain(|_, bucket| {
            let elapsed = now.duration_since(bucket.last_refill).as_secs_f64();
            (bucket.tokens + elapsed * rate) < max
        });
    }
}

/// Axum middleware function for rate limiting by peer IP.
/// Install via `axum::middleware::from_fn_with_state`.
pub async fn rate_limit_middleware(
    axum::extract::State(limiter): axum::extract::State<RateLimiter>,
    req: Request<Body>,
    next: Next,
) -> Response {
    // Use the peer IP from the connection info, falling back to a fixed key
    let key = req
        .extensions()
        .get::<axum::extract::ConnectInfo<std::net::SocketAddr>>()
        .map(|ci| ci.0.ip().to_string())
        .unwrap_or_else(|| "unknown".to_string());

    if !limiter.check(&key).await {
        return (StatusCode::TOO_MANY_REQUESTS, "Rate limit exceeded").into_response();
    }

    next.run(req).await
}
