# Phase 4: Testing & Hardening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build durable confidence in the refactored codebase through handler-level integration tests for all critical API routes, using in-memory SQLite and the production migration chain.

**Architecture:** Create a shared test harness (`tests/common/`) in rstify-api that provides an in-memory database, seeded test data, and authenticated request builders. Each route family gets its own integration test file covering happy path, auth failure, forbidden, validation failure, and not-found cases. Tests use `tower::ServiceExt::oneshot()` to hit handlers directly without a running server.

**Tech Stack:** Rust, axum test utilities, tower::ServiceExt, sqlx (in-memory SQLite), tokio::test

### What's already covered

Phase 1 delivered strong unit test coverage for backend abstractions:
- Config parsing: 19 tests (config.rs)
- Ownership helpers: 10 tests (ownership.rs)
- Validation helpers: 22 tests (validation.rs)
- JSON helpers: 2 tests (json.rs)
- Auth tokens: 2 tests (tokens.rs)
- Password hashing: 1 test (password.rs)
- MQTT integration: 8 tests

**Total existing: ~64 tests.** Phase 4 fills the remaining gaps: error conversion unit tests + handler-level integration tests.

---

## File Structure

### New files to create

```
crates/rstify-api/tests/
├── common/
│   ├── mod.rs              # TestApp setup: in-memory DB, AppState, router, tokens
│   └── seed.rs             # Seed helpers: create users, apps, topics, clients
├── auth_test.rs            # Login, token validation
├── applications_test.rs    # Application CRUD + ownership
├── clients_test.rs         # Client CRUD + ownership
├── topics_test.rs          # Topic CRUD + permissions + publish
├── messages_test.rs        # Message create + search + pagination
├── webhooks_test.rs        # Webhook config CRUD + incoming verification
└── error_conversion_test.rs # CoreError → ApiError mapping
```

---

## Task 1: CoreError → ApiError conversion unit tests

**Files:**
- Create: `crates/rstify-api/tests/error_conversion_test.rs`

These are pure unit tests — no database or HTTP involved.

- [ ] **Step 1: Create the test file**

Read `crates/rstify-api/src/error.rs` first to see the exact `From<CoreError>` implementation and `IntoResponse` impl. Then write tests covering each variant mapping.

The tests should verify:
- `CoreError::NotFound("x")` → ApiError with StatusCode 404
- `CoreError::AlreadyExists("x")` → StatusCode 409
- `CoreError::Unauthorized("x")` → StatusCode 401
- `CoreError::Forbidden("x")` → StatusCode 403
- `CoreError::Validation("x")` → StatusCode 400
- `CoreError::Database("x")` → StatusCode 500
- `CoreError::Internal("x")` → StatusCode 500
- The IntoResponse impl produces JSON `{"error": "message", "errorCode": 404}` format

Each test creates a CoreError, converts to ApiError, and asserts status + message.

```rust
// crates/rstify-api/tests/error_conversion_test.rs
use axum::http::StatusCode;
use rstify_api::error::ApiError;
use rstify_core::error::CoreError;

#[test]
fn not_found_maps_to_404() {
    let err: ApiError = CoreError::NotFound("thing not found".into()).into();
    assert_eq!(err.status, StatusCode::NOT_FOUND);
    assert_eq!(err.message, "thing not found");
}

// ... one test per variant
```

For the IntoResponse test, construct an ApiError and call `.into_response()`, then read the body and parse JSON.

- [ ] **Step 2: Run tests**

```bash
cargo test -p rstify-api --test error_conversion_test -- --nocapture
```

Expected: All pass.

- [ ] **Step 3: Commit**

```bash
git add crates/rstify-api/tests/error_conversion_test.rs
git commit -m "test(api): add CoreError → ApiError conversion tests"
```

---

## Task 2: Integration test harness

**Files:**
- Create: `crates/rstify-api/tests/common/mod.rs`
- Create: `crates/rstify-api/tests/common/seed.rs`

