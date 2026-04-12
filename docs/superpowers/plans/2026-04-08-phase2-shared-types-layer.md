# Phase 2: Shared Types & Utilities Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate contract drift by making Rust API DTOs the canonical source for shared frontend types, while consolidating handwritten cross-client utilities in a single frontend-safe package.

**Architecture:** Add `ts-rs` derives to all API-facing Rust DTOs across three crates (rstify-core, rstify-api, rstify-mqtt). A codegen test exports TypeScript definitions to a new `shared/` package at the repo root. Both frontends (web-ui and client) delete their local type/time files and import from `shared/`. A Justfile recipe and CI diff check enforce freshness.

**Tech Stack:** ts-rs (Rust → TypeScript codegen), TypeScript, Vite (web-ui), Metro/Expo (client)

---

## File Structure

### New files to create

```
shared/
├── package.json                     # Minimal TS package, private
├── tsconfig.json                    # IDE support, noEmit
├── index.ts                         # Top-level barrel: re-exports generated + utils
├── generated/
│   └── (*.ts files from ts-rs)      # One file per type, auto-generated
└── utils/
    ├── index.ts                     # Re-exports all utilities
    └── time.ts                      # Unified normalizeUtcDate, formatLocalTime, formatTimeAgo
```

### Files to modify

**Rust crates (add ts-rs derives):**
- `Cargo.toml` (workspace) — add ts-rs workspace dependency
- `crates/rstify-core/Cargo.toml` — add ts-rs dependency
- `crates/rstify-api/Cargo.toml` — add ts-rs dependency
- `crates/rstify-mqtt/Cargo.toml` — add ts-rs dependency
- `crates/rstify-core/src/models/user.rs` — add TS derives to UserResponse, CreateUser, UpdateUser, ChangePassword
- `crates/rstify-core/src/models/application.rs` — add TS derives to Application, CreateApplication, UpdateApplication
- `crates/rstify-core/src/models/client.rs` — add TS derives to Client, CreateClient, UpdateClient, RegisterFcmToken
- `crates/rstify-core/src/models/topic.rs` — add TS derives to Topic, CreateTopic, UpdateTopic, TopicPermission, CreateTopicPermission
- `crates/rstify-core/src/models/message.rs` — add TS derives to MessageResponse, CreateAppMessage, CreateTopicMessage, UpdateMessage, AttachmentInfo, PagedMessages, Paging
- `crates/rstify-core/src/models/action.rs` — add TS derives to MessageAction
- `crates/rstify-core/src/models/attachment.rs` — add TS derives to Attachment, WebhookConfig, CreateWebhookConfig, UpdateWebhookConfig
- `crates/rstify-core/src/models/webhook_delivery.rs` — add TS derives to WebhookDeliveryLog
- `crates/rstify-core/src/models/webhook_variable.rs` — add TS derives to WebhookVariable, CreateWebhookVariable, UpdateWebhookVariable
- `crates/rstify-core/src/models/mqtt_bridge.rs` — add TS derives to MqttBridge, CreateMqttBridge, UpdateMqttBridge
- `crates/rstify-api/src/routes/auth.rs` — add TS derives to LoginRequest, LoginResponse
- `crates/rstify-api/src/routes/stats.rs` — add TS derives to StatsResponse
- `crates/rstify-api/src/routes/settings.rs` — add TS derives to Setting, UpdateSetting
- `crates/rstify-api/src/routes/webhooks/config.rs` — add TS derives to WebhookConfigWithHealth
- `crates/rstify-api/src/routes/webhooks/delivery.rs` — add TS derives to TestWebhookPayload
- `crates/rstify-api/src/routes/health.rs` — create typed HealthResponse, VersionResponse structs with TS derives
- `crates/rstify-api/src/routes/mqtt.rs` — add TS derives to MqttStatusResponse
- `crates/rstify-mqtt/src/bridge.rs` — add TS derives to BridgeStatusInfo

**Frontend migration:**
- `web-ui/package.json` — add shared dependency
- `web-ui/tsconfig.json` — add paths for shared
- `web-ui/vite.config.ts` — add resolve alias for shared
- `web-ui/src/api/types.ts` — DELETE (replaced by shared)
- `web-ui/src/api/client.ts` — update type imports from `./types` to `shared`
- `web-ui/src/utils/time.ts` — DELETE (replaced by shared)
- `web-ui/src/pages/Applications.tsx` — update imports
- `web-ui/src/pages/Bridges.tsx` — update imports
- `web-ui/src/pages/Clients.tsx` — update imports
- `web-ui/src/pages/Dashboard.tsx` — update imports
- `web-ui/src/pages/Messages.tsx` — update imports
- `web-ui/src/pages/Permissions.tsx` — update imports
- `web-ui/src/pages/Topics.tsx` — update imports
- `web-ui/src/pages/Users.tsx` — update imports
- `web-ui/src/pages/Webhooks.tsx` — update imports
- `web-ui/src/hooks/useAuth.ts` — update imports
- `web-ui/src/hooks/useMessageStream.ts` — update imports
- `client/package.json` — add shared dependency
- `client/tsconfig.json` — add paths for shared
- `client/metro.config.js` — add watchFolders for shared (create if needed)
- `client/src/api/types.ts` — DELETE (replaced by shared)
- `client/src/api/client.ts` — update type imports from `./types` to `shared`, inline `ApiError` type
- `client/src/api/index.ts` — update type re-export from `./types` to `shared`
- `client/src/utils/time.ts` — DELETE (replaced by shared)
- `client/src/utils/source.ts` — update imports
- `client/src/components/MessageContent.tsx` — update imports
- `client/src/components/MessageActions.tsx` — update imports
- `client/src/components/MessageAttachments.tsx` — update imports
- `client/src/components/inbox/MessageBubble.tsx` — update imports
- `client/src/components/inbox/SourceGroupCard.tsx` — update imports
- `client/src/components/inbox/StreamMessageCard.tsx` — update imports
- `client/src/components/channels/ChannelRow.tsx` — update imports
- `client/src/components/channels/FolderSection.tsx` — update imports
- `client/src/components/channels/EditTopicModal.tsx` — update imports
- `client/app/(tabs)/channels.tsx` — update imports

**Build & CI:**
- `Justfile` — add `generate-types` recipe
- `.forgejo/workflows/ci.yaml` — add generated types diff check
- `.github/workflows/docker-publish.yml` — add generated types diff check
- `CLAUDE.md` — update migration checklist

### Files to delete
- `web-ui/src/api/types.ts`
- `web-ui/src/utils/time.ts`
- `client/src/api/types.ts`
- `client/src/utils/time.ts`

---

## Task 1: Create shared/ package scaffold

**Files:**
- Create: `shared/package.json`
- Create: `shared/tsconfig.json`
- Create: `shared/index.ts`
- Create: `shared/generated/.gitkeep`
- Create: `shared/utils/index.ts`
- Create: `shared/utils/time.ts` (placeholder)

- [ ] **Step 1: Create shared/package.json**

```json
{
  "name": "shared",
  "version": "0.1.0",
  "private": true,
  "main": "index.ts"
}
```

