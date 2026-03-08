# MQTT Integration Progress

## Phase 1: Core MQTT Infrastructure
- [x] TASK 1: Create rstify-mqtt crate skeleton — crate with Cargo.toml, config.rs (MqttConfig::from_env), auth/ingest/publish stubs, added to workspace
- [x] TASK 2: Build rumqttd broker configuration — MqttService with build_broker_config() and start(), v4 TCP + optional WS listeners, broker thread spawn
- [x] TASK 3: MQTT authentication via rstify client tokens — auth handler validates client tokens and JWT, set on all server configs
- [x] TASK 4: MQTT ingest — MQTT messages to rstify messages — ingest loop with 3-strategy payload parsing, topic auto-creation, WS broadcast, webhook firing, 4 unit tests
- [x] TASK 5: Message source tracking for anti-loop — source column on messages, updated trait/impl/all 5 callers (NULL=API, mqtt, ntfy, webhook)
- [x] TASK 6: MQTT publish — rstify messages to MQTT subscribers — publisher loop with anti-loop, topic mapping, Bytes conversion
- [x] TASK 7: Wire MQTT into server startup — added mqtt_enabled config, wired broker/ingest/publisher into main.rs

## Phase 2: Database & Notification Policies
- [x] TASK 8: Topic notification policy migration — 6 new columns, model/trait/impl/handler updated
- [x] TASK 9: Notification policy evaluation — should_notify/should_store in rstify-core with 10 unit tests
- [x] TASK 10: Wire notification policy into FCM push — added should_notify() check at topics, ntfy, and scheduled delivery
- [x] TASK 11: Wire store policy into MQTT ingest — in-memory tracking, WS always broadcasts, DB respects policy
- [x] TASK 12: MQTT bridges database table — migration, model, trait, and SQLite repo with CRUD

## Phase 3: Bridge Client & API
- [x] TASK 13: Dynamic bridge management in MQTT service — BridgeManager with rumqttc, start/stop, URL parsing, 4 tests
- [x] TASK 14: MQTT bridge API endpoints — CRUD routes, admin-only mutations, repo in AppState
- [x] TASK 15: MQTT status endpoint — GET /api/mqtt/status with broker state, connections, bridges
- [x] TASK 16: Topic update API for notification policies — validation for all policy fields in update handler

## Phase 4: Web UI
- [x] TASK 17: Web UI — Sidebar reorganization — grouped sections with headers
- [x] TASK 18: Web UI — MQTT Bridges page — CRUD with topic list management
- [x] TASK 19: Web UI — Dashboard MQTT status card — shows when MQTT enabled
- [x] TASK 20: Web UI — Topic edit notification policy section — collapsible policy controls
- [x] TASK 21: Web UI — Topic live message view — WebSocket live/history toggle
- [x] TASK 22: Web UI — Message source indicator — "via mqtt/ntfy/webhook" badges

## Phase 5: Mobile App
- [x] TASK 23: Mobile — TypeScript types and API client updates
- [x] TASK 24: Mobile — Topic edit with notification policies
- [x] TASK 25: Mobile — MQTT bridges in Settings
- [x] TASK 26: Mobile — Message source indicator
- [x] TASK 27: Mobile — Live topic message view

## Phase 6: Documentation & Testing
- [x] TASK 28: Integration test — MQTT publish and receive
- [x] TASK 29: MQTT documentation
- [x] TASK 30: Deployment configuration updates

## Phase 7: Final Audit
- [x] TASK 31: Final audit — MQTT-PLANNING.md parity check (all features, all UIs, all workflows)

## Blockers
(none)

## Final Audit

### Architecture & Data Flows
- [x] MQTT publish -> rstify message -> WS broadcast + webhooks + FCM (with policy) — ingest.rs
- [x] rstify message -> MQTT subscribers (with anti-loop) — publish.rs skips source=="mqtt"
- [x] External broker bridge subscribe (monitor mode) — bridge.rs with rumqttc
- [x] External broker bridge publish (control/bidirectional mode) — bridge.rs publish_topics
- [x] Topic name mapping (MQTT `/` <-> rstify `.`) in both directions — ingest.rs + publish.rs
- [x] MQTT payload parsing (3 strategies) — ingest.rs parse_mqtt_payload()
- [x] Authentication via client tokens and JWT — auth.rs

### Notification Policies
- [x] `always` policy (default, backwards compatible) — policy.rs
- [x] `never` policy (silent streaming) — policy.rs
- [x] `threshold` policy (priority min) — policy.rs
- [x] `on_change` policy (value comparison) — policy.rs
- [x] `digest` policy (time-based summary) — policy.rs
- [x] WebSocket streaming unaffected by notification policy — ingest.rs always broadcasts

### Storage Policies
- [x] `all` policy (default) — policy.rs
- [x] `interval` policy (store at most once per N seconds) — ingest.rs in-memory tracking
- [x] `on_change` policy (only store when value differs) — policy.rs

### Web UI Completeness
- [x] Sidebar grouped sections — Sidebar.tsx
- [x] Dashboard MQTT status card — Dashboard.tsx MqttStatusCard
- [x] MQTT Bridges page at /bridges with full CRUD — Bridges.tsx
- [x] Bridge modal: name, URL, credentials, QoS, prefix, sub/pub topics, auto-create, enabled
- [x] Bridge list: name, URL, status, topic counts, edit/delete
- [x] Topic edit: collapsible Notifications section with 5 policies — Topics.tsx
- [x] Topic edit: collapsible Storage section with 3 policies — Topics.tsx
- [x] Threshold shows priority min input — Topics.tsx
- [x] Digest shows interval input — Topics.tsx
- [x] Topic detail Live/History toggle — Topics.tsx
- [x] Live view streams via WebSocket — Topics.tsx
- [x] Messages show source indicator — Messages.tsx

### Mobile App Completeness
- [x] Topic edit: notification policy picker with conditional fields — topics.tsx
- [x] Topic edit: storage policy picker with conditional fields — topics.tsx
- [x] Settings: MQTT Bridges section (list + create + delete) — settings.tsx
- [x] Settings: MQTT Broker status section — settings.tsx
- [x] Message cards: source indicator — MessageCard.tsx
- [x] Topic detail: Live/History segment control — topics.tsx
- [x] Live view streams via WebSocket — LiveTopicView.tsx

### API Completeness
- [x] GET /api/mqtt/status — mqtt.rs mqtt_status
- [x] GET /api/mqtt/bridges — mqtt.rs list_bridges
- [x] POST /api/mqtt/bridges — mqtt.rs create_bridge
- [x] PUT /api/mqtt/bridges/{id} — mqtt.rs update_bridge
- [x] DELETE /api/mqtt/bridges/{id} — mqtt.rs delete_bridge
- [x] PUT /api/topics/{name} accepts policy fields — topics.rs update_topic

### Build Verification
- [x] cargo check — pass
- [x] cargo test --workspace — 44 tests pass
- [x] web-ui npm run build — pass
- [x] client npx tsc --noEmit — only pre-existing errors (unrelated to MQTT)