This is the foundation for all handler tests. It provides:
1. An in-memory SQLite database with all 29 migrations applied
2. A fully configured AppState
3. The production Axum router
4. Pre-created admin and regular user accounts with JWT tokens
5. Helper functions for making authenticated HTTP requests
6. Seed functions for creating test data

- [ ] **Step 1: Read infrastructure files**

Read these to understand the exact APIs:
- `crates/rstify-api/src/state.rs` — AppState constructor and builder methods
- `crates/rstify-api/src/routes/mod.rs` — how the router is assembled (find the function that creates the full Router)
- `crates/rstify-api/src/lib.rs` — what's publicly exported
- `crates/rstify-db/src/pool.rs` — Database::connect() and Database::migrate()
- `crates/rstify-auth/src/tokens.rs` — create_jwt signature
- `crates/rstify-auth/src/password.rs` — hash_password signature

- [ ] **Step 2: Create common/mod.rs**

The test harness module. Key components:

```rust
// crates/rstify-api/tests/common/mod.rs
pub mod seed;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use axum::Router;
use http_body_util::BodyExt;
use rstify_api::state::AppState;
use sqlx::SqlitePool;

pub struct TestApp {
    pub router: Router,
    pub pool: SqlitePool,
    pub admin_token: String,  // JWT for user_id=1, is_admin=true
    pub user_token: String,   // JWT for user_id=2, is_admin=false
}

/// Create a fresh test app with in-memory DB, migrations applied, and two seeded users.
pub async fn setup() -> TestApp {
    // 1. Create in-memory SQLite database
    // 2. Run all migrations (same as production)
    // 3. Create AppState with test config
    // 4. Seed admin user (id=1) and regular user (id=2)
    // 5. Generate JWT tokens for both
    // 6. Create the full router
    // Return TestApp
}

/// Make a GET request with auth token.
pub fn get(uri: &str, token: &str) -> Request<Body> { ... }

/// Make a POST request with auth token and JSON body.
pub fn post_json(uri: &str, token: &str, body: &str) -> Request<Body> { ... }

/// Make a PUT request with auth token and JSON body.
pub fn put_json(uri: &str, token: &str, body: &str) -> Request<Body> { ... }

/// Make a DELETE request with auth token.
pub fn delete(uri: &str, token: &str) -> Request<Body> { ... }

/// Make an unauthenticated request.
pub fn unauthed_get(uri: &str) -> Request<Body> { ... }
pub fn unauthed_post_json(uri: &str, body: &str) -> Request<Body> { ... }

/// Extract response body as parsed JSON.
pub async fn body_json(response: axum::response::Response) -> serde_json::Value { ... }

/// Extract response body as string.
pub async fn body_string(response: axum::response::Response) -> String { ... }
```

IMPORTANT: The exact router creation depends on how `rstify-api` exposes its router. Read `routes/mod.rs` and `lib.rs` to find the correct function. It might be `create_router(state)` or the routes might need to be composed manually. If there's no public `create_router` function, you may need to add one or compose the router from the exported route groups.

- [ ] **Step 3: Create common/seed.rs**

Seed helpers that create test data via direct SQL (not through handlers — these are test fixtures):

```rust
// crates/rstify-api/tests/common/seed.rs
use sqlx::SqlitePool;

/// Create an application owned by user_id, return its id and token.
pub async fn create_application(pool: &SqlitePool, user_id: i64, name: &str) -> (i64, String) { ... }

/// Create a client token owned by user_id, return its id and token.
pub async fn create_client(pool: &SqlitePool, user_id: i64, name: &str) -> (i64, String) { ... }

/// Create a topic, return its id.
pub async fn create_topic(pool: &SqlitePool, owner_id: i64, name: &str) -> i64 { ... }

/// Create a message in an application, return its id.
pub async fn create_message(pool: &SqlitePool, app_id: i64, user_id: i64, text: &str) -> i64 { ... }

/// Create a webhook config owned by user_id, return its id and token.
pub async fn create_webhook(pool: &SqlitePool, user_id: i64, name: &str) -> (i64, String) { ... }

/// Grant a topic permission to user_id.
pub async fn grant_topic_permission(pool: &SqlitePool, user_id: i64, pattern: &str, read: bool, write: bool) -> i64 { ... }
```