- [ ] **Step 2: Create shared/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true
  },
  "include": ["**/*.ts"]
}
```

- [ ] **Step 3: Create shared/generated/.gitkeep**

Empty file — placeholder so the directory is tracked before codegen runs.

- [ ] **Step 4: Create shared/utils/index.ts**

```typescript
export { normalizeUtcDate, formatLocalTime, formatTimeAgo } from './time';
```

- [ ] **Step 5: Create shared/utils/time.ts (placeholder)**

```typescript
// Placeholder — full implementation in Task 6
export function normalizeUtcDate(_dateStr: string): string { return ''; }
export function formatLocalTime(_dateStr: string): string { return ''; }
export function formatTimeAgo(_dateStr: string): string { return ''; }
```

- [ ] **Step 6: Create shared/index.ts**

```typescript
export * from './generated';
export * from './utils';
```

- [ ] **Step 7: Commit**

```bash
git add shared/
git commit -m "feat(shared): create shared/ package scaffold for cross-frontend types and utilities"
```

---

## Task 2: Add ts-rs workspace dependency and configure crates

**Files:**
- Modify: `Cargo.toml` (workspace root)
- Modify: `crates/rstify-core/Cargo.toml`
- Modify: `crates/rstify-api/Cargo.toml`
- Modify: `crates/rstify-mqtt/Cargo.toml`

- [ ] **Step 1: Add ts-rs to workspace dependencies**

In `Cargo.toml` (workspace root), add to `[workspace.dependencies]`:

```toml
ts-rs = { version = "10", features = ["serde-compat", "serde-json-impl"] }
```

- [ ] **Step 2: Add ts-rs to rstify-core/Cargo.toml**

Add under `[dependencies]`:

```toml
ts-rs = { workspace = true }
```

- [ ] **Step 3: Add ts-rs to rstify-api/Cargo.toml**

Add under `[dependencies]`:

```toml
ts-rs = { workspace = true }
```

- [ ] **Step 4: Add ts-rs to rstify-mqtt/Cargo.toml**

Add under `[dependencies]`:

```toml
ts-rs = { workspace = true }
```

- [ ] **Step 5: Verify compilation**

Run: `cargo check --workspace`

Expected: Compiles with no errors. ts-rs adds no runtime cost — it only generates code for tests.

- [ ] **Step 6: Commit**

```bash
git add Cargo.toml Cargo.lock crates/rstify-core/Cargo.toml crates/rstify-api/Cargo.toml crates/rstify-mqtt/Cargo.toml
git commit -m "build: add ts-rs dependency for TypeScript type generation"
```

---

## Task 3: Add TS derives to rstify-core model DTOs

**Files:**
- Modify: `crates/rstify-core/src/models/user.rs`
- Modify: `crates/rstify-core/src/models/application.rs`
- Modify: `crates/rstify-core/src/models/client.rs`
- Modify: `crates/rstify-core/src/models/topic.rs`
- Modify: `crates/rstify-core/src/models/message.rs`
- Modify: `crates/rstify-core/src/models/action.rs`
- Modify: `crates/rstify-core/src/models/attachment.rs`
- Modify: `crates/rstify-core/src/models/webhook_delivery.rs`
- Modify: `crates/rstify-core/src/models/webhook_variable.rs`
- Modify: `crates/rstify-core/src/models/mqtt_bridge.rs`

**Pattern:** For each API-facing DTO struct, add `use ts_rs::TS;` at the top of the file, then add `TS` to the derive list and `#[ts(export)]` below it. Database-only models (like `User`, `Message`) do NOT get the derive since `UserResponse` and `MessageResponse` are the API-facing types.

**Key rules for ts-rs annotations:**
- `#[ts(export)]` generates one `.ts` file per type when tests run
- ts-rs reads serde attributes automatically (`rename_all`, `skip_serializing_if`, `flatten`, `tag`, `rename`, etc.)
- `serde_json::Value` maps to `any` — use `#[ts(type = "Record<string, unknown>")]` where the frontend expects an object shape
- Only API-facing DTOs get `#[derive(TS)]` — database models, internal structs, and config types do not

- [ ] **Step 1: Modify user.rs**

Add `use ts_rs::TS;` to the imports.

