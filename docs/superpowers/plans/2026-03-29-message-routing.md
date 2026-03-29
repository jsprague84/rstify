# Message Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add inbox routing — messages get an `inbox` flag at creation time that controls Inbox visibility and push notifications. Per-topic override with configurable global priority threshold.

**Architecture:** Three migrations (inbox column, topic fields, settings table), update the `create` trait/impl to accept `inbox` parameter, add `should_inbox` to policy.rs, update all 5 message creation paths, filter the message list API and WebSocket stream, replace `should_notify` with inbox flag for FCM, update both frontends.

**Tech Stack:** Rust (Axum, sqlx, SQLite), React 19 (web UI), React Native/Expo (mobile)

---

## File Map

### New Files
- `migrations/027_message_inbox.sql`
- `migrations/028_topic_inbox_override.sql`
- `migrations/029_settings_table.sql`
- `crates/rstify-api/src/routes/settings.rs` — Settings CRUD endpoints

### Modified Files — Backend Core
- `crates/rstify-core/src/models/message.rs` — Add `inbox` field to `Message` struct
- `crates/rstify-core/src/models/topic.rs` — Add `inbox_override`, `inbox_priority_min` fields
- `crates/rstify-core/src/policy.rs` — Add `should_inbox` function
- `crates/rstify-core/src/repositories/message.rs` — Add `inbox` param to `create` trait
- `crates/rstify-db/src/repositories/message.rs` — Add `inbox` to INSERT SQL, add inbox filter to list queries
- `crates/rstify-db/src/pool.rs` — Register migrations 027-029

### Modified Files — Backend Routes
- `crates/rstify-api/src/routes/messages.rs` — Pass `inbox: true` for app messages, add `?inbox=` filter to list
- `crates/rstify-api/src/routes/topics.rs` — Evaluate `should_inbox`, pass flag, replace `should_notify` with flag
- `crates/rstify-api/src/routes/ntfy_publish.rs` — Same as topics
- `crates/rstify-api/src/routes/webhooks.rs` — Evaluate for topic-targeted, true for app-targeted
- `crates/rstify-api/src/routes/mod.rs` — Register settings routes
- `crates/rstify-api/src/state.rs` — Add settings cache
- `crates/rstify-api/src/lib.rs` — Declare settings module
- `crates/rstify-mqtt/src/ingest.rs` — Evaluate `should_inbox`

### Modified Files — Backend Other
- `crates/rstify-api/src/websocket/manager.rs` — Filter user stream by inbox flag
- `crates/rstify-core/src/models/message.rs` — Include `inbox` in `MessageResponse`

### Modified Files — Frontend
- `web-ui/src/api/types.ts` — Add inbox fields to types
- `web-ui/src/api/client.ts` — Add settings methods, update listMessages
- `web-ui/src/pages/Messages.tsx` — Pass `?inbox=true`
- `web-ui/src/pages/Topics.tsx` — Add inbox override to edit form
- `web-ui/src/pages/Settings.tsx` — Add threshold setting (admin)
- `client/src/api/types.ts` — Add inbox fields (mobile)
- `client/src/api/client.ts` — Update listMessages (mobile)
- `client/src/store/messages.ts` — Pass `?inbox=true` (mobile)

---

## Task 1: Database Migrations

**Files:**
- Create: `migrations/027_message_inbox.sql`
- Create: `migrations/028_topic_inbox_override.sql`
- Create: `migrations/029_settings_table.sql`
- Modify: `crates/rstify-db/src/pool.rs`

- [ ] **Step 1: Create migration 027 — message inbox column**

```sql
-- migrations/027_message_inbox.sql
ALTER TABLE messages ADD COLUMN inbox BOOLEAN NOT NULL DEFAULT 1;
```

- [ ] **Step 2: Create migration 028 — topic inbox fields**

```sql
-- migrations/028_topic_inbox_override.sql
ALTER TABLE topics ADD COLUMN inbox_override TEXT DEFAULT NULL;
ALTER TABLE topics ADD COLUMN inbox_priority_min INTEGER DEFAULT NULL;
```

- [ ] **Step 3: Create migration 029 — settings table**

```sql
-- migrations/029_settings_table.sql
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
INSERT OR IGNORE INTO settings (key, value) VALUES ('inbox_priority_threshold', '5');
```