Each function uses `sqlx::query` to insert data directly. Generate tokens using the same format as production (`AP_`, `CL_`, `WH_` prefixes + UUID).

- [ ] **Step 4: Write a smoke test to verify the harness works**

Create a temporary test file or add to one of the test files:

```rust
#[tokio::test]
async fn test_harness_smoke() {
    let app = common::setup().await;
    let resp = app.router.clone()
        .oneshot(common::get("/health", &app.admin_token))
        .await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
}
```

- [ ] **Step 5: Run all tests**

```bash
cargo test -p rstify-api -- --nocapture
```

Expected: Existing tests still pass + smoke test passes.

- [ ] **Step 6: Commit**

```bash
git add crates/rstify-api/tests/
git commit -m "test(api): add integration test harness with in-memory DB and auth fixtures"
```

---

## Task 3: Auth handler tests

**Files:**
- Create: `crates/rstify-api/tests/auth_test.rs`

Test the login endpoint and token-based auth behavior.

- [ ] **Step 1: Write auth tests**

```rust
mod common;

use axum::http::StatusCode;
use tower::ServiceExt;

#[tokio::test]
async fn login_with_valid_credentials() {
    let app = common::setup().await;
    let resp = app.router.clone()
        .oneshot(common::unauthed_post_json(
            "/api/auth/login",
            r#"{"username":"admin","password":"admin123"}"#
        )).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let body = common::body_json(resp).await;
    assert!(body["token"].is_string());
}

#[tokio::test]
async fn login_with_wrong_password() {
    let app = common::setup().await;
    let resp = app.router.clone()
        .oneshot(common::unauthed_post_json(
            "/api/auth/login",
            r#"{"username":"admin","password":"wrong"}"#
        )).await.unwrap();
    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn login_with_unknown_user() {
    let app = common::setup().await;
    let resp = app.router.clone()
        .oneshot(common::unauthed_post_json(
            "/api/auth/login",
            r#"{"username":"nobody","password":"pass"}"#
        )).await.unwrap();
    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn authenticated_endpoint_without_token() {
    let app = common::setup().await;
    let resp = app.router.clone()
        .oneshot(common::unauthed_get("/application"))
        .await.unwrap();
    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn authenticated_endpoint_with_valid_token() {
    let app = common::setup().await;
    let resp = app.router.clone()
        .oneshot(common::get("/application", &app.user_token))
        .await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
}

#[tokio::test]
async fn authenticated_endpoint_with_invalid_token() {
    let app = common::setup().await;
    let resp = app.router.clone()
        .oneshot(common::get("/application", "invalid-jwt-token"))
        .await.unwrap();
    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}
```

IMPORTANT: Read the actual route paths from `crates/rstify-api/src/routes/mod.rs` and `auth.rs`. The login endpoint might be `/api/auth/login` or just `/auth/login`. The application list might be `/application` (Gotify compat) or `/api/applications`. Verify exact paths.

- [ ] **Step 2: Run tests**

```bash
cargo test -p rstify-api --test auth_test -- --nocapture
```

- [ ] **Step 3: Commit**

```bash
git add crates/rstify-api/tests/auth_test.rs
git commit -m "test(api): add auth handler integration tests"
```

---

## Task 4: Application CRUD handler tests

**Files:**
- Create: `crates/rstify-api/tests/applications_test.rs`

Test the ownership-protected application CRUD endpoints.

- [ ] **Step 1: Write application tests**

Cover the baseline contract cases for application endpoints:

1. **List applications** — authenticated user gets their apps, admin gets all
2. **Create application** — happy path returns 200 with app data including token
3. **Create application** — unauthenticated returns 401
4. **Get application by id** — owner can access, non-owner gets 403
5. **Update application** — owner can update, non-owner gets 403
6. **Delete application** — owner can delete, non-owner gets 403
7. **Admin can access any application** — admin bypasses ownership