Add `TS` derive and `#[ts(export)]` to these structs (NOT to `User` — it's the database model):

```rust
#[derive(Debug, Serialize, ToSchema, TS)]
#[ts(export)]
pub struct UserResponse {
    // ... fields unchanged
}

#[derive(Debug, Deserialize, ToSchema, TS)]
#[ts(export)]
pub struct CreateUser {
    // ... fields unchanged
}

#[derive(Debug, Deserialize, ToSchema, TS)]
#[ts(export)]
pub struct UpdateUser {
    // ... fields unchanged
}

#[derive(Debug, Deserialize, ToSchema, TS)]
#[ts(export)]
pub struct ChangePassword {
    // ... fields unchanged
}
```

- [ ] **Step 2: Modify application.rs**

Add `use ts_rs::TS;` to the imports.

Add `TS` derive and `#[ts(export)]` to all three structs:

```rust
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema, TS)]
#[ts(export)]
pub struct Application {
    // ... fields unchanged
}

#[derive(Debug, Deserialize, ToSchema, TS)]
#[ts(export)]
pub struct CreateApplication {
    // ... fields unchanged
}

#[derive(Debug, Deserialize, ToSchema, TS)]
#[ts(export)]
pub struct UpdateApplication {
    // ... fields unchanged
}
```

- [ ] **Step 3: Modify client.rs**

Add `use ts_rs::TS;` to the imports.

```rust
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema, TS)]
#[ts(export)]
pub struct Client {
    // ... fields unchanged
}

#[derive(Debug, Deserialize, ToSchema, TS)]
#[ts(export)]
pub struct CreateClient {
    // ... fields unchanged
}

#[derive(Debug, Deserialize, ToSchema, TS)]
#[ts(export)]
pub struct UpdateClient {
    // ... fields unchanged
}

#[derive(Debug, Deserialize, ToSchema, TS)]
#[ts(export)]
pub struct RegisterFcmToken {
    // ... fields unchanged
}
```

- [ ] **Step 4: Modify topic.rs**

Add `use ts_rs::TS;` to the imports.

```rust
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema, TS)]
#[ts(export)]
pub struct Topic {
    // ... fields unchanged
}

#[derive(Debug, Deserialize, ToSchema, TS)]
#[ts(export)]
pub struct CreateTopic {
    // ... fields unchanged
}

#[derive(Debug, Deserialize, ToSchema, TS)]
#[ts(export)]
pub struct UpdateTopic {
    // ... fields unchanged
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema, TS)]
#[ts(export)]
pub struct TopicPermission {
    // ... fields unchanged
}

#[derive(Debug, Deserialize, ToSchema, TS)]
#[ts(export)]
pub struct CreateTopicPermission {
    // ... fields unchanged
}
```

- [ ] **Step 5: Modify action.rs**

Add `use ts_rs::TS;` to the imports.

```rust
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, TS)]
#[serde(tag = "action")]
#[ts(export)]
pub enum MessageAction {
    // ... variants unchanged
}
```

**Note:** ts-rs generates a discriminated union for `#[serde(tag = "action")]`:
```typescript
export type MessageAction =
  | { action: "view"; label: string; url: string; clear?: boolean }
  | { action: "http"; label: string; url: string; method?: string; headers?: any; body?: string; clear?: boolean }
  | { action: "broadcast"; label: string; intent?: string; extras?: any; clear?: boolean };
```

This is MORE correct than the current flat interface — it prevents invalid field combinations. Frontend code that narrows on `action.action` will work unchanged. Code that accesses fields without narrowing may need updates in Task 7/8.

- [ ] **Step 6: Modify message.rs**

Add `use ts_rs::TS;` to the imports.

Do NOT add TS to the `Message` database model. Only add to API-facing types:

```rust
#[derive(Debug, Clone, Serialize, ToSchema, TS)]
#[ts(export)]
pub struct AttachmentInfo {
    pub id: i64,
    pub name: String,
    #[serde(rename = "type")]
    pub content_type: Option<String>,
    pub size: i64,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, ToSchema, TS)]
#[ts(export)]
pub struct MessageResponse {
    // ... fields unchanged
}

#[derive(Debug, Deserialize, ToSchema, TS)]
#[ts(export)]
pub struct CreateAppMessage {
    // ... fields unchanged
}

#[derive(Debug, Deserialize, ToSchema, TS)]
#[ts(export)]
pub struct CreateTopicMessage {
    // ... fields unchanged
}

#[derive(Debug, Deserialize, ToSchema, TS)]
#[ts(export)]
pub struct UpdateMessage {
    // ... fields unchanged
}

#[derive(Debug, Serialize, ToSchema, TS)]
#[ts(export)]
pub struct PagedMessages {
    // ... fields unchanged
}

#[derive(Debug, Serialize, ToSchema, TS)]
#[ts(export)]
pub struct Paging {
    // ... fields unchanged
}
```

- [ ] **Step 7: Modify attachment.rs**

Add `use ts_rs::TS;` to the imports.

```rust
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema, TS)]
#[ts(export)]
pub struct Attachment {
    // ... fields unchanged
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema, TS)]
#[ts(export)]
pub struct WebhookConfig {
    // ... fields unchanged
}

#[derive(Debug, Deserialize, ToSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct CreateWebhookConfig {
    // ... fields unchanged
}

#[derive(Debug, Deserialize, ToSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct UpdateWebhookConfig {
    // ... fields unchanged
}
```

**Important:** `CreateWebhookConfig` and `UpdateWebhookConfig` have `#[serde(rename_all = "camelCase")]`. ts-rs will generate camelCase field names (e.g., `webhookType`, `targetTopicId`). The backend aliases ensure both camelCase and snake_case are accepted. Frontend code that constructs these objects must use camelCase after migration.

- [ ] **Step 8: Modify webhook_delivery.rs**

Add `use ts_rs::TS;` to the imports.

```rust
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema, TS)]
#[ts(export)]
pub struct WebhookDeliveryLog {
    // ... fields unchanged
}
```

- [ ] **Step 9: Modify webhook_variable.rs**

Add `use ts_rs::TS;` to the imports.

```rust
#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema, TS)]
#[ts(export)]
pub struct WebhookVariable {
    // ... fields unchanged
}

#[derive(Debug, Deserialize, ToSchema, TS)]
#[ts(export)]
pub struct CreateWebhookVariable {
    // ... fields unchanged
}

#[derive(Debug, Deserialize, ToSchema, TS)]
#[ts(export)]
pub struct UpdateWebhookVariable {
    // ... fields unchanged
}
```

- [ ] **Step 10: Modify mqtt_bridge.rs**

Add `use ts_rs::TS;` to the imports.

```rust
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema, TS)]
#[ts(export)]
pub struct MqttBridge {
    // ... fields unchanged
}

#[derive(Debug, Deserialize, ToSchema, TS)]
#[ts(export)]
pub struct CreateMqttBridge {
    // ... fields unchanged
}

#[derive(Debug, Deserialize, ToSchema, TS)]
#[ts(export)]
pub struct UpdateMqttBridge {
    // ... fields unchanged
}
```

- [ ] **Step 11: Verify compilation**

Run: `cargo check --workspace`

Expected: Compiles with no errors. The `TS` derive adds no runtime code — only test functions.

- [ ] **Step 12: Commit**

```bash
git add crates/rstify-core/
git commit -m "feat(core): add ts-rs TS derives to all API-facing model DTOs"
```

---

## Task 4: Add TS derives to rstify-api and rstify-mqtt route DTOs

**Files:**
- Modify: `crates/rstify-api/src/routes/auth.rs`
- Modify: `crates/rstify-api/src/routes/stats.rs`
- Modify: `crates/rstify-api/src/routes/settings.rs`
- Modify: `crates/rstify-api/src/routes/webhooks/config.rs`
- Modify: `crates/rstify-api/src/routes/webhooks/delivery.rs`
- Modify: `crates/rstify-api/src/routes/health.rs`
- Modify: `crates/rstify-api/src/routes/mqtt.rs`
- Modify: `crates/rstify-mqtt/src/bridge.rs`

- [ ] **Step 1: Modify auth.rs**

Add `use ts_rs::TS;` to the imports.

```rust
#[derive(Debug, Deserialize, ToSchema, TS)]
#[ts(export)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize, ToSchema, TS)]
#[ts(export)]
pub struct LoginResponse {
    pub token: String,
}
```

- [ ] **Step 2: Modify stats.rs**

Add `use ts_rs::TS;` to the imports.

```rust
#[derive(Debug, Serialize, ToSchema, TS)]
#[ts(export)]
pub struct StatsResponse {
    pub users: i64,
    pub topics: i64,
    pub messages: i64,
    pub messages_last_24h: i64,
}
```

- [ ] **Step 3: Modify settings.rs**

Add `use ts_rs::TS;` and `use utoipa::ToSchema;` to the imports.

```rust
#[derive(Serialize, ToSchema, TS)]
#[ts(export)]
pub struct Setting {
    pub key: String,
    pub value: String,
}

#[derive(Deserialize, ToSchema, TS)]
#[ts(export)]
pub struct UpdateSetting {
    pub value: String,
}
```

- [ ] **Step 4: Modify health.rs — create typed response structs**

Currently the health and version endpoints return ad-hoc `Json<Value>`. Create proper typed structs so they participate in codegen.

Replace the file contents with:

```rust
use axum::extract::State;
use axum::response::IntoResponse;
use axum::Json;
use serde::Serialize;
use std::sync::atomic::Ordering;
use ts_rs::TS;
use utoipa::ToSchema;

use crate::state::AppState;

#[derive(Debug, Serialize, ToSchema, TS)]
#[ts(export)]
pub struct HealthResponse {
    pub health: String,
    pub database: String,
    pub version: String,
}

#[derive(Debug, Serialize, ToSchema, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct VersionResponse {
    pub version: String,
    pub name: String,
    pub build_date: String,
}

#[utoipa::path(get, path = "/health", responses((status = 200, body = HealthResponse)))]
pub async fn health(State(state): State<AppState>) -> Json<HealthResponse> {
    let db_status = match sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(&state.pool)
        .await
    {
        Ok(_) => "ok",
        Err(_) => "error",
    };

    let health = if db_status == "ok" { "green" } else { "red" };

    Json(HealthResponse {
        health: health.to_string(),
        database: db_status.to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

#[utoipa::path(get, path = "/version", responses((status = 200, body = VersionResponse)))]
pub async fn version() -> Json<VersionResponse> {
    let build_date = option_env!("BUILD_DATE").unwrap_or("");

    Json(VersionResponse {
        version: env!("CARGO_PKG_VERSION").to_string(),
        name: "rstify".to_string(),
        build_date: build_date.to_string(),
    })
}

/// GET /metrics - Prometheus-format metrics
pub async fn metrics(State(state): State<AppState>) -> impl IntoResponse {
    let requests = state.metrics.http_requests_total.load(Ordering::Relaxed);
    let messages = state.metrics.messages_created_total.load(Ordering::Relaxed);
    let ws_connections = state.connections.active_count().await;

    let body = format!(
        "# HELP rstify_http_requests_total Total HTTP requests\n\
         # TYPE rstify_http_requests_total counter\n\
         rstify_http_requests_total {}\n\
         # HELP rstify_messages_created_total Total messages created\n\
         # TYPE rstify_messages_created_total counter\n\
         rstify_messages_created_total {}\n\
         # HELP rstify_websocket_connections Current WebSocket connections\n\
         # TYPE rstify_websocket_connections gauge\n\
         rstify_websocket_connections {}\n",
        requests, messages, ws_connections,
    );

    (
        [(
            axum::http::header::CONTENT_TYPE,
            "text/plain; version=0.0.4",
        )],
        body,
    )
}
```

**Note on HealthResponse:** The original ad-hoc JSON included a `max_attachment_size` field. This has been intentionally dropped from the typed struct because it's not used by either frontend type definition (`HealthResponse` in web-ui and client don't include it). If a frontend needs it later, add the field to the struct and re-run codegen.