- [ ] **Step 4: Register all three migrations in pool.rs**

In `crates/rstify-db/src/pool.rs`, find the migrations array end (after `026_webhook_secret`). Add:

```rust
            (
                "027_message_inbox",
                include_str!("../../../migrations/027_message_inbox.sql"),
            ),
            (
                "028_topic_inbox_override",
                include_str!("../../../migrations/028_topic_inbox_override.sql"),
            ),
            (
                "029_settings_table",
                include_str!("../../../migrations/029_settings_table.sql"),
            ),
```

- [ ] **Step 5: Verify compiles**

Run: `cargo check -p rstify-db`
Expected: Clean compilation

- [ ] **Step 6: Commit**

```bash
git add migrations/027_message_inbox.sql migrations/028_topic_inbox_override.sql migrations/029_settings_table.sql crates/rstify-db/src/pool.rs
git commit -m "feat(backend): add migrations for inbox flag, topic override, and settings table"
```

---

## Task 2: Update Core Models

**Files:**
- Modify: `crates/rstify-core/src/models/message.rs`
- Modify: `crates/rstify-core/src/models/topic.rs`

- [ ] **Step 1: Add `inbox` field to Message struct**

In `crates/rstify-core/src/models/message.rs`, find the `Message` struct. Add after `source`:

```rust
    pub inbox: bool,
```

- [ ] **Step 2: Add `inbox` field to MessageResponse**

Find the `MessageResponse` struct. Add after `source`:

```rust
    pub inbox: bool,
```

- [ ] **Step 3: Update `to_response` to include inbox**

Find `to_response`. Add to the `MessageResponse` construction:

```rust
            inbox: self.inbox,
```

- [ ] **Step 4: Add inbox fields to Topic struct**

In `crates/rstify-core/src/models/topic.rs`, find the `Topic` struct. Add after `store_interval`:

```rust
    #[serde(skip_serializing_if = "Option::is_none")]
    pub inbox_override: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub inbox_priority_min: Option<i32>,
```

- [ ] **Step 5: Add inbox fields to UpdateTopic**

Find `UpdateTopic` (or the topic update struct). Add:

```rust
    pub inbox_override: Option<String>,
    pub inbox_priority_min: Option<i32>,
```

- [ ] **Step 6: Verify compiles**

Run: `cargo check -p rstify-core`
Expected: Errors in dependent crates (expected — they need the new `inbox` parameter)

- [ ] **Step 7: Commit**

```bash
git add crates/rstify-core/src/models/message.rs crates/rstify-core/src/models/topic.rs
git commit -m "feat(backend): add inbox field to Message and inbox_override to Topic models"
```

---

## Task 3: Add `should_inbox` to Policy

**Files:**
- Modify: `crates/rstify-core/src/policy.rs`

- [ ] **Step 1: Add should_inbox function**

Add after the existing `should_store` function:

```rust
/// Determine whether a message should appear in the Inbox (and trigger push notification).
/// App messages (no topic) always go to inbox.
/// Topic messages are routed by the topic's inbox_override or the global priority threshold.
pub fn should_inbox(topic: &Topic, priority: i32, global_threshold: i32) -> bool {
    match topic.inbox_override.as_deref() {
        Some("always") => true,
        Some("never") => false,
        Some("threshold") => {
            let min = topic.inbox_priority_min.unwrap_or(global_threshold);
            priority >= min
        }
        _ => priority >= global_threshold,
    }
}
```

- [ ] **Step 2: Verify compiles**

Run: `cargo check -p rstify-core`

- [ ] **Step 3: Commit**

```bash
git add crates/rstify-core/src/policy.rs
git commit -m "feat(backend): add should_inbox policy function for message routing"
```

---

## Task 4: Update Message Repository — Create + List

**Files:**
- Modify: `crates/rstify-core/src/repositories/message.rs`
- Modify: `crates/rstify-db/src/repositories/message.rs`

- [ ] **Step 1: Add `inbox` parameter to trait**

In `crates/rstify-core/src/repositories/message.rs`, find the `create` signature. Add `inbox: bool` as the last parameter (before the return type):