Read the actual route handlers to verify:
- `crates/rstify-api/src/routes/applications.rs` — exact paths, request/response shapes
- The Gotify-compatible routes vs API routes (there may be both `/application` and `/api/applications`)

Each test:
1. Calls `common::setup().await`
2. Seeds test data via `common::seed::create_application()`
3. Makes HTTP request via `tower::ServiceExt::oneshot()`
4. Asserts status code
5. Asserts response body shape and key fields

- [ ] **Step 2: Run tests**

```bash
cargo test -p rstify-api --test applications_test -- --nocapture
```

- [ ] **Step 3: Commit**

```bash
git add crates/rstify-api/tests/applications_test.rs
git commit -m "test(api): add application CRUD handler tests"
```

---

## Task 5: Client CRUD handler tests

**Files:**
- Create: `crates/rstify-api/tests/clients_test.rs`

Same pattern as applications — ownership-protected CRUD.

- [ ] **Step 1: Write client tests**

Baseline contract cases:
1. **List clients** — user gets their clients
2. **Create client** — happy path with token in response
3. **Create client** — unauthenticated returns 401
4. **Delete client** — owner can delete, non-owner gets 403
5. **Admin can manage any client**

Read `crates/rstify-api/src/routes/clients.rs` for exact paths and shapes.

- [ ] **Step 2: Run tests**

```bash
cargo test -p rstify-api --test clients_test -- --nocapture
```

- [ ] **Step 3: Commit**

```bash
git add crates/rstify-api/tests/clients_test.rs
git commit -m "test(api): add client CRUD handler tests"
```

---

## Task 6: Topics handler tests

**Files:**
- Create: `crates/rstify-api/tests/topics_test.rs`

Topics are the most complex — they have ownership, permissions (ACL), and publish behavior.

- [ ] **Step 1: Write topic tests**

Baseline contract cases:
1. **Create topic** — happy path
2. **Create topic** — duplicate name returns 409
3. **Create topic** — unauthenticated returns 401
4. **List topics** — returns user's accessible topics
5. **Update topic** — owner can update
6. **Update topic** — non-owner gets 403
7. **Delete topic** — owner can delete
8. **Publish to topic** — user with write permission can publish
9. **Publish to topic** — user without write permission gets 403
10. **Topic with everyone_read/write** — any authenticated user can access

Read `crates/rstify-api/src/routes/topics/` (management.rs, permissions.rs, streaming.rs) for exact paths.

For permission tests, use `common::seed::grant_topic_permission()` to set up ACL state before testing publish/read behavior.

- [ ] **Step 2: Run tests**

```bash
cargo test -p rstify-api --test topics_test -- --nocapture
```

- [ ] **Step 3: Commit**

```bash
git add crates/rstify-api/tests/topics_test.rs
git commit -m "test(api): add topic handler tests with permission enforcement"
```

---

## Task 7: Messages handler tests

**Files:**
- Create: `crates/rstify-api/tests/messages_test.rs`

Message creation, listing, search, and pagination.

- [ ] **Step 1: Write message tests**

Baseline contract cases:
1. **Create message via app token** — Gotify-compatible POST `/message`
2. **List messages** — returns user's messages with pagination
3. **List messages** — respects `limit` and `since` parameters
4. **Delete message** — owner can delete
5. **Delete message** — non-owner gets 403
6. **Search messages** — returns matches
7. **Create message** — unauthenticated returns 401

Read `crates/rstify-api/src/routes/messages/` (crud.rs, search.rs) for exact paths and query param names.

For message creation via app token, seed an application first and use its token in the `X-Gotify-Key` header (not JWT).

- [ ] **Step 2: Run tests**

```bash
cargo test -p rstify-api --test messages_test -- --nocapture
```

- [ ] **Step 3: Commit**

```bash
git add crates/rstify-api/tests/messages_test.rs
git commit -m "test(api): add message handler tests with pagination and search"
```

---

## Task 8: Webhooks handler tests