**Note on VersionResponse:** Uses `#[serde(rename_all = "camelCase")]` so `build_date` serializes as `buildDate` to match the existing JSON contract that frontends already consume.

- [ ] **Step 5: Modify webhooks/config.rs**

Add `use ts_rs::TS;` to the imports (at the top of the file, wherever other imports are).

```rust
#[derive(Serialize, utoipa::ToSchema, TS)]
#[ts(export)]
pub struct WebhookConfigWithHealth {
    #[serde(flatten)]
    pub config: WebhookConfig,
    pub last_delivery_at: Option<String>,
    pub last_delivery_success: Option<bool>,
    pub recent_success_rate: Option<f64>,
    pub recent_durations: Option<Vec<i64>>,
}
```

ts-rs handles `#[serde(flatten)]` by inlining all `WebhookConfig` fields into the generated TypeScript interface.

- [ ] **Step 6: Modify webhooks/delivery.rs**

Add `use ts_rs::TS;` and `use utoipa::ToSchema;` to the imports.

Add TS derive to `TestWebhookPayload`:

```rust
#[derive(Deserialize, Default, ToSchema, TS)]
#[ts(export)]
pub struct TestWebhookPayload {
    pub title: Option<String>,
    pub message: Option<String>,
    pub priority: Option<i32>,
    pub topic: Option<String>,
}
```

Also create a typed `WebhookTestResult` struct. Add this near the top of the file (after imports):

```rust
#[derive(Debug, Serialize, ToSchema, TS)]
#[ts(export)]
pub struct WebhookTestResult {
    pub success: bool,
    pub direction: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status_code: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub response_preview: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub response_headers: Option<std::collections::HashMap<String, String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub webhook_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub curl_example: Option<String>,
}
```

Then update the `test_webhook` handler to return `Result<Json<WebhookTestResult>, ApiError>` instead of `Result<Json<serde_json::Value>, ApiError>`. Replace the ad-hoc `serde_json::json!({...})` blocks with `WebhookTestResult { ... }` constructors:

In the outgoing success branch:
```rust
Ok(Json(WebhookTestResult {
    success,
    direction: "outgoing".to_string(),
    status_code: Some(detail.status as u16),
    response_preview: detail.response_body,
    response_headers: detail.response_headers,
    duration_ms: Some(detail.duration_ms),
    error: None,
    webhook_url: None,
    curl_example: None,
}))
```

In the outgoing error branch:
```rust
Ok(Json(WebhookTestResult {
    success: false,
    direction: "outgoing".to_string(),
    status_code: None,
    response_preview: None,
    response_headers: None,
    duration_ms: None,
    error: Some(err),
    webhook_url: None,
    curl_example: None,
}))
```

In the incoming branch:
```rust
Ok(Json(WebhookTestResult {
    success: true,
    direction: "incoming".to_string(),
    status_code: None,
    response_preview: None,
    response_headers: None,
    duration_ms: None,
    error: None,
    webhook_url: Some(webhook_url),
    curl_example: Some(curl_cmd),
}))
```

**Note:** Check the type of `detail.response_headers` and `detail.response_body` in the `fire_single_outgoing_webhook` return type. If `response_headers` is not `Option<HashMap<String, String>>`, adjust the WebhookTestResult field type or add a conversion. If `err` is not `String`, call `.to_string()` on it.

- [ ] **Step 7: Modify mqtt.rs**

Add `use ts_rs::TS;` to the imports.

```rust
#[derive(Serialize, ToSchema, TS)]
#[ts(export)]
pub struct MqttStatusResponse {
    pub enabled: bool,
    pub listen_addr: Option<String>,
    pub ws_listen_addr: Option<String>,
    pub bridges_active: usize,
    pub bridges: Vec<BridgeStatusInfo>,
}
```

- [ ] **Step 8: Modify rstify-mqtt/bridge.rs**

Add `use ts_rs::TS;` to the imports.

```rust
#[derive(Clone, Debug, serde::Serialize, utoipa::ToSchema, TS)]
#[ts(export)]
pub struct BridgeStatusInfo {
    pub id: i64,
    pub name: String,
    pub connected: bool,
}
```

- [ ] **Step 9: Verify compilation**

Run: `cargo check --workspace`

Expected: Compiles with no errors. Pay attention to any issues with `WebhookTestResult` — the `detail` fields may need type adjustments based on the actual `fire_single_outgoing_webhook` return type.

- [ ] **Step 10: Commit**

```bash
git add crates/rstify-api/ crates/rstify-mqtt/
git commit -m "feat(api): add ts-rs TS derives to route DTOs and type health/version/webhook-test responses"
```

---

## Task 5: Run codegen and generate barrel export

**Files:**
- Generated: `shared/generated/*.ts` (one file per exported type)
- Create: `shared/generated/index.ts` (barrel export)

- [ ] **Step 1: Run ts-rs export**

```bash
TS_RS_EXPORT_DIR=./shared/generated cargo test --workspace 2>&1 | grep -E "export_bindings|test result"
```

Expected: Tests pass. Files like `UserResponse.ts`, `Application.ts`, `MessageResponse.ts`, etc. appear in `shared/generated/`.

