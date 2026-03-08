# Ralph PRD: MQTT Integration for rstify

## Role

You are an expert full-stack Rust + React engineer implementing MQTT support for rstify — a self-hosted messaging platform with 100% Gotify API compatibility. You are adding a dual-role MQTT system: an embedded MQTT broker (devices connect directly to rstify) AND an MQTT bridge client (rstify connects to external brokers to monitor and control devices).

You have access to the Context7 MCP tool — use `resolve-library-id` then `query-docs` to look up current documentation for ANY library before implementing. Never guess at APIs — always verify with Context7 first. Key libraries to look up: `rumqttd`, `rumqttc`, `axum`, `sqlx`, `serde`, `react`, `tailwindcss`.

## Reference Documents

- `MQTT-PLANNING.md` — the comprehensive architecture and design document. Read it before starting. It contains ASCII diagrams, data flows, policy designs, UI mockups, and code sketches that inform every task below.

## Prerequisites

All previous phases (RALPH-PRD.md phases 1-5, RALPH-PRD-PHASE6.md phase 6, RALPH-PRD.md feature parity tasks 1-16) are complete. This builds on the fully working application.

## Instructions

1. Read this entire PRD before starting any work.
2. Read `MQTT-PLANNING.md` for full architectural context.
3. Check `RALPH-PROGRESS-MQTT.md` for what has already been completed. If it doesn't exist, create it.
4. Pick the **next uncompleted task** (ordered by number).
5. For each task:
   a. Use Context7 MCP (`resolve-library-id` then `query-docs`) to look up the latest API/docs for any library you will use. This is CRITICAL for `rumqttd` — the API may differ between versions.
   b. Implement the change following current best practices from the docs.
   c. Run the appropriate verification command (see each task's **Verify** section).
   d. Run `cargo test --workspace` if you changed Rust code.
   e. Mark the task complete in `RALPH-PROGRESS-MQTT.md` with a one-line summary of what was done.
   f. Commit the change with a descriptive message.
6. After completing a task, if you have capacity, continue to the next task.
7. When ALL tasks are complete, output: `<promise>MQTT INTEGRATION COMPLETE</promise>`
8. If you hit a blocker you cannot resolve, document it in `RALPH-PROGRESS-MQTT.md` under a `## Blockers` section and skip to the next task.

## Quality Standards

- All Rust code must pass `cargo fmt --check` and `cargo clippy --workspace -- -D warnings`.
- All TypeScript must pass `tsc --noEmit` (web-ui) or `npx tsc --noEmit` (client) with no errors.
- Do not add unnecessary dependencies. Prefer stdlib/existing deps.
- Do not break Gotify API compatibility.
- Do not break existing tests.
- Every new backend feature should have at least one unit test.
- Use `#[serde(skip_serializing_if = "Option::is_none")]` on all Option fields in response types.
- Commit after each completed task — do not batch multiple tasks into one commit.
- Run `cargo fmt` before committing any Rust changes.
- When adding new modules, follow the existing crate conventions (look at how existing modules are structured before creating new ones).
- When adding API routes, follow the existing pattern in `crates/rstify-api/src/routes/` — look at `topics.rs` or `webhooks.rs` for the handler pattern.
- When adding web UI pages, follow the existing pattern in `web-ui/src/pages/` — look at `Webhooks.tsx` for the CRUD page pattern.
- When modifying the mobile app, follow existing patterns in `client/app/(tabs)/` — look at `webhooks.tsx` for the list + CRUD pattern.

## Anti-Loop Protection

MQTT message loops are a critical risk. When rstify receives an MQTT message and creates a rstify message, which then gets published back to MQTT, it creates an infinite loop. Every message handler MUST tag messages with their source and skip re-publishing messages that originated from the same protocol. Use a `source` field or message metadata to track origin.

## Project Structure (Current)

```
crates/rstify-core/     — Models, traits, error types
crates/rstify-db/       — SQLite repository implementations
crates/rstify-api/      — Axum routes, middleware, extractors, FCM, WebSocket ConnectionManager
crates/rstify-server/   — Binary entry point, config, startup
crates/rstify-auth/     — JWT, token generation, ACL
crates/rstify-jobs/     — Background jobs (email, scheduled delivery, outgoing webhooks)
crates/rstify-cli/      — CLI client
web-ui/                 — React 19 + Vite + TailwindCSS web interface
client/                 — React Native (Expo SDK 55) mobile app
migrations/             — SQLite migration SQL files (currently 001-018)
```

## Key Existing Code References

These are the exact files and structures you'll integrate with:

- **AppState**: `crates/rstify-api/src/state.rs` — holds repos, pool, connections, fcm, metrics
- **ConnectionManager**: `crates/rstify-api/src/websocket/manager.rs` — `user_channels` and `topic_channels` (both `HashMap<_, broadcast::Sender<Arc<MessageResponse>>>`)
- **Server config**: `crates/rstify-server/src/config.rs` — `Config::from_env()` pattern
- **Server startup**: `crates/rstify-server/src/main.rs` — spawns JobRunner, builds router, serves Axum. MQTT service spawns AFTER job_runner but BEFORE axum::serve.
- **Router builder**: `crates/rstify-api/src/lib.rs` — `build_router()` merges api_routes, gotify_routes, ntfy_routes
- **Routes module**: `crates/rstify-api/src/routes/mod.rs` — declares route modules and route builder functions
- **Topic model**: `crates/rstify-core/src/models/topic.rs` — `Topic`, `CreateTopic`, `UpdateTopic`
- **Topic table**: `migrations/004_topics.sql` — base schema
- **FCM push location**: `crates/rstify-api/src/routes/topics.rs:327-333` — the `fcm.notify_user()` call to wrap with policy check
- **Workspace Cargo.toml**: root `Cargo.toml` — workspace members and shared dependencies
- **Web UI App.tsx**: `web-ui/src/App.tsx` — route definitions
- **Web UI Sidebar**: `web-ui/src/components/Sidebar.tsx` — flat `navItems` array
- **Web UI types**: `web-ui/src/api/types.ts` — TypeScript interfaces
- **Mobile types**: `client/src/api/types.ts`
- **Mobile API client**: `client/src/api/client.ts`

## Topic Name Mapping Convention

MQTT uses `/` as separator, rstify uses `.`:
- `sensors/temperature` (MQTT) <-> `sensors.temperature` (rstify)
- `home/living-room/lights` (MQTT) <-> `home.living-room.lights` (rstify)

This is a simple string replace: `topic.replace("/", ".")` for inbound, `topic.replace(".", "/")` for outbound.

---

## Phase 1: Core MQTT Infrastructure (Tasks 1-7)

### TASK 1: Create rstify-mqtt crate skeleton

**What:** Create the new `crates/rstify-mqtt/` crate with basic structure and add it to the workspace.

**How:**
- Create `crates/rstify-mqtt/Cargo.toml` with dependencies:
  ```toml
  [package]
  name = "rstify-mqtt"
  version.workspace = true
  edition.workspace = true

  [dependencies]
  rstify-core = { workspace = true }
  rstify-db = { workspace = true }
  rstify-auth = { workspace = true }
  rumqttd = { version = "0.20", features = ["websocket"] }
  tokio = { workspace = true }
  tracing = { workspace = true }
  serde = { workspace = true }
  serde_json = { workspace = true }
  sqlx = { workspace = true }
  anyhow = { workspace = true }
  ```
- Create `crates/rstify-mqtt/src/lib.rs` — exports `MqttService` and `MqttConfig`
- Create `crates/rstify-mqtt/src/config.rs` — `MqttConfig` struct with `from_env()`:
  ```rust
  pub struct MqttConfig {
      pub enabled: bool,              // MQTT_ENABLED (default: false)
      pub listen_addr: String,        // MQTT_LISTEN_ADDR (default: "0.0.0.0:1883")
      pub ws_listen_addr: Option<String>, // MQTT_WS_LISTEN_ADDR (optional)
      pub require_auth: bool,         // MQTT_REQUIRE_AUTH (default: true)
      pub max_payload_size: usize,    // MQTT_MAX_PAYLOAD (default: 20480)
      pub max_connections: usize,     // MQTT_MAX_CONNECTIONS (default: 1000)
  }
  ```
- Create empty module files: `auth.rs`, `ingest.rs`, `publish.rs`
- Add `"crates/rstify-mqtt"` to workspace members in root `Cargo.toml`
- Add `rstify-mqtt = { path = "crates/rstify-mqtt" }` to `[workspace.dependencies]`

**IMPORTANT:** Use Context7 to look up `rumqttd` v0.20 API first. The `Broker`, `Config`, `ServerSettings`, `BridgeConfig`, and `broker.link()` APIs may differ from the sketches in MQTT-PLANNING.md. Adapt all subsequent tasks to match the ACTUAL rumqttd API, not the planning doc's approximations.

**Verify:** `cargo check --workspace`

---

### TASK 2: Build rumqttd broker configuration

**What:** Implement `MqttConfig` → rumqttd `Config` conversion and broker startup in `lib.rs`.

**How:**
- In `config.rs`, implement `MqttConfig::from_env()` following the pattern in `crates/rstify-server/src/config.rs`
- In `lib.rs`, implement `MqttService::build_broker_config(config: &MqttConfig) -> rumqttd::Config`:
  - Create a v4 server entry listening on `config.listen_addr`
  - Set `max_payload_size`, `max_connections`, connection timeout
  - Optionally create a WebSocket server entry if `ws_listen_addr` is set
  - Set router config: `max_connections`, `max_segment_size: 104857600`, `max_segment_count: 10`
- Implement `MqttService::start()` that:
  - Builds the config
  - Creates `Broker::new(config)`
  - Calls `broker.link("rstify-internal")` to get `(link_tx, link_rx)`
  - Subscribes link_tx to `"#"` (all topics)
  - Spawns broker in `std::thread::spawn` (rumqttd uses its own runtime)
  - Returns `(link_tx, link_rx)` for use by ingest/publish tasks

**IMPORTANT:** Use Context7 to verify the exact rumqttd `Config` struct fields and `Broker` API. The config structure uses `HashMap<String, ServerSettings>` for v4/v5/ws sections. The broker thread should be spawned with proper error handling — log and return error if broker.start() fails.

**Verify:** `cargo check --workspace`

---

### TASK 3: MQTT authentication via rstify client tokens

**What:** Implement MQTT CONNECT authentication using rstify client tokens.

**How:**
- In `crates/rstify-mqtt/src/auth.rs`, implement the auth handler:
  - The MQTT username field carries the rstify client token (e.g., `C_xxxxxxxx`)
  - Look up the token using `SqliteClientRepo::find_by_token()`
  - Also accept JWT tokens as username (call `rstify_auth::tokens::validate_jwt()`)
  - Return `true` if either lookup succeeds, `false` otherwise
- In `lib.rs` `MqttService::start()`, set the auth handler on the server config:
  ```rust
  server.set_auth_handler(move |_client_id, username, _password| {
      // clone repos into the closure
      async move { authenticate(...).await }
  });
  ```
- Only set auth handler if `config.require_auth` is true

**IMPORTANT:** Use Context7 to verify `set_auth_handler` signature. The rumqttd example shows it takes `async fn(String, String, String) -> bool`. The auth closure must clone the repo Arc before moving into the async block. The `SqliteClientRepo` needs to be accessible — it will be passed from `AppState` when `MqttService::start()` is called.

**Verify:** `cargo check --workspace` + `cargo test --workspace`

---

### TASK 4: MQTT ingest — MQTT messages to rstify messages

**What:** Listen to all MQTT publishes via `link_rx` and create rstify messages.

**How:**
- In `crates/rstify-mqtt/src/ingest.rs`, implement `run_mqtt_ingest()`:
  - Receives: `link_rx`, `topic_repo`, `message_repo`, `connections` (ConnectionManager), `pool`
  - Loops on `link_rx.recv()`, handles `Notification::Forward(forward)`
  - Extracts MQTT topic (`forward.publish.topic`) and payload (`forward.publish.payload`)
  - Maps MQTT topic to rstify topic name: `mqtt_topic.replace("/", ".")`
  - Auto-creates the rstify topic if it doesn't exist (use `topic_repo.find_by_name()`, then `topic_repo.create()` if None)
  - Parses payload intelligently (3 strategies from MQTT-PLANNING.md):
    1. JSON with rstify fields (`title`, `message`, `priority`, `tags`) → extract fields
    2. Plain JSON → use as message body, derive title from topic name
    3. Plain text → use as message body directly
  - Creates rstify message via `message_repo.create()`
  - Broadcasts to WebSocket subscribers: `connections.broadcast_to_topic()`
  - Tags the message source as "mqtt" (add `source: Option<String>` to message creation or use extras) — this is critical for anti-loop protection
  - Fires outgoing webhooks (same pattern as `topics.rs` publish handler)

**IMPORTANT:** The `link_rx.recv()` is a blocking call from rumqttd. It returns `Result<Option<Notification>>`. Run this in a `tokio::task::spawn_blocking` or on a dedicated thread, then use a channel to forward to async code. Alternatively, check if rumqttd provides an async recv variant via Context7.

**Anti-loop:** Messages received from MQTT must NOT be re-published to MQTT (Task 6 handles the outbound direction — it must skip messages tagged as MQTT-origin).

**Verify:** `cargo check --workspace` + `cargo test --workspace`

---

### TASK 5: Message source tracking for anti-loop

**What:** Add a `source` field to message creation so MQTT-origin messages can be identified and not re-published back to MQTT.

**How:**
- Add migration `migrations/019_message_source.sql`:
  ```sql
  ALTER TABLE messages ADD COLUMN source TEXT;
  -- Values: NULL (HTTP/API), 'mqtt', 'webhook', 'ntfy', 'scheduled'
  ```
- Update `crates/rstify-core/src/models/message.rs`:
  - Add `pub source: Option<String>` to `MessageResponse` (with `#[serde(skip_serializing_if = "Option::is_none")]`)
- Update `crates/rstify-db/src/repositories/message.rs`:
  - Add `source` parameter to `create()` method
  - Include `source` in INSERT query and SELECT queries
- Update all existing callers of `message_repo.create()` to pass `source: None` (HTTP/API origin) or appropriate source:
  - `crates/rstify-api/src/routes/topics.rs` — `source: None`
  - `crates/rstify-api/src/routes/messages.rs` — `source: None`
  - `crates/rstify-api/src/routes/ntfy_publish.rs` — `source: Some("ntfy".to_string())`
  - `crates/rstify-api/src/routes/webhooks.rs` — `source: Some("webhook".to_string())`
  - `crates/rstify-jobs/src/scheduled.rs` — `source: Some("scheduled".to_string())`
  - `crates/rstify-mqtt/src/ingest.rs` — `source: Some("mqtt".to_string())`

**IMPORTANT:** Be thorough — search for ALL calls to `message_repo.create()` or `MessageRepository::create()` across the entire workspace. Missing one will cause a compile error. Use `Grep` to find all call sites before modifying the signature.

**Verify:** `cargo check --workspace` + `cargo test --workspace`

---

### TASK 6: MQTT publish — rstify messages to MQTT subscribers

**What:** Forward rstify topic messages to MQTT subscribers on the embedded broker.

**How:**
- In `crates/rstify-api/src/websocket/manager.rs`, add a global broadcast channel for cross-protocol forwarding:
  ```rust
  // Add to ConnectionManager struct:
  global_topic_tx: broadcast::Sender<Arc<MessageResponse>>,

  // Add method:
  pub fn subscribe_all_topics(&self) -> broadcast::Receiver<Arc<MessageResponse>> {
      self.global_topic_tx.subscribe()
  }
  ```
- Modify `broadcast_to_topic()` to also send to the global channel (so MQTT publisher picks it up)
- In `crates/rstify-mqtt/src/publish.rs`, implement `run_mqtt_publisher()`:
  - Subscribes to `connections.subscribe_all_topics()`
  - For each received message:
    - **Skip if `msg.source == Some("mqtt")`** — anti-loop protection
    - Convert topic name: `msg.topic.replace(".", "/")`
    - Serialize message to JSON payload
    - Call `link_tx.publish(mqtt_topic, payload)`
  - Spawn this as a tokio task

**IMPORTANT:** The `broadcast::Sender` for the global channel should be created in `ConnectionManager::new()` with adequate capacity (1024). The `link_tx.publish()` call may be blocking — check with Context7 whether rumqttd's `LinkTx` has an async publish or if it needs `spawn_blocking`.

**Verify:** `cargo check --workspace` + `cargo test --workspace`

---

### TASK 7: Wire MQTT into server startup

**What:** Start the MQTT service from main.rs when MQTT_ENABLED=true.

**How:**
- Add `rstify-mqtt` as a dependency of `rstify-server` in `crates/rstify-server/Cargo.toml`
- In `crates/rstify-server/src/config.rs`, add `pub mqtt_enabled: bool` field:
  ```rust
  mqtt_enabled: env::var("MQTT_ENABLED")
      .map(|v| v == "true" || v == "1")
      .unwrap_or(false),
  ```
- In `crates/rstify-server/src/main.rs`, after `job_runner.start().await;` and before the Axum serve block:
  ```rust
  if config.mqtt_enabled {
      let mqtt_config = rstify_mqtt::MqttConfig::from_env();
      let mqtt_state = state.clone();  // state must be cloned before move into router
      info!("Starting MQTT broker on {}", mqtt_config.listen_addr);
      tokio::spawn(async move {
          if let Err(e) = rstify_mqtt::MqttService::start(mqtt_config, mqtt_state).await {
              tracing::error!("MQTT service failed: {e}");
          }
      });
  }
  ```

**IMPORTANT:** The `state` used for MQTT must be cloned BEFORE the `state` is moved into `build_router()`. Currently `build_router(state, limiter)` takes ownership. You'll need to clone the relevant parts (repos, connections, pool, fcm, jwt_secret) before that call. Look at the existing code carefully — `state` is currently constructed, then moved into `build_router()` on line 120. The MQTT spawn must happen before that move, or the build_router signature must change to take a reference/clone.

**Verify:** `cargo check --workspace` + `MQTT_ENABLED=true cargo run` (should log MQTT broker starting, ctrl-c to stop)

---

## Phase 2: Database & Notification Policies (Tasks 8-12)

### TASK 8: Topic notification policy migration

**What:** Add notification and storage policy columns to the topics table.

**How:**
- Create `migrations/020_topic_notification_policy.sql` (number may differ — use the next available number):
  ```sql
  ALTER TABLE topics ADD COLUMN notify_policy TEXT NOT NULL DEFAULT 'always';
  ALTER TABLE topics ADD COLUMN notify_priority_min INTEGER DEFAULT 0;
  ALTER TABLE topics ADD COLUMN notify_condition TEXT;
  ALTER TABLE topics ADD COLUMN notify_digest_interval INTEGER;
  ALTER TABLE topics ADD COLUMN store_policy TEXT NOT NULL DEFAULT 'all';
  ALTER TABLE topics ADD COLUMN store_interval INTEGER;
  ```
- Update `crates/rstify-core/src/models/topic.rs`:
  - Add to `Topic` struct:
    ```rust
    pub notify_policy: String,                    // 'always', 'never', 'threshold', 'on_change', 'digest'
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notify_priority_min: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notify_condition: Option<String>,          // JSON string
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notify_digest_interval: Option<i32>,       // seconds
    pub store_policy: String,                      // 'all', 'on_change', 'interval'
    #[serde(skip_serializing_if = "Option::is_none")]
    pub store_interval: Option<i32>,               // seconds
    ```
  - Add to `UpdateTopic` struct:
    ```rust
    pub notify_policy: Option<String>,
    pub notify_priority_min: Option<i32>,
    pub notify_condition: Option<String>,
    pub notify_digest_interval: Option<i32>,
    pub store_policy: Option<String>,
    pub store_interval: Option<i32>,
    ```
- Update topic repository SELECT queries to include the new columns
- Update topic repository UPDATE query to handle the new fields

**IMPORTANT:** SQLite `ALTER TABLE ADD COLUMN` with `NOT NULL DEFAULT` works fine. Each ALTER must be a separate statement in the migration file.

**Verify:** `cargo check --workspace` + `cargo test --workspace`

---

### TASK 9: Notification policy evaluation

**What:** Implement the `should_notify()` function that evaluates per-topic notification policies.

**How:**
- Create `crates/rstify-mqtt/src/policy.rs` (or in rstify-core if it needs to be shared):
  ```rust
  pub fn should_notify(topic: &Topic, msg: &MessageResponse) -> bool
  pub fn should_store(topic: &Topic, last_stored: Option<&str>) -> bool
  ```
- `should_notify` logic (from MQTT-PLANNING.md):
  - `"always"` → true
  - `"never"` → false
  - `"threshold"` → check `msg.priority >= topic.notify_priority_min` OR evaluate JSON condition against message body
  - `"on_change"` → compare message body with previous message (needs last message lookup)
  - `"digest"` → check if enough time has passed since last notification (needs timestamp tracking)
- `should_store` logic:
  - `"all"` → true
  - `"interval"` → check elapsed time since last stored message
  - `"on_change"` → compare with previous stored value
- For `on_change` and `digest`, these need state. Add a simple in-memory cache (`HashMap<i64, LastState>`) keyed by topic_id, or query the DB. Start simple — DB query for last message is fine for v1.
- Add unit tests for each policy type

**Verify:** `cargo check --workspace` + `cargo test --workspace`

---

### TASK 10: Wire notification policy into FCM push

**What:** Replace the unconditional FCM push in topic publish handlers with policy-aware push.

**How:**
- In `crates/rstify-api/src/routes/topics.rs`, around line 327-333, wrap the FCM push:
  ```rust
  // Before (current):
  if let Some(ref fcm) = state.fcm {
      if let Some(owner_id) = topic.owner_id {
          tokio::spawn(async move { fcm.notify_user(...).await; });
      }
  }

  // After:
  if let Some(ref fcm) = state.fcm {
      if let Some(owner_id) = topic.owner_id {
          if rstify_mqtt::policy::should_notify(&topic, &response) {
              tokio::spawn(async move { fcm.notify_user(...).await; });
          }
      }
  }
  ```
- Apply the same pattern to:
  - `crates/rstify-api/src/routes/messages.rs` (if it has FCM push)
  - `crates/rstify-api/src/routes/ntfy_publish.rs` (if it has FCM push)
  - `crates/rstify-api/src/routes/webhooks.rs` (if it has FCM push)
  - The scheduled delivery broadcast in `main.rs` (lines 90-98)
- Move `should_notify` to `rstify-core` (not rstify-mqtt) since it's needed by rstify-api too, OR make rstify-api depend on rstify-mqtt. Choose whichever avoids circular dependencies — putting it in rstify-core is cleaner.

**IMPORTANT:** Search ALL locations where `fcm.notify_user` is called. Use `Grep` for `notify_user` across the workspace.

**Verify:** `cargo check --workspace` + `cargo test --workspace`

---

### TASK 11: Wire store policy into MQTT ingest

**What:** Apply the store policy when ingesting MQTT messages to prevent database bloat from high-frequency telemetry.

**How:**
- In `crates/rstify-mqtt/src/ingest.rs`, before calling `message_repo.create()`:
  ```rust
  // Check store policy
  if !should_store(&topic, last_stored_time) {
      // Still broadcast to WebSocket (live view needs every message)
      connections.broadcast_to_topic(&topic_name, temp_response).await;
      continue; // Skip DB storage
  }
  ```
- The key insight: **WebSocket streaming always gets every message** (for live dashboards). Only DB storage and FCM push respect policies.
- For the `should_store` check, query the last message timestamp for the topic from the DB, or maintain an in-memory `HashMap<i64, Instant>` cache (more efficient for high-frequency topics).

**Verify:** `cargo check --workspace` + `cargo test --workspace`

---

### TASK 12: MQTT bridges database table

**What:** Create the database table for storing external broker bridge configurations.

**How:**
- Create migration (next number after task 8's migration):
  ```sql
  CREATE TABLE IF NOT EXISTS mqtt_bridges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      remote_url TEXT NOT NULL,
      subscribe_topics TEXT NOT NULL DEFAULT '[]',
      publish_topics TEXT DEFAULT '[]',
      username TEXT,
      password TEXT,
      qos INTEGER DEFAULT 0,
      topic_prefix TEXT,
      auto_create_topics BOOLEAN DEFAULT TRUE,
      enabled BOOLEAN DEFAULT TRUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  ```
- Create `crates/rstify-core/src/models/mqtt_bridge.rs`:
  ```rust
  pub struct MqttBridge { id, user_id, name, remote_url, subscribe_topics (String/JSON), publish_topics, username, password, qos, topic_prefix, auto_create_topics, enabled, created_at }
  pub struct CreateMqttBridge { name, remote_url, subscribe_topics (Vec<String>), publish_topics, username, password, qos, topic_prefix, auto_create_topics }
  pub struct UpdateMqttBridge { ... all optional fields ... }
  ```
- Add `pub mod mqtt_bridge;` to `crates/rstify-core/src/models/mod.rs`
- Create `crates/rstify-db/src/repositories/mqtt_bridge.rs` with CRUD operations:
  - `create()`, `find_by_id()`, `list_by_user()`, `list_enabled()`, `update()`, `delete()`
  - JSON arrays stored as TEXT — use `serde_json::to_string()` for insert, `serde_json::from_str()` for read
- Add repository to `mod.rs`
- Create the repository trait in `crates/rstify-core/src/repositories/` if the project uses traits (check existing pattern)

**Verify:** `cargo check --workspace` + `cargo test --workspace`

---

## Phase 3: Bridge Client & API (Tasks 13-16)

### TASK 13: Dynamic bridge management in MQTT service

**What:** Start/stop bridges dynamically based on the `mqtt_bridges` table.

**How:**
- In `crates/rstify-mqtt/src/lib.rs`, add bridge management to `MqttService`:
  - On startup, load all enabled bridges from DB (`mqtt_bridge_repo.list_enabled()`)
  - For each bridge, construct a rumqttd `BridgeConfig` with the remote URL, subscribe topics, credentials
  - **IMPORTANT:** rumqttd's built-in `BridgeConfig` may only support a single bridge in the config. Use Context7 to verify. If rumqttd only supports one bridge in config:
    - **Alternative approach:** Use `rumqttc` (the client library) to create separate MQTT client connections to each external broker
    - Add `rumqttc` as a dependency if needed
    - Each bridge gets its own `AsyncClient` connecting to the remote broker
    - Subscribe to the configured topics on the remote broker
    - Forward received messages through the ingest pipeline
    - For publish direction: listen to rstify topic broadcasts and publish matching topics to the remote broker
  - Store active bridge handles in a `HashMap<i64, JoinHandle>` for later stop/restart
- Implement `add_bridge()` and `remove_bridge()` methods for dynamic management (called from API handlers)

**IMPORTANT:** This is the most complex task. Use Context7 to research both `rumqttd` bridge capabilities AND `rumqttc` async client API before choosing an approach. The cleanest solution depends on what rumqttd actually supports for multiple bridges.

**Verify:** `cargo check --workspace`

---

### TASK 14: MQTT bridge API endpoints

**What:** Add REST API endpoints for bridge CRUD.

**How:**
- Create `crates/rstify-api/src/routes/mqtt.rs` with handlers:
  - `GET /api/mqtt/status` → broker status (enabled, listen_addr, connections count)
  - `GET /api/mqtt/bridges` → list user's bridges
  - `POST /api/mqtt/bridges` → create bridge (admin only)
  - `PUT /api/mqtt/bridges/{id}` → update bridge
  - `DELETE /api/mqtt/bridges/{id}` → delete bridge
- Add `pub mod mqtt;` to `crates/rstify-api/src/routes/mod.rs`
- Wire routes into the router in `crates/rstify-api/src/lib.rs`
- Add `MqttBridgeRepo` to `AppState` (or use the pool directly)
- Follow the existing route patterns — look at `webhooks.rs` for CRUD handler structure
- All bridge endpoints require authentication. Create/update/delete require admin.

**Verify:** `cargo check --workspace`

---

### TASK 15: MQTT status endpoint

**What:** Implement the `/api/mqtt/status` endpoint that returns broker health info.

**How:**
- The status response should include:
  ```rust
  pub struct MqttStatusResponse {
      pub enabled: bool,
      pub listen_addr: Option<String>,
      pub ws_listen_addr: Option<String>,
      pub connections: usize,         // from ConnectionManager or rumqttd metrics
      pub bridges_active: usize,      // count of connected bridges
      pub messages_per_min: u64,      // rolling counter
  }
  ```
- For connection count: if rumqttd exposes metrics, use those. Otherwise, track connections in the auth handler (increment on connect) or use a simple AtomicUsize counter.
- For messages_per_min: maintain a rolling counter in the ingest task (increment per message, decay every minute).
- Store the status in a shared `Arc<RwLock<MqttStatus>>` that the ingest/publish tasks update and the API handler reads.

**Verify:** `cargo check --workspace`

---

### TASK 16: Topic update API for notification policies

**What:** Extend the existing `PUT /api/topics/{name}` endpoint to accept notification and storage policy fields.

**How:**
- The `UpdateTopic` struct (from Task 8) already has the new fields
- Update the topic update handler in `crates/rstify-api/src/routes/topics.rs` to handle the new fields
- Validate policy values:
  - `notify_policy` must be one of: `always`, `never`, `threshold`, `on_change`, `digest`
  - `store_policy` must be one of: `all`, `on_change`, `interval`
  - `notify_condition` must be valid JSON if provided (parse with `serde_json::from_str`)
  - `notify_digest_interval` must be positive if provided
  - `store_interval` must be positive if provided
- Update the topic repository's update query to include the new columns

**Verify:** `cargo check --workspace` + `cargo test --workspace`

---

## Phase 4: Web UI (Tasks 17-22)

### TASK 17: Web UI — Sidebar reorganization

**What:** Reorganize the flat sidebar into grouped sections.

**How:**
- In `web-ui/src/components/Sidebar.tsx`, replace the flat `navItems` array with a grouped structure:
  ```typescript
  const navSections = [
    {
      items: [
        { to: '/', label: 'Dashboard' },
        { to: '/messages', label: 'Messages' },
      ],
    },
    {
      label: 'Manage',
      items: [
        { to: '/topics', label: 'Topics' },
        { to: '/applications', label: 'Applications' },
        { to: '/clients', label: 'Clients' },
      ],
    },
    {
      label: 'Integrations',
      items: [
        { to: '/webhooks', label: 'Webhooks' },
        { to: '/bridges', label: 'MQTT Bridges' },
      ],
    },
    {
      label: 'Admin',
      admin: true,
      items: [
        { to: '/users', label: 'Users', admin: true },
        { to: '/permissions', label: 'Permissions', admin: true },
        { to: '/settings', label: 'Settings' },
      ],
    },
  ];
  ```
- Render section headers as small uppercase `text-xs text-gray-500 uppercase tracking-wider px-4 pt-4 pb-1` labels
- Admin sections hidden for non-admin users (same as current behavior)
- Keep the existing NavLink styling

**Verify:** `cd web-ui && npm run build`

---

### TASK 18: Web UI — MQTT Bridges page

**What:** Create a new Bridges page for managing MQTT bridge connections.

**How:**
- Create `web-ui/src/pages/Bridges.tsx` — follow the pattern of `Webhooks.tsx`:
  - List all bridges in a table: Name, Broker URL, Status, Subscribe Topics, Publish Topics, Actions
  - "New Bridge" button opens a create modal
  - Edit/Delete actions per row
  - Create modal fields: name, remote_url, username, password, qos (select: 0/1/2), topic_prefix, subscribe_topics (dynamic list with add/remove), publish_topics (dynamic list), auto_create_topics (checkbox), enabled (checkbox)
- Add TypeScript types to `web-ui/src/api/types.ts`:
  ```typescript
  export interface MqttBridge {
    id: number;
    user_id: number;
    name: string;
    remote_url: string;
    subscribe_topics: string[];
    publish_topics: string[];
    username?: string;
    qos: number;
    topic_prefix?: string;
    auto_create_topics: boolean;
    enabled: boolean;
    created_at: string;
  }
  export interface CreateMqttBridge { ... }
  export interface UpdateMqttBridge { ... }
  export interface MqttStatus {
    enabled: boolean;
    listen_addr?: string;
    ws_listen_addr?: string;
    connections: number;
    bridges_active: number;
    messages_per_min: number;
  }
  ```
- Add API methods to `web-ui/src/api/client.ts`:
  - `listBridges()`, `createBridge()`, `updateBridge()`, `deleteBridge()`, `getMqttStatus()`
- Add route to `web-ui/src/App.tsx`: `<Route path="/bridges" element={<Bridges />} />`
- Import Bridges component

**Verify:** `cd web-ui && npm run build`

---

### TASK 19: Web UI — Dashboard MQTT status card

**What:** Add an MQTT broker status card to the Dashboard.

**How:**
- In `web-ui/src/pages/Dashboard.tsx`, add a new card below the server info card:
  - Only shows if MQTT is enabled (call `getMqttStatus()`, hide card if `enabled: false`)
  - Displays: status indicator (green dot), listen address, connection count, active bridges count, messages/min
  - Use the same card styling as the existing ServerInfo component
  - Handle loading/error states gracefully (MQTT might not be configured)

**Verify:** `cd web-ui && npm run build`

---

### TASK 20: Web UI — Topic edit notification policy section

**What:** Add notification and storage policy controls to the topic edit modal.

**How:**
- In `web-ui/src/pages/Topics.tsx`, enhance the edit topic modal:
  - Add a collapsible "Notifications" section (collapsed by default):
    - Radio group for policy: Always, Never, Threshold, On Change, Digest
    - Conditional fields based on selection:
      - Threshold: min priority input, JSON condition builder (field, operator, value)
      - Digest: interval input (minutes, converted to seconds for API)
  - Add a collapsible "Storage" section:
    - Radio group: All, Interval, On Change
    - Interval: seconds input
  - Include new fields in the update API call
- Consider extracting the policy form into `web-ui/src/components/NotificationPolicyForm.tsx` if the component gets large (but only if truly beneficial — don't over-abstract)

**Verify:** `cd web-ui && npm run build`

---

### TASK 21: Web UI — Topic live message view

**What:** Add a live-updating message stream view for topics.

**How:**
- In the topic message viewer (the modal/panel that shows when clicking "Messages" on a topic):
  - Add a "Live" / "History" toggle at the top
  - **History** tab: existing paginated message list (no changes)
  - **Live** tab: connects to the topic's WebSocket stream and shows messages as they arrive
    - Use the existing WebSocket infrastructure (`/stream` endpoint or topic-specific stream)
    - Auto-scroll to newest message (with toggle to disable)
    - Show timestamp and message content
    - Limit displayed messages to last 100 (drop oldest from DOM)
  - Add a summary bar showing latest values if the messages are JSON (parse and show key-value pairs)
- This is valuable for MQTT telemetry topics but works for all topics

**Verify:** `cd web-ui && npm run build`

---

### TASK 22: Web UI — Message source indicator

**What:** Show where a message came from (API, MQTT, webhook, ntfy) in the message list.

**How:**
- In `web-ui/src/pages/Messages.tsx` and `web-ui/src/components/MessageContent.tsx`:
  - If `message.source` is present, show a small tag/badge: "via MQTT", "via ntfy", "via webhook"
  - Use muted styling: `text-xs text-gray-400` pill badge
  - Position near the timestamp
- Update the `MessageResponse` TypeScript type to include `source?: string`

**Verify:** `cd web-ui && npm run build`

---

## Phase 5: Mobile App (Tasks 23-27)

### TASK 23: Mobile — TypeScript types and API client updates

**What:** Add MQTT-related types and API methods to the mobile app.

**How:**
- Update `client/src/api/types.ts`:
  - Add `source?: string` to `MessageResponse`
  - Add `MqttBridge`, `CreateMqttBridge`, `UpdateMqttBridge`, `MqttStatus` interfaces (matching web-ui types)
  - Add notification policy fields to `Topic` interface:
    ```typescript
    notify_policy?: string;
    notify_priority_min?: number;
    notify_condition?: string;
    notify_digest_interval?: number;
    store_policy?: string;
    store_interval?: number;
    ```
- Update `client/src/api/client.ts`:
  - Add `getMqttStatus()`, `listBridges()`, `createBridge()`, `updateBridge()`, `deleteBridge()`
  - Update `updateTopic()` to accept notification/storage policy fields

**Verify:** `cd client && npx tsc --noEmit`

---

### TASK 24: Mobile — Topic edit with notification policies

**What:** Add notification and storage policy controls to the mobile topic edit screen.

**How:**
- In `client/app/(tabs)/topics.tsx`, enhance the edit topic modal:
  - Add a "Notifications" section with:
    - Picker/dropdown for policy: Always, Never, Threshold, On Change, Digest
    - Conditional inputs based on selection (same logic as web UI)
  - Add a "Storage" section:
    - Picker for policy: All, Interval, On Change
    - Interval input when applicable
  - Include in the `updateTopic()` API call

**Verify:** `cd client && npx tsc --noEmit`

---

### TASK 25: Mobile — MQTT bridges in Settings

**What:** Add MQTT bridge management to the mobile Settings screen (admin section).

**How:**
- In `client/app/(tabs)/settings.tsx`:
  - Add a collapsible "MQTT Bridges" section in the admin area
  - Show list of bridges with name, URL, status indicator, subscribe/publish topic counts
  - [+] button to create a new bridge (modal with name, URL, credentials, topics)
  - Long-press to edit/delete
  - Add a collapsed "MQTT Broker" section showing broker status (if enabled)
- Follow the existing pattern of the "Client Tokens" or "Permissions" sections in settings

**Verify:** `cd client && npx tsc --noEmit`

---

### TASK 26: Mobile — Message source indicator

**What:** Show message source tags in the mobile message list.

**How:**
- In `client/src/components/MessageCard.tsx`:
  - If `message.source` is present, show a small badge: "via MQTT", "via ntfy", etc.
  - Position near the timestamp, use muted styling
  - Keep it subtle — don't overwhelm the card layout

**Verify:** `cd client && npx tsc --noEmit`

---

### TASK 27: Mobile — Live topic message view

**What:** Add a live-updating message view for topics on mobile.

**How:**
- Create `client/src/components/LiveTopicView.tsx`:
  - Connects to WebSocket stream for a specific topic
  - Shows messages as they arrive in a FlatList
  - Auto-scroll to bottom (with toggle)
  - Limit to last 50 messages in memory
- In `client/app/(tabs)/topics.tsx`, when viewing a topic's messages:
  - Add a "Live" / "History" segment control
  - History: existing paginated list
  - Live: render `LiveTopicView`

**Verify:** `cd client && npx tsc --noEmit`

---

## Phase 6: Documentation & Testing (Tasks 28-30)

### TASK 28: Integration test — MQTT publish and receive

**What:** Write an integration test that starts the MQTT broker and verifies message flow.

**How:**
- In `crates/rstify-mqtt/tests/` (or `src/lib.rs` as `#[cfg(test)]`):
  - Start a broker with `MqttConfig { enabled: true, require_auth: false, ... }`
  - Use `rumqttc` (add as dev-dependency) to connect as a test client
  - Publish a message to topic `test/hello`
  - Verify the ingest pipeline creates a rstify message (mock or in-memory repo)
  - Verify the message is received by a `link_rx` subscriber
- Test anti-loop: publish a message via the rstify API side and verify it appears on the MQTT side but does NOT loop back

**Verify:** `cargo test --workspace`

---

### TASK 29: MQTT documentation in USER_GUIDE.md

**What:** Add MQTT usage documentation.

**How:**
- Add an "MQTT Integration" section to `USER_GUIDE.md` (or create `MQTT_GUIDE.md` if USER_GUIDE.md doesn't exist):
  - **Getting Started**: env vars to enable MQTT (`MQTT_ENABLED=true`, `MQTT_LISTEN_ADDR`, etc.)
  - **Direct Connection**: how devices connect to rstify's MQTT broker with client tokens
  - **External Bridges**: how to configure bridges to external brokers
  - **Notification Policies**: how to set up per-topic notification and storage policies
  - **Topic Mapping**: how MQTT topic separators map to rstify topic names
  - **Examples**: mosquitto_pub/sub commands, Home Assistant config snippet, Node-RED example
  - **Deployment**: Caddy/nginx config for MQTT-over-WebSocket (`/mqtt` path)

**Verify:** File exists and is well-structured markdown

---

### TASK 30: Deployment configuration updates

**What:** Update deployment configs for MQTT support.

**How:**
- Update `deploy/docker-compose.yml` (if it exists) or deployment docs:
  - Add MQTT port mapping: `1883:1883`
  - Add MQTT WebSocket port if separate: `8083:8083`
  - Add env vars: `MQTT_ENABLED`, `MQTT_LISTEN_ADDR`, `MQTT_WS_LISTEN_ADDR`, `MQTT_REQUIRE_AUTH`
- Update `.env.example` (if it exists) with MQTT env vars
- Document reverse proxy configuration for MQTT-over-WebSocket for all three common proxies:

  **Caddy:**
  ```
  reverse_proxy /mqtt localhost:8083
  ```

  **Nginx:**
  ```nginx
  location /mqtt {
      proxy_pass http://127.0.0.1:8083;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_set_header Host $host;
      proxy_read_timeout 86400;
  }
  ```

  **Traefik (docker labels):**
  ```yaml
  labels:
    - "traefik.http.routers.rstify-mqtt.rule=Host(`rstify.example.com`) && PathPrefix(`/mqtt`)"
    - "traefik.http.routers.rstify-mqtt.entrypoints=websecure"
    - "traefik.http.routers.rstify-mqtt.tls.certresolver=letsencrypt"
    - "traefik.http.services.rstify-mqtt.loadbalancer.server.port=8083"
  ```

  **Traefik (file provider / traefik.yml):**
  ```yaml
  http:
    routers:
      rstify-mqtt:
        rule: "Host(`rstify.example.com`) && PathPrefix(`/mqtt`)"
        service: rstify-mqtt
        entryPoints:
          - websecure
        tls:
          certResolver: letsencrypt
    services:
      rstify-mqtt:
        loadBalancer:
          servers:
            - url: "http://127.0.0.1:8083"
  ```

**Verify:** Config files are valid

---

### TASK 31: Final audit — MQTT-PLANNING.md parity check

**What:** Audit that every feature described in `MQTT-PLANNING.md` is fully implemented and accessible in the appropriate UI (web, mobile, or both).

**How:**
- Read `MQTT-PLANNING.md` end-to-end
- For EACH feature/capability described, verify it exists in the code:

  **Architecture & Data Flows:**
  - [ ] MQTT publish -> rstify message -> WS broadcast + webhooks + FCM (with policy)
  - [ ] rstify message -> MQTT subscribers (with anti-loop)
  - [ ] External broker bridge subscribe (monitor mode)
  - [ ] External broker bridge publish (control/bidirectional mode)
  - [ ] Topic name mapping (MQTT `/` <-> rstify `.`) in both directions
  - [ ] MQTT payload parsing (3 strategies: rstify JSON fields, plain JSON, plain text)
  - [ ] Authentication via client tokens and JWT

  **Notification Policies:**
  - [ ] `always` policy works (default, backwards compatible)
  - [ ] `never` policy works (silent streaming)
  - [ ] `threshold` policy works (priority min + JSON condition evaluation)
  - [ ] `on_change` policy works (value comparison)
  - [ ] `digest` policy works (time-based summary)
  - [ ] WebSocket streaming is ALWAYS unaffected by notification policy (live view works regardless)

  **Storage Policies:**
  - [ ] `all` policy works (default)
  - [ ] `interval` policy works (store at most once per N seconds)
  - [ ] `on_change` policy works (only store when value differs)

  **Web UI Completeness:**
  - [ ] Sidebar has grouped sections (Dashboard/Messages, Manage, Integrations, Admin)
  - [ ] Dashboard shows MQTT broker status card (when enabled)
  - [ ] MQTT Bridges page exists at `/bridges` with full CRUD
  - [ ] Bridge create/edit modal has: name, URL, credentials, QoS, prefix, subscribe topics (dynamic list), publish topics (dynamic list), auto-create toggle, enabled toggle
  - [ ] Bridge list shows: name, URL, status indicator, topic counts, edit/delete actions
  - [ ] Topic edit modal has collapsible "Notifications" section with all 5 policy types
  - [ ] Topic edit modal has collapsible "Storage" section with all 3 policy types
  - [ ] Threshold policy shows conditional inputs (priority min, JSON field/operator/value)
  - [ ] Digest policy shows interval input
  - [ ] Topic detail has Live/History toggle for message viewing
  - [ ] Live view streams via WebSocket with auto-scroll
  - [ ] Messages show source indicator ("via MQTT", "via ntfy", etc.)

  **Mobile App Completeness:**
  - [ ] Topic edit includes notification policy picker with conditional fields
  - [ ] Topic edit includes storage policy picker with conditional fields
  - [ ] Settings (admin) has "MQTT Bridges" section with list + create + edit + delete
  - [ ] Settings (admin) has "MQTT Broker" status section
  - [ ] Message cards show source indicator
  - [ ] Topic detail has Live/History segment control
  - [ ] Live view streams messages via WebSocket

  **API Completeness:**
  - [ ] `GET /api/mqtt/status` returns broker health
  - [ ] `GET /api/mqtt/bridges` lists bridges
  - [ ] `POST /api/mqtt/bridges` creates bridge
  - [ ] `PUT /api/mqtt/bridges/{id}` updates bridge
  - [ ] `DELETE /api/mqtt/bridges/{id}` deletes bridge
  - [ ] `PUT /api/topics/{name}` accepts all notification + storage policy fields

  **User Workflow Verification (from MQTT-PLANNING.md):**
  - [ ] "Monitor home sensors" flow: create bridge -> auto-create topics -> set threshold policy -> live view
  - [ ] "Control smart lights" flow: add publish topics to bridge -> publish from topic detail -> message reaches external broker
  - [ ] "Direct device alerts" flow: device connects to rstify MQTT broker with client token -> publishes -> notification fires

- For any gaps found: implement the missing feature, then re-verify
- Document the audit results in `RALPH-PROGRESS-MQTT.md` under a `## Final Audit` section listing each item as pass/fail/fixed

**Verify:** All checklist items pass. All builds pass: `cargo check`, `cd web-ui && npm run build`, `cd client && npx tsc --noEmit`

---

## Context7 Usage Reminder

Before implementing ANY task involving an external library, use Context7 MCP:

```
1. resolve-library-id("rumqttd")
2. query-docs(<library-id>, "Broker::new Config BridgeConfig link")
```

Critical lookups:
- **rumqttd** — `Broker`, `Config`, `ServerSettings`, `BridgeConfig`, `broker.link()`, `set_auth_handler()`
- **rumqttc** — `AsyncClient`, `MqttOptions`, `EventLoop` (if needed for bridges)
- **axum** — route patterns, extractors
- **sqlx** — query macros, migration patterns
- **react** — hooks, state management
- **tailwindcss** — utility classes

---

## Completion Criteria

All 31 tasks implemented, tested, and committed. `RALPH-PROGRESS-MQTT.md` shows all tasks marked complete (including Task 31 final audit with all checklist items passing). All builds pass:

```bash
cargo fmt --check
cargo clippy --workspace -- -D warnings
cargo test --workspace
cd web-ui && npm run build
cd client && npx tsc --noEmit
```

Output: `<promise>MQTT INTEGRATION COMPLETE</promise>`
