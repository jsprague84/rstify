---
name: rust-backend-tasks
description: Rust/Axum backend conventions for rstify — extractor ordering, sqlx, JWT, config, UTC dates, migrations, OpenAPI. Use when editing crates/**/*.rs.
paths: crates/**/*.rs
---

# rstify Rust backend (Axum 0.8 · sqlx 0.8 · tokio 1)

## Axum 0.8 extractor rules

- **Body-consuming extractors must be the LAST handler argument** (`String`, `Bytes`, `Json<T>`,
  `Multipart`). Non-body extractors (`Method`, `HeaderMap`, `State`, `Path`, `Query`) come before.
  Wrong order is a compile error, not a runtime one.
- Only ONE body extractor per handler.
- Wrap an extractor in `Result<T, T::Rejection>` to handle bad input in-handler (e.g. `JsonRejection`
  is `#[non_exhaustive]` — match needs a catch-all).
- `impl IntoResponse` + `?` breaks type inference — return `Result<impl IntoResponse, impl IntoResponse>`.
- `State` for app-wide deps (`AppState`), `Extension` only for per-request middleware data.

## UTC dates (MANDATORY)

SQLite `datetime('now')` → `"2026-03-29 04:31:12"` (no zone). Any model with `to_response()` MUST append `Z`:

```rust
if !date.ends_with('Z') && !date.contains('+') { format!("{}Z", date) }
```

Models serializing dates directly must do the same. MQTT ingest uses
`chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ")` — NEVER `to_rfc3339()` (emits `+00:00`).
SQL datetime comparisons use `"%Y-%m-%d %H:%M:%S"`.

## Config — single env layer

`std::env::var` is allowed ONLY in `crates/rstify-server/src/config.rs`. Everything else reads config
from sub-structs threaded through `AppState` (`ServerConfig`, `DatabaseConfig`, `AuthConfig`,
`MqttConfig`, `FcmConfig`, `SmtpConfig`, `RateLimitConfig`, `CorsConfig`).

## sqlx 0.8 (SQLite)

- Pool tuned: 20 connections, WAL, `cache_size` 64MB, `mmap_size` 256MB.
- Migrations: add `migrations/NNN_name.sql`, then register it in `crates/rstify-db/src/pool.rs`'s
  migrations array (unregistered migrations silently don't run).
- Features in use: `runtime-tokio`, `sqlite`, `chrono`, `uuid`.

## API-facing DTOs

- Add `#[derive(TS)]` + `#[ts(export)]` → run `just generate-types` → commit `shared/generated/*.ts`.
  CI diff-checks; never hand-edit generated TS.
- Add `#[derive(ToSchema)]` and `#[utoipa::path]`, register the handler in `crates/rstify-api/src/openapi.rs`.

## Webhooks

Incoming `/api/wh/{token}` uses the `Bytes` extractor so HMAC is verified before JSON parsing. Markdown
parsers return `WebhookMessageOutput { content_type: Some("text/markdown"), .. }` and set
`extras_json` `{"client::display":{"contentType":"text/markdown"}}`. Anti-loop: ingest skips
`source: "webhook"`/`"api"`; publisher skips `source: "mqtt"`; internal topics use the `rstify/` prefix.

## Auth

JWT via `jsonwebtoken` 9; passwords hashed with Argon2. JWT secret min 32 bytes (validated in config).

## Gotify compatibility

100% Gotify-API compatible — preserve it. Extras namespaces `client::display` / `client::notification` /
`android::action`; action types `view` / `http` / `broadcast`.

## Done check

`cargo check --workspace` · `cargo test --workspace` (handler integration tests in `crates/rstify-api/tests/`
use in-memory SQLite + `TestApp` from `tests/common/mod.rs`) · `cargo fmt --all`.