- [ ] **Step 2: Verify generated files exist**

```bash
ls shared/generated/*.ts | head -20
```

Expected: ~40+ `.ts` files, one per exported type.

**Design note:** The spec mentions "initially one generated file". ts-rs natively generates one file per type with proper cross-references (import statements between files). This is the standard ts-rs workflow and produces the same developer experience — all types are importable from a single barrel export (`shared/generated/index.ts`). The per-file approach is more maintainable than concatenating into one large file and avoids fragile ordering concerns.

- [ ] **Step 3: Spot-check a few generated types**

```bash
cat shared/generated/UserResponse.ts
cat shared/generated/MessageAction.ts
cat shared/generated/WebhookConfig.ts
```

Verify:
- `UserResponse` has correct fields (id, username, email, is_admin, created_at, updated_at)
- `MessageAction` is a discriminated union with `action: "view" | "http" | "broadcast"` variants
- `WebhookConfig` does NOT have `username`/`password` fields (they are `#[serde(skip_serializing)]`)

- [ ] **Step 4: Generate barrel index.ts**

Create `shared/generated/index.ts` by re-exporting all generated types:

```bash
echo '// Auto-generated barrel export — do not hand-edit' > shared/generated/index.ts
echo '// Re-run: just generate-types' >> shared/generated/index.ts
echo '' >> shared/generated/index.ts
for f in shared/generated/*.ts; do
  name=$(basename "$f" .ts)
  [ "$name" = "index" ] && continue
  echo "export * from \"./$name\";" >> shared/generated/index.ts
done
```

- [ ] **Step 5: Remove the .gitkeep**

```bash
rm shared/generated/.gitkeep
```

- [ ] **Step 6: Review the generated index.ts**

```bash
cat shared/generated/index.ts
```

Verify it re-exports all generated type files. Should have ~40+ export lines.

- [ ] **Step 7: Verify TypeScript validity**

```bash
cd shared && npx tsc --noEmit 2>&1 | head -20
```

Expected: No TypeScript errors. If there are import resolution errors between generated files, ts-rs is handling cross-references correctly.

**Note:** If `npx tsc` is not available, install it: `npm install -g typescript` or check via `cd shared && npx -p typescript tsc --noEmit`.

- [ ] **Step 8: Commit**

```bash
git add shared/generated/
git commit -m "feat(shared): generate TypeScript types from Rust DTOs via ts-rs"
```

---

## Task 6: Create unified time utilities

**Files:**
- Modify: `shared/utils/time.ts` (replace placeholder)

The unified implementation combines the web-ui's full `normalizeUtcDate`/`formatLocalTime`/`formatTimeAgo` with the client's compact format. Both formats are exposed. Both frontends will use the appropriate function.

- [ ] **Step 1: Write shared/utils/time.ts**

Replace the placeholder content with:

```typescript
/**
 * Normalize a UTC date string from the backend to valid ISO 8601.
 * SQLite datetime('now') produces "2026-03-29 04:31:12" (space, no Z).
 * This normalizes to "2026-03-29T04:31:12Z" for correct UTC parsing.
 */
export function normalizeUtcDate(dateStr: string): string {
  if (!dateStr) return dateStr;
  // Already has timezone info — pass through
  if (dateStr.includes('Z') || dateStr.includes('+')) return dateStr;
  // Replace space with T and append Z for UTC
  return dateStr.replace(' ', 'T') + 'Z';
}

/**
 * Format a UTC date string to the user's local time.
 * Handles bare SQLite dates, ISO 8601 with Z, and +00:00 offset formats.
 */
export function formatLocalTime(dateStr: string): string {
  const d = new Date(normalizeUtcDate(dateStr));
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleString();
}

/**
 * Format a UTC date string as a verbose relative time (e.g., "5m ago", "2h ago").
 * Falls back to locale date string for dates older than 7 days.
 */
export function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(normalizeUtcDate(dateStr)).getTime();
  if (isNaN(then)) return dateStr;
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(normalizeUtcDate(dateStr)).toLocaleDateString();
}

/**
 * Format a UTC date string as a compact relative time (e.g., "5m", "2h").
 * Designed for space-constrained mobile UIs.
 */
export function formatTimeAgoCompact(dateStr: string): string {
  const now = Date.now();
  const then = new Date(normalizeUtcDate(dateStr)).getTime();
  if (isNaN(then)) return dateStr;
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}
```

**Key differences from the two original implementations:**
- `normalizeUtcDate` is now exported (was private in web-ui, missing in client)
- `formatTimeAgo` uses the web-ui's verbose format ("5m ago") — web-ui pages use this
- `formatTimeAgoCompact` uses the client's compact format ("5m") — mobile components use this
- Both functions now normalize dates before parsing (the client's original version didn't)

- [ ] **Step 2: Update shared/utils/index.ts**

```typescript
export {
  normalizeUtcDate,
  formatLocalTime,
  formatTimeAgo,
  formatTimeAgoCompact,
} from './time';
```

- [ ] **Step 3: Commit**

```bash
git add shared/utils/
git commit -m "feat(shared): add unified time utilities with date normalization"
```

---

## Task 7: Migrate web-ui to shared package

**Files:**
- Modify: `web-ui/package.json`
- Modify: `web-ui/tsconfig.json`
- Modify: `web-ui/vite.config.ts`
- Delete: `web-ui/src/api/types.ts`
- Delete: `web-ui/src/utils/time.ts`
- Modify: 11 page/hook files (import updates)

- [ ] **Step 1: Add shared dependency to web-ui/package.json**

Add to `"dependencies"`:

```json
"shared": "file:../shared"
```

- [ ] **Step 2: Run npm install to create symlink**

```bash
cd web-ui && npm install
```

- [ ] **Step 3: Add path mapping to web-ui/tsconfig.json**

Add `"baseUrl"` and `"paths"` to `"compilerOptions"`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "baseUrl": ".",
    "paths": {
      "shared": ["../shared"],
      "shared/*": ["../shared/*"]
    }
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Add resolve alias to web-ui/vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: '/',
  resolve: {
    alias: {
      'shared': path.resolve(__dirname, '../shared'),
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
      '/message': 'http://localhost:8080',
      '/application': 'http://localhost:8080',
      '/client': 'http://localhost:8080',
      '/user': 'http://localhost:8080',
      '/current': 'http://localhost:8080',
      '/stream': 'http://localhost:8080',
      '/health': 'http://localhost:8080',
      '/version': 'http://localhost:8080',
      '/docs': 'http://localhost:8080',
    },
  },
  build: {
    outDir: 'dist',
  },
})
```

- [ ] **Step 5: Delete web-ui/src/api/types.ts**

```bash
rm web-ui/src/api/types.ts
```

- [ ] **Step 6: Delete web-ui/src/utils/time.ts**

```bash
rm web-ui/src/utils/time.ts
```

- [ ] **Step 7: Update web-ui/src/api/client.ts imports**

The API client file imports all types from `./types`. Change the import source to `shared` and rename types:

```typescript
// Before:
import type {
  User, CreateUser, UpdateUser,
  Application, CreateApplication, UpdateApplication,
  Client, CreateClient, UpdateClient,
  Topic, CreateTopic,
  TopicPermission, CreateTopicPermission,
  PagedMessages, MessageResponse, AttachmentInfo,
  WebhookConfig, CreateWebhookConfig, UpdateWebhookConfig,
  WebhookDeliveryLog, WebhookTestResult,
  WebhookVariable, CreateWebhookVariable, UpdateWebhookVariable,
  MqttBridge, CreateMqttBridge, UpdateMqttBridge, MqttStatus,
  StatsResponse, LoginResponse,
  HealthResponse, VersionResponse,
  Setting,
} from './types';