```rust
    async fn create(
        &self,
        application_id: Option<i64>,
        topic_id: Option<i64>,
        user_id: Option<i64>,
        title: Option<&str>,
        message: &str,
        priority: i32,
        tags: Option<&str>,
        click_url: Option<&str>,
        icon_url: Option<&str>,
        actions: Option<&str>,
        extras: Option<&str>,
        content_type: Option<&str>,
        scheduled_for: Option<&str>,
        source: Option<&str>,
        inbox: bool,
    ) -> Result<Message, CoreError>;
```

- [ ] **Step 2: Update the SQL implementation**

In `crates/rstify-db/src/repositories/message.rs`, find the `create` implementation. Update the signature to match the trait. Update the INSERT SQL:

```rust
        sqlx::query_as::<_, Message>(
            r#"INSERT INTO messages
                (application_id, topic_id, user_id, title, message, priority, tags, click_url, icon_url, actions, extras, content_type, scheduled_for, source, inbox)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                RETURNING *"#,
        )
```

Add the bind after `.bind(source)`:

```rust
        .bind(inbox)
```

- [ ] **Step 3: Add inbox filter to list_by_user_apps**

Find the `list_by_user_apps` function (used by `GET /message`). It likely has a SQL query with `WHERE` clause and `ORDER BY`. Add an optional `inbox` filter parameter:

In the trait, update the signature to accept `inbox: Option<bool>`:

```rust
    async fn list_by_user_apps(
        &self,
        user_id: i64,
        limit: i64,
        since: i64,
        inbox: Option<bool>,
    ) -> Result<Vec<Message>, CoreError>;
```

In the implementation, if `inbox` is `Some(true)`, add `AND m.inbox = 1` to the WHERE clause. If `Some(false)`, add `AND m.inbox = 0`. If `None`, no filter (backwards compatible).

Use a query builder approach — read the existing implementation to understand the current SQL pattern and add the inbox condition in the same style.

- [ ] **Step 4: Verify compiles**

Run: `cargo check -p rstify-db`
Expected: Errors in route files (expected — they need to pass the new parameters)

- [ ] **Step 5: Commit**

```bash
git add crates/rstify-core/src/repositories/message.rs crates/rstify-db/src/repositories/message.rs
git commit -m "feat(backend): add inbox param to message create and inbox filter to list query"
```

---

## Task 5: Add Settings Cache to AppState + Settings Routes

**Files:**
- Create: `crates/rstify-api/src/routes/settings.rs`
- Modify: `crates/rstify-api/src/state.rs`
- Modify: `crates/rstify-api/src/routes/mod.rs`

- [ ] **Step 1: Add settings cache to AppState**

In `crates/rstify-api/src/state.rs`, add to `AppState`:

```rust
    pub inbox_threshold: Arc<std::sync::atomic::AtomicI32>,
```

Initialize it during server startup by reading from the settings table. The initial value should be loaded from the DB, defaulting to 5.

- [ ] **Step 2: Create settings routes**

Create `crates/rstify-api/src/routes/settings.rs`:

```rust
use axum::extract::State;
use axum::extract::Path;
use axum::Json;
use serde::{Deserialize, Serialize};
use crate::auth::AuthUser;
use crate::error::ApiError;
use crate::state::AppState;
use rstify_core::error::CoreError;

#[derive(Serialize)]
pub struct Setting {
    pub key: String,
    pub value: String,
}

#[derive(Deserialize)]
pub struct UpdateSetting {
    pub value: String,
}

pub async fn list_settings(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<Setting>>, ApiError> {
    auth.require_admin()?;
    let rows: Vec<(String, String)> = sqlx::query_as("SELECT key, value FROM settings")
        .fetch_all(&state.pool)
        .await
        .map_err(|e| ApiError::from(CoreError::Database(e.to_string())))?;
    let settings = rows.into_iter().map(|(key, value)| Setting { key, value }).collect();
    Ok(Json(settings))
}

pub async fn update_setting(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(key): Path<String>,
    Json(req): Json<UpdateSetting>,
) -> Result<Json<Setting>, ApiError> {
    auth.require_admin()?;
    sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
        .bind(&key)
        .bind(&req.value)
        .execute(&state.pool)
        .await
        .map_err(|e| ApiError::from(CoreError::Database(e.to_string())))?;

    // Update in-memory cache if it's the threshold
    if key == "inbox_priority_threshold" {
        if let Ok(v) = req.value.parse::<i32>() {
            state.inbox_threshold.store(v, std::sync::atomic::Ordering::Relaxed);
        }
    }

    Ok(Json(Setting { key, value: req.value }))
}
```