**Files:**
- Create: `crates/rstify-api/tests/webhooks_test.rs`

Webhook config CRUD and incoming webhook verification.

- [ ] **Step 1: Write webhook tests**

Baseline contract cases:
1. **Create webhook** — happy path returns config with token
2. **List webhooks** — owner sees their webhooks with health data
3. **Update webhook** — owner can update
4. **Update webhook** — non-owner gets 403
5. **Delete webhook** — owner can delete
6. **Incoming webhook** — POST to `/api/wh/{token}` with valid JSON creates a message
7. **Incoming webhook** — invalid token returns 404
8. **Create webhook** — unauthenticated returns 401

Read `crates/rstify-api/src/routes/webhooks/` (config.rs, delivery.rs) for exact paths.

For incoming webhook tests, seed a webhook config and then POST to its token URL.

Note: True external delivery (outgoing webhooks firing HTTP to external URLs) is NOT tested here — that remains covered by the existing shell script smoke tests.

- [ ] **Step 2: Run tests**

```bash
cargo test -p rstify-api --test webhooks_test -- --nocapture
```

- [ ] **Step 3: Commit**

```bash
git add crates/rstify-api/tests/webhooks_test.rs
git commit -m "test(api): add webhook handler tests with incoming verification"
```

---

## Task 9: Validation-heavy flow tests

**Files:**
- Create: `crates/rstify-api/tests/validation_test.rs`

Test that validation helpers (from Phase 1) are correctly wired into handlers.

- [ ] **Step 1: Write validation tests**

These test the integration point where handler code calls validation helpers:

1. **Create application with empty name** — returns 400
2. **Create application with name > 200 chars** — returns 400
3. **Create topic with invalid name** (leading dot, special chars) — returns 400
4. **Create user with empty username** — returns 400
5. **Create user with duplicate username** — returns 409 (UNIQUE constraint)
6. **Update topic with invalid policy** — returns 400
7. **Create webhook with missing required fields** — returns 400 (or deserialization error)

Read the handler code to find what validations are applied. The `validation.rs` helper tests prove the validators work in isolation; these tests prove they're correctly called from the handlers.

- [ ] **Step 2: Run tests**

```bash
cargo test -p rstify-api --test validation_test -- --nocapture
```

- [ ] **Step 3: Commit**

```bash
git add crates/rstify-api/tests/validation_test.rs
git commit -m "test(api): add validation flow integration tests"
```

---

## Task 10: Final verification and CI check

- [ ] **Step 1: Run the full test suite**

```bash
cargo test --workspace
```

Count total tests. Expected: ~64 existing + ~50-60 new handler tests = ~120+ total.

- [ ] **Step 2: Verify tests run in CI**

Check that `cargo test --workspace` in the Forgejo CI config (`ci.yaml`) will automatically pick up the new integration tests. The existing CI step already runs `cargo test --workspace`, so no changes needed.

- [ ] **Step 3: Commit any final cleanup**

If any files need formatting or cleanup:

```bash
cargo fmt --all
cargo clippy --workspace -- -D warnings
git add -A && git commit -m "style: format Phase 4 test files"
```

---

## Verification Checklist

After all tasks, verify these Phase 4 completion criteria:

- [ ] All CoreError variants have conversion tests
- [ ] Test harness creates in-memory SQLite with production migrations
- [ ] Shared fixtures seed users, apps, topics, clients, webhooks deterministically
- [ ] Auth endpoints: login success, wrong password, unknown user, missing token, invalid token
- [ ] Application CRUD: list, create, get, update, delete — with ownership and admin bypass
- [ ] Client CRUD: list, create, delete — with ownership
- [ ] Topics: create, update, delete, publish — with permission enforcement
- [ ] Messages: create (via app token), list with pagination, delete — with ownership
- [ ] Webhooks: config CRUD, incoming webhook verification — with ownership
- [ ] Validation: empty names, invalid topic names, duplicate usernames, invalid policies
- [ ] `cargo test --workspace` runs all tests in CI
- [ ] Existing shell script smoke tests still work (not broken by changes)