// After:
import type {
  UserResponse, CreateUser, UpdateUser,
  Application, CreateApplication, UpdateApplication,
  Client, CreateClient, UpdateClient,
  Topic, CreateTopic,
  TopicPermission, CreateTopicPermission,
  PagedMessages, MessageResponse, AttachmentInfo,
  WebhookConfig, CreateWebhookConfig, UpdateWebhookConfig,
  WebhookDeliveryLog, WebhookTestResult,
  WebhookVariable, CreateWebhookVariable, UpdateWebhookVariable,
  MqttBridge, CreateMqttBridge, UpdateMqttBridge, MqttStatusResponse,
  StatsResponse, LoginResponse,
  HealthResponse, VersionResponse,
  Setting,
} from 'shared';
```

Then rename `User` → `UserResponse` and `MqttStatus` → `MqttStatusResponse` throughout the file wherever used in method signatures and return types.

- [ ] **Step 8: Update all web-ui page/hook import statements**

Replace all `from '../api/types'` and `from '../utils/time'` imports across web-ui files. The exact replacements depend on the generated type names.

**Key type name changes to watch for:**
- `User` → `UserResponse` (the generated type uses the Rust struct name)
- `WebhookConfig` list data → may need `WebhookConfigWithHealth` for endpoints returning health data
- `MessageAction` changes from flat interface to discriminated union — check for code that accesses fields without narrowing on `action`

For each file, change the import source from `'../api/types'` to `'shared'`, and from `'../utils/time'` to `'shared'`:

**`web-ui/src/hooks/useAuth.ts`:**
```typescript
// Before:
import type { User } from '../api/types';
// After:
import type { UserResponse } from 'shared';
```
Then rename `User` → `UserResponse` in the file's usage.

**`web-ui/src/hooks/useMessageStream.ts`:**
```typescript
// Before:
import type { MessageResponse } from '../api/types';
// After:
import type { MessageResponse } from 'shared';
```

**`web-ui/src/pages/Applications.tsx`:**
```typescript
// Before:
import type { Application, CreateApplication, UpdateApplication, MessageResponse } from '../api/types';
import { formatLocalTime } from '../utils/time';
// After:
import type { Application, CreateApplication, UpdateApplication, MessageResponse } from 'shared';
import { formatLocalTime } from 'shared';
```

**`web-ui/src/pages/Bridges.tsx`:**
```typescript
// Before:
import type { MqttBridge, MqttStatus, CreateMqttBridge, UpdateMqttBridge } from '../api/types';
// After:
import type { MqttBridge, CreateMqttBridge, UpdateMqttBridge, MqttStatusResponse } from 'shared';
```
Note: `MqttStatus` was the handwritten name — generated name is `MqttStatusResponse`. Rename usage throughout the file.

**`web-ui/src/pages/Clients.tsx`:**
```typescript
// Before:
import type { Client, CreateClient, UpdateClient } from '../api/types';
import { formatLocalTime } from '../utils/time';
// After:
import type { Client, CreateClient, UpdateClient } from 'shared';
import { formatLocalTime } from 'shared';
```

**`web-ui/src/pages/Dashboard.tsx`:**
```typescript
// Before:
import type { StatsResponse, HealthResponse, VersionResponse, MqttStatus } from '../api/types';
// After:
import type { StatsResponse, HealthResponse, VersionResponse, MqttStatusResponse } from 'shared';
```
Rename `MqttStatus` → `MqttStatusResponse` in usage.

**`web-ui/src/pages/Messages.tsx`:**
```typescript
// Before:
import type { Application, MessageResponse } from '../api/types';
import { formatLocalTime } from '../utils/time';
// After:
import type { Application, MessageResponse } from 'shared';
import { formatLocalTime } from 'shared';
```

**`web-ui/src/pages/Permissions.tsx`:**
```typescript
// Before:
import type { TopicPermission, CreateTopicPermission, User } from '../api/types';
// After:
import type { TopicPermission, CreateTopicPermission, UserResponse } from 'shared';
```
Rename `User` → `UserResponse` in usage.

**`web-ui/src/pages/Topics.tsx`:**
```typescript
// Before:
import type { Topic, CreateTopic, MessageResponse } from '../api/types';
import { formatLocalTime } from '../utils/time';
// After:
import type { Topic, CreateTopic, MessageResponse } from 'shared';
import { formatLocalTime } from 'shared';
```

**`web-ui/src/pages/Users.tsx`:**
```typescript
// Before:
import type { User, CreateUser, UpdateUser } from '../api/types';
import { formatLocalTime } from '../utils/time';
// After:
import type { UserResponse, CreateUser, UpdateUser } from 'shared';
import { formatLocalTime } from 'shared';
```
Rename `User` → `UserResponse` in usage.

**`web-ui/src/pages/Webhooks.tsx`:**
```typescript
// Before:
import type { WebhookConfig, CreateWebhookConfig, UpdateWebhookConfig, WebhookDeliveryLog, WebhookTestResult, Topic, Application, WebhookVariable } from '../api/types';
import { formatLocalTime } from '../utils/time';
// After:
import type { WebhookConfigWithHealth, WebhookConfig, CreateWebhookConfig, UpdateWebhookConfig, WebhookDeliveryLog, WebhookTestResult, Topic, Application, WebhookVariable } from 'shared';
import { formatLocalTime } from 'shared';
```
The webhook list state type may need to change from `WebhookConfig[]` to `WebhookConfigWithHealth[]` since the list endpoint returns health data.

- [ ] **Step 9: Fix compilation errors**

Run: `cd web-ui && npx tsc --noEmit 2>&1 | head -50`

Common fixes needed:
1. **`User` → `UserResponse` rename** — update all variable types and generic parameters
2. **`MqttStatus` → `MqttStatusResponse` rename** — update Dashboard and Bridges pages
3. **Optional vs nullable fields** — generated types use `T | null` where handwritten used `T?`. Code that checks `!== undefined` may need `!== null` instead. But most checks (`if (field)`) handle both.
4. **`MessageAction` discriminated union** — if any code accesses `.url` or `.headers` without narrowing on `.action`, TypeScript will error. Fix by adding `if (action.action === 'http') { ... }` guards.
5. **`CreateWebhookConfig` camelCase fields** — generated type uses `webhookType`, `targetTopicId`, etc. Update object literals where these are constructed.

Iterate: fix errors, re-run `npx tsc --noEmit`, repeat until clean.

- [ ] **Step 10: Verify web-ui builds**

Run: `cd web-ui && npm run build`

Expected: Build succeeds with no errors.

- [ ] **Step 11: Commit**

```bash
git add web-ui/ shared/
git commit -m "refactor(web-ui): migrate to shared types and time utilities"
```

---

## Task 8: Migrate client to shared package

**Files:**
- Modify: `client/package.json`
- Modify: `client/tsconfig.json`
- Create or modify: `client/metro.config.js` (if needed for watchFolders)
- Delete: `client/src/api/types.ts`
- Delete: `client/src/utils/time.ts`
- Modify: 12 component/screen files (import updates)

- [ ] **Step 1: Add shared dependency to client/package.json**

Add to `"dependencies"`:

```json
"shared": "file:../shared"
```

- [ ] **Step 2: Run npm install**

```bash
cd client && npm install
```

- [ ] **Step 3: Add path mapping to client/tsconfig.json**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "shared": ["../shared"],
      "shared/*": ["../shared/*"]
    }
  },
  "include": [
    "**/*.ts",
    "**/*.tsx",
    ".expo/types/**/*.d.ts",
    "nativewind-env.d.ts"
  ]
}
```