- [ ] **Step 3: Register routes**

In `crates/rstify-api/src/routes/mod.rs`, add:

```rust
pub mod settings;
```

And in the router, add:

```rust
        .route("/api/settings", get(settings::list_settings))
        .route("/api/settings/{key}", put(settings::update_setting))
```

- [ ] **Step 4: Verify compiles**

Run: `cargo check -p rstify-api`

- [ ] **Step 5: Commit**

```bash
git add crates/rstify-api/src/routes/settings.rs crates/rstify-api/src/routes/mod.rs crates/rstify-api/src/state.rs
git commit -m "feat(backend): add settings table routes and inbox threshold cache in AppState"
```

---

## Task 6: Update All Message Creation Paths

**Files:**
- Modify: `crates/rstify-api/src/routes/messages.rs`
- Modify: `crates/rstify-api/src/routes/topics.rs`
- Modify: `crates/rstify-api/src/routes/ntfy_publish.rs`
- Modify: `crates/rstify-api/src/routes/webhooks.rs`
- Modify: `crates/rstify-mqtt/src/ingest.rs`

Each path must: (1) determine the `inbox` flag, (2) pass it to `create()`, (3) use it for FCM decision.

- [ ] **Step 1: Update messages.rs (app publish)**

Find `create_app_message`. App messages always go to inbox. Add `true` as the last parameter to `message_repo.create(...)`:

```rust
            None, // source: API
            true, // inbox: app messages always go to inbox
```

- [ ] **Step 2: Update topics.rs (topic publish)**

Find `publish_to_topic`. Before the `create` call, evaluate the inbox flag:

```rust
    let threshold = state.inbox_threshold.load(std::sync::atomic::Ordering::Relaxed);
    let inbox = rstify_core::policy::should_inbox(&topic, req.priority.unwrap_or(5), threshold);
```

Pass `inbox` as the last parameter to `create(...)`.

Replace the FCM `should_notify` check with the inbox flag:

```rust
    // Send FCM push notifications (only for inbox messages)
    if req.scheduled_for.is_none() && inbox {
```

- [ ] **Step 3: Update ntfy_publish.rs**

Same pattern as topics.rs:

```rust
    let threshold = state.inbox_threshold.load(std::sync::atomic::Ordering::Relaxed);
    let inbox = rstify_core::policy::should_inbox(&topic, h.priority.unwrap_or(3), threshold);
```

Pass `inbox` to `create(...)`. Replace `should_notify` with `inbox` for FCM.

- [ ] **Step 4: Update webhooks.rs (receive_webhook)**

For topic-targeted webhooks, evaluate the policy. For app-targeted, inbox is true:

```rust
    let inbox = if config.target_topic_id.is_some() {
        // Load topic to check policy
        if let Some(topic_id) = config.target_topic_id {
            if let Ok(Some(topic)) = state.topic_repo.find_by_id(topic_id).await {
                let threshold = state.inbox_threshold.load(std::sync::atomic::Ordering::Relaxed);
                rstify_core::policy::should_inbox(&topic, priority, threshold)
            } else {
                true
            }
        } else {
            true
        }
    } else {
        true // app-targeted webhooks always go to inbox
    };
```

Pass `inbox` to `create(...)`.

- [ ] **Step 5: Update MQTT ingest**

In `crates/rstify-mqtt/src/ingest.rs`, the ingest doesn't have access to `AppState` or the threshold cache. Pass the threshold as a parameter to `run_mqtt_ingest`, or load it from the pool directly:

```rust
    let threshold: i32 = sqlx::query_scalar("SELECT CAST(value AS INTEGER) FROM settings WHERE key = 'inbox_priority_threshold'")
        .fetch_optional(&pool)
        .await
        .ok()
        .flatten()
        .unwrap_or(5);
    let inbox = rstify_core::policy::should_inbox(&topic, priority, threshold);
```

Pass `inbox` to `create(...)`.

- [ ] **Step 6: Update scheduled message delivery in main.rs**