- [ ] **Step 4: Configure Metro to watch shared directory**

Check if `client/metro.config.js` exists. If not, create it. If it exists, add the `watchFolders` entry.

Create `client/metro.config.js` (or merge into existing):

```javascript
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Allow Metro to resolve files from the shared package
const sharedDir = path.resolve(__dirname, '../shared');
config.watchFolders = [sharedDir];
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(__dirname, '../shared'),
];

module.exports = config;
```

If `metro.config.js` already exists, just add the `watchFolders` and `nodeModulesPaths` entries to the existing config.

- [ ] **Step 5: Delete client/src/api/types.ts**

```bash
rm client/src/api/types.ts
```

- [ ] **Step 6: Delete client/src/utils/time.ts**

```bash
rm client/src/utils/time.ts
```

- [ ] **Step 7: Update client/src/api/client.ts imports**

The API client imports all types from `./types`. Change the import source to `shared` and handle the `ApiError` type (which is client-specific and not generated):

```typescript
// Before:
import type {
  ApiError,
  Application,
  AttachmentInfo,
  ChangePassword,
  // ... all other types
} from "./types";

// After — move ApiError inline, import the rest from shared:
import type {
  Application,
  AttachmentInfo,
  ChangePassword,
  Client,
  CreateApplication,
  CreateClient,
  CreateMqttBridge,
  CreateTopic,
  CreateTopicMessage,
  CreateTopicPermission,
  CreateAppMessage,
  CreateUser,
  CreateWebhookConfig,
  HealthResponse,
  LoginRequest,
  LoginResponse,
  MessageResponse,
  MqttBridge,
  MqttStatusResponse,
  PagedMessages,
  StatsResponse,
  Topic,
  TopicPermission,
  UpdateApplication,
  UpdateMqttBridge,
  UpdateTopic,
  UpdateUser,
  UpdateWebhookConfig,
  UserResponse,
  VersionResponse,
  WebhookConfig,
  WebhookDeliveryLog,
  WebhookTestResult,
} from "shared";

// ApiError is client-specific — not an API DTO, keep local
interface ApiError {
  error: string;
  errorCode: number;
}
```

Note: `MqttStatus` → `MqttStatusResponse` rename applies here too.

- [ ] **Step 8: Update client/src/api/index.ts**

```typescript
// Before:
export { RstifyClient, RstifyApiError, getApiClient, initApiClient } from "./client";
export type * from "./types";

// After:
export { RstifyClient, RstifyApiError, getApiClient, initApiClient } from "./client";
export type * from "shared";
```

- [ ] **Step 9: Update all client component/screen import statements**

For each file, change `from '../api/types'` or `from '../../api/types'` to `from 'shared'`, and `from '../../utils/time'` to `from 'shared'`.

**Key type name changes for client:**
- `UserResponse` stays `UserResponse` (client already used this name)
- `formatTimeAgo` → `formatTimeAgoCompact` (client used compact format: "5m" not "5m ago")

**`client/src/utils/source.ts`:**
```typescript
// Before:
import type { MessageResponse } from "../api/types";
// After:
import type { MessageResponse } from "shared";
```

**`client/src/components/MessageContent.tsx`:**
```typescript
// Before:
import type { MessageResponse } from "../api/types";
// After:
import type { MessageResponse } from "shared";
```

**`client/src/components/MessageActions.tsx`:**
```typescript
// Before:
import type { MessageResponse, MessageAction } from "../api/types";
// After:
import type { MessageResponse, MessageAction } from "shared";
```

**`client/src/components/MessageAttachments.tsx`:**
```typescript
// Before:
import type { MessageResponse, AttachmentInfo } from "../api/types";
// After:
import type { MessageResponse, AttachmentInfo } from "shared";
```

**`client/src/components/inbox/MessageBubble.tsx`:**
```typescript
// Before:
import type { MessageResponse } from "../../api/types";
// After:
import type { MessageResponse } from "shared";
```

**`client/src/components/inbox/SourceGroupCard.tsx`:**
```typescript
// Before:
import { formatTimeAgo } from "../../utils/time";
// After:
import { formatTimeAgoCompact as formatTimeAgo } from "shared";
```

**`client/src/components/inbox/StreamMessageCard.tsx`:**
```typescript
// Before:
import { formatTimeAgo } from "../../utils/time";
import type { MessageResponse } from "../../api/types";
// After:
import { formatTimeAgoCompact as formatTimeAgo } from "shared";
import type { MessageResponse } from "shared";
```

**`client/src/components/channels/ChannelRow.tsx`:**
```typescript
// Before:
import type { Topic } from "../../api/types";
// After:
import type { Topic } from "shared";
```

**`client/src/components/channels/FolderSection.tsx`:**
```typescript
// Before:
import type { Topic } from "../../api/types";
// After:
import type { Topic } from "shared";
```

**`client/src/components/channels/EditTopicModal.tsx`:**
```typescript
// Before:
import type { Topic } from "../../api/types";
// After:
import type { Topic } from "shared";
```

**`client/app/(tabs)/channels.tsx`:**
```typescript
// Before:
import type { Topic } from "../../src/api/types";
// After:
import type { Topic } from "shared";
```

- [ ] **Step 10: Search for any remaining old imports**

```bash
grep -rn "from.*api/types" client/src/ client/app/ 2>/dev/null
grep -rn "from.*utils/time" client/src/ client/app/ 2>/dev/null
```

Expected: No matches. If any remain, update them.

- [ ] **Step 11: Fix compilation errors**

Run: `cd client && npx tsc --noEmit 2>&1 | head -50`

Common fixes needed:
1. **`MessageAction` discriminated union** — same issue as web-ui. Mobile code that accesses action fields without narrowing needs guards.
2. **`inbox` field added to `MessageResponse`** — the generated type includes `inbox: boolean` which the client's old type didn't have. This should not cause errors (extra fields are fine), but verify.
3. **Nullable vs optional** — generated types use `T | null` consistently. Client code already used this pattern, so fewer issues expected.
4. **Any remaining deep path imports** — ensure all imports use `"shared"` not `"../../shared/generated/..."`.

Iterate until TypeScript is clean.

- [ ] **Step 12: Verify client TypeScript check passes**

```bash
cd client && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 13: Commit**

```bash
git add client/ shared/
git commit -m "refactor(client): migrate to shared types and time utilities"
```

---

## Task 9: Add Justfile recipe, CI guardrails, and documentation updates

**Files:**
- Modify: `Justfile`
- Modify: `.forgejo/workflows/ci.yaml`
- Modify: `.github/workflows/docker-publish.yml`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add generate-types recipe to Justfile**

Add after the existing recipes:

```just
# Generate TypeScript types from Rust DTOs
generate-types:
    TS_RS_EXPORT_DIR=./shared/generated cargo test --workspace 2>&1 | tail -5
    @echo '// Auto-generated barrel export — do not hand-edit' > shared/generated/index.ts
    @echo '// Re-run: just generate-types' >> shared/generated/index.ts
    @echo '' >> shared/generated/index.ts
    @for f in shared/generated/*.ts; do \
        name=$$(basename "$$f" .ts); \
        [ "$$name" = "index" ] && continue; \
        echo "export * from \"./$$name\";" >> shared/generated/index.ts; \
    done
    @echo "Generated $$(ls shared/generated/*.ts | grep -v index.ts | wc -l) type files"
```

- [ ] **Step 2: Verify the recipe works**

Run: `just generate-types`

Expected: Runs cargo test, generates TypeScript files, creates barrel index, prints count.

- [ ] **Step 3: Verify no diff after re-running**

```bash
git diff shared/generated/
```

Expected: No changes — re-running codegen on the same Rust source produces identical output.

- [ ] **Step 4: Add CI diff check to Forgejo CI**

In `.forgejo/workflows/ci.yaml`, add a new step to the `test` job (after "Run tests"):

```yaml
      - name: Verify generated types are up-to-date
        run: |
          TS_RS_EXPORT_DIR=./shared/generated cargo test --workspace 2>&1 | tail -1
          # Regenerate barrel index
          echo '// Auto-generated barrel export — do not hand-edit' > shared/generated/index.ts
          echo '// Re-run: just generate-types' >> shared/generated/index.ts
          echo '' >> shared/generated/index.ts
          for f in shared/generated/*.ts; do
            name=$(basename "$f" .ts)
            [ "$name" = "index" ] && continue
            echo "export * from \"./$name\";" >> shared/generated/index.ts
          done
          # Fail if there are diffs
          if ! git diff --exit-code shared/generated/; then
            echo "ERROR: Generated types are out of date. Run 'just generate-types' and commit the result."
            exit 1
          fi
```

- [ ] **Step 5: Add CI diff check to GitHub Actions**

In `.github/workflows/docker-publish.yml`, add after the `cargo test` step in the `test` job:

```yaml
      - name: Verify generated types are up-to-date
        run: |
          TS_RS_EXPORT_DIR=./shared/generated cargo test --workspace 2>&1 | tail -1
          echo '// Auto-generated barrel export — do not hand-edit' > shared/generated/index.ts
          echo '// Re-run: just generate-types' >> shared/generated/index.ts
          echo '' >> shared/generated/index.ts
          for f in shared/generated/*.ts; do
            name=$(basename "$f" .ts)
            [ "$name" = "index" ] && continue
            echo "export * from \"./$name\";" >> shared/generated/index.ts
          done
          if ! git diff --exit-code shared/generated/; then
            echo "ERROR: Generated types are out of date. Run 'just generate-types' and commit the result."
            exit 1
          fi
```

- [ ] **Step 6: Update CLAUDE.md migration checklist**

In `CLAUDE.md`, update the "New Migration Checklist" section. Replace:

```
4. Update TypeScript types (web UI + mobile)
```

With:

```
4. Re-run `just generate-types` and verify shared output
```

- [ ] **Step 7: Verify full pipeline**

```bash
# Backend compiles
cargo check --workspace

# Types generate cleanly
just generate-types

# Web UI builds
cd web-ui && npm run build

# No stale files
git status
```

Expected: All commands succeed. Only the Justfile, CI configs, and CLAUDE.md are modified (not generated files, since we just ran codegen).

- [ ] **Step 8: Commit**

```bash
git add Justfile .forgejo/ .github/ CLAUDE.md
git commit -m "build: add generate-types recipe and CI freshness checks for shared types"
```

---

## Summary of generated type name mapping

This table maps old handwritten TypeScript type names to generated names. Use it during Tasks 7-8 when updating imports.

| Old name (web-ui) | Old name (client) | Generated name | Notes |
|---|---|---|---|
| `User` | `UserResponse` | `UserResponse` | Web-ui must rename |
| — | `ChangePassword` | `ChangePassword` | Was client-only, now shared |
| `Application` | `Application` | `Application` | No change |
| `Client` | `Client` | `Client` | No change |
| `Topic` | `Topic` | `Topic` | No change |
| `MessageAction` | `MessageAction` | `MessageAction` | Now discriminated union, not flat interface |
| `MessageResponse` | `MessageResponse` | `MessageResponse` | Nullable fields change from `?` to `\| null` |
| `PagedMessages` | `PagedMessages` | `PagedMessages` | `Paging` is now a named type, not inline |
| `WebhookConfig` | `WebhookConfig` | `WebhookConfig` | Health fields NOT included — use `WebhookConfigWithHealth` for list data |
| `CreateWebhookConfig` | `CreateWebhookConfig` | `CreateWebhookConfig` | Fields now camelCase (`webhookType` not `webhook_type`) |
| `UpdateWebhookConfig` | `UpdateWebhookConfig` | `UpdateWebhookConfig` | Fields now camelCase |
| `WebhookTestResult` | `WebhookTestResult` | `WebhookTestResult` | Now typed Rust struct |
| `MqttStatus` | `MqttStatus` | `MqttStatusResponse` | Renamed |
| `HealthResponse` | `HealthResponse` | `HealthResponse` | Now typed Rust struct |
| `VersionResponse` | `VersionResponse` | `VersionResponse` | Now typed Rust struct (`buildDate` via rename) |
| — | `LoginRequest` | `LoginRequest` | Was client-only, now shared |
| — | `CreateAppMessage` | `CreateAppMessage` | Was client-only, now shared |
| — | `CreateTopicMessage` | `CreateTopicMessage` | Was client-only, now shared |
| — | `Attachment` | `Attachment` | Was client-only, now shared |
| — | `UpdateTopic` | `UpdateTopic` | Was client-only, now shared |
| `Setting` | — | `Setting` | No change |
| — | `RegisterFcmToken` | `RegisterFcmToken` | Now shared |
| — | `TestWebhookPayload` | `TestWebhookPayload` | Now shared |
| — | `ApiError` | — | NOT generated — client-specific error handling stays local |
| `formatLocalTime` | — | `formatLocalTime` | From `shared/utils/time` |
| `formatTimeAgo` (verbose) | — | `formatTimeAgo` | From `shared/utils/time` |
| — | `formatTimeAgo` (compact) | `formatTimeAgoCompact` | Client uses `as formatTimeAgo` alias |