Find where scheduled messages are delivered in `crates/rstify-server/src/main.rs`. The message is already created with the `inbox` flag — the scheduled delivery just needs to use `msg.inbox` for the FCM decision instead of `should_notify`.

- [ ] **Step 7: Verify compiles**

Run: `cargo check`

- [ ] **Step 8: Commit**

```bash
git add crates/rstify-api/src/routes/messages.rs crates/rstify-api/src/routes/topics.rs crates/rstify-api/src/routes/ntfy_publish.rs crates/rstify-api/src/routes/webhooks.rs crates/rstify-mqtt/src/ingest.rs crates/rstify-server/src/main.rs
git commit -m "feat(backend): evaluate inbox flag in all 5 message creation paths"
```

---

## Task 7: Filter WebSocket User Stream + Message List API

**Files:**
- Modify: `crates/rstify-api/src/routes/messages.rs`
- Modify: `crates/rstify-api/src/websocket/manager.rs` or the websocket stream handler

- [ ] **Step 1: Add `inbox` query param to list_messages**

Find `list_messages` in `messages.rs`. Add `inbox: Option<bool>` to the query parameters struct. Pass it through to `list_by_user_apps`.

- [ ] **Step 2: Filter WebSocket user stream**

Find the WebSocket handler that sends messages to user subscribers. Before sending, check `msg.inbox`:

```rust
    // Only send inbox messages on the user stream
    if !msg.inbox {
        continue;
    }
```

Note: The topic-specific WebSocket (`/api/topics/{name}/ws`) should NOT filter — it sends all messages.

- [ ] **Step 3: Verify compiles**

Run: `cargo check`

- [ ] **Step 4: Run fmt and clippy**

Run: `cargo fmt --all && cargo clippy --all-targets`

- [ ] **Step 5: Commit**

```bash
git add crates/rstify-api/src/routes/messages.rs crates/rstify-api/src/websocket/
git commit -m "feat(backend): filter message list and WebSocket user stream by inbox flag"
```

---

## Task 8: Update Web UI — Types, API Client, Pages

**Files:**
- Modify: `web-ui/src/api/types.ts`
- Modify: `web-ui/src/api/client.ts`
- Modify: `web-ui/src/pages/Messages.tsx`
- Modify: `web-ui/src/pages/Topics.tsx`
- Modify: `web-ui/src/pages/Settings.tsx`

- [ ] **Step 1: Update TypeScript types**

In `web-ui/src/api/types.ts`:

Add `inbox: boolean` to `MessageResponse`.

Add to `Topic`:
```typescript
inbox_override?: string | null;
inbox_priority_min?: number | null;
```

Add settings types:
```typescript
export interface Setting {
  key: string;
  value: string;
}
```

- [ ] **Step 2: Update API client**

In `web-ui/src/api/client.ts`:

Update `listMessages` to accept inbox filter:
```typescript
async listMessages(limit = 100, since = 0, inbox?: boolean): Promise<PagedMessages> {
  let url = `/message?limit=${limit}&since=${since}`;
  if (inbox !== undefined) url += `&inbox=${inbox}`;
  return this.request('GET', url);
}
```

Add settings methods:
```typescript
async listSettings(): Promise<Setting[]> {
  return this.request('GET', '/api/settings');
}
async updateSetting(key: string, value: string): Promise<Setting> {
  return this.request('PUT', `/api/settings/${key}`, { value });
}
```

- [ ] **Step 3: Update Messages page**

In `web-ui/src/pages/Messages.tsx`, update the message fetch to pass `inbox: true`:

```typescript
api.listMessages(fetchLimit.current, 0, true)
```

Optionally add a toggle to show all messages vs inbox only.

- [ ] **Step 4: Update Topics edit form**

In `web-ui/src/pages/Topics.tsx`, find the edit topic form. Add an "Inbox Routing" section:

```tsx
<div>
  <label className={labelClass}>Inbox Routing</label>
  <select value={form.inbox_override || ''} onChange={e => setForm(f => ({ ...f, inbox_override: e.target.value || null }))} className={inputClass}>
    <option value="">Auto (server default)</option>
    <option value="always">Always — all messages go to inbox</option>
    <option value="never">Never — channel only</option>
    <option value="threshold">Custom threshold</option>
  </select>
</div>
{form.inbox_override === 'threshold' && (
  <div>
    <label className={labelClass}>Minimum Priority for Inbox</label>
    <input type="number" min={1} max={10} value={form.inbox_priority_min ?? 5}
      onChange={e => setForm(f => ({ ...f, inbox_priority_min: parseInt(e.target.value) || 5 }))}
      className={inputClass} />
  </div>
)}
```

Include `inbox_override` and `inbox_priority_min` in the form state and submit.

- [ ] **Step 5: Add threshold setting to Settings page**

In `web-ui/src/pages/Settings.tsx` (or the admin Dashboard/Server page), add a section for the global threshold. Load via `api.listSettings()`, update via `api.updateSetting('inbox_priority_threshold', value)`.

- [ ] **Step 6: Verify build**

Run: `cd web-ui && npm run build`

- [ ] **Step 7: Commit**

```bash
git add web-ui/src/api/types.ts web-ui/src/api/client.ts web-ui/src/pages/Messages.tsx web-ui/src/pages/Topics.tsx web-ui/src/pages/Settings.tsx
git commit -m "feat(webui): add inbox routing controls — threshold setting, topic override, filtered messages"
```

---

## Task 9: Update Mobile App

**Files:**
- Modify: `client/src/api/types.ts`
- Modify: `client/src/api/client.ts`
- Modify: `client/src/store/messages.ts`
- Modify: `client/src/components/channels/EditTopicModal.tsx`
- Modify: `client/app/hub/server.tsx`

Note: Mobile files are in `.worktrees/mobile-overhaul/client/` but may also be on master depending on merge state. Adjust paths as needed.

- [ ] **Step 1: Update mobile TypeScript types**

Add `inbox: boolean` to `MessageResponse`.
Add `inbox_override?: string | null` and `inbox_priority_min?: number | null` to `Topic` and `UpdateTopic`.

- [ ] **Step 2: Update mobile API client**

Update `listMessages` to accept inbox filter:
```typescript
async listMessages(limit = 100, since = 0, inbox?: boolean): Promise<PagedMessages> {
  let url = `/message?limit=${limit}&since=${since}`;
  if (inbox !== undefined) url += `&inbox=${inbox}`;
  return this.request("GET", url);
}
```

- [ ] **Step 3: Update mobile message store**

In `fetchMessages`, pass `inbox: true`:
```typescript
const result = await api.listMessages(PAGE_SIZE, 0, true);
```

In `fetchOlderMessages`, same.

- [ ] **Step 4: Update EditTopicModal**

Add inbox override picker to the edit topic form. Use a simple picker or segmented control:
- Auto (default)
- Always
- Never
- Custom threshold (with number input)

- [ ] **Step 5: Add threshold setting to Server page**

In the admin Server Info page, add a setting for the global inbox priority threshold. Fetch from API, allow admin to update.

- [ ] **Step 6: Verify mobile compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 7: Commit**

```bash
git add client/src/api/types.ts client/src/api/client.ts client/src/store/messages.ts client/src/components/channels/EditTopicModal.tsx client/app/hub/server.tsx
git commit -m "feat(mobile): add inbox routing — filtered messages, topic override, threshold setting"
```

---

## Verification Checklist

After all tasks:

- [ ] `cargo fmt --all && cargo clippy --all-targets` — clean
- [ ] `cd web-ui && npm run build` — clean
- [ ] `npx tsc --noEmit` (mobile) — clean
- [ ] App messages always appear in Inbox
- [ ] Topic messages with priority >= threshold appear in Inbox
- [ ] Topic messages with priority < threshold appear only in Channel
- [ ] Topic with `inbox_override: "always"` sends all messages to Inbox
- [ ] Topic with `inbox_override: "never"` sends no messages to Inbox
- [ ] Topic with `inbox_override: "threshold"` + custom min uses that min
- [ ] FCM push notifications only fire for `inbox: true` messages
- [ ] WebSocket user stream only delivers `inbox: true` messages
- [ ] WebSocket topic stream delivers ALL messages (no filter)
- [ ] Global threshold changeable via admin settings
- [ ] Per-topic override editable in both web UI and mobile
- [ ] Existing messages all have `inbox: 1` (backwards compatible)
