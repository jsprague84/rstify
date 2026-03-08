# MQTT Integration Planning Document

## Executive Summary

Add MQTT capability to rstify as a dual-role system:
1. **Embedded MQTT Broker** — devices subscribe/publish directly to rstify
2. **MQTT Client Bridge** — rstify connects to external brokers as a subscriber, monitoring topics without interfering with existing broker/device setups

Both roles use `rumqttd` (v0.20, embedded broker with built-in bridge support) as the single dependency. No need for separate client library — rumqttd's `BridgeConfig` handles outbound connections to external brokers natively.

## Architecture Overview

```
                    rstify server
┌───────────────────────────────────────────────────────┐
│                                                       │
│   ┌─────────────┐    ┌──────────────────────────────┐ │
│   │  Axum HTTP  │    │  rumqttd Embedded Broker     │ │
│   │  :8080      │    │  :1883 (TCP) / /mqtt (WS)    │ │
│   │             │    │                              │ │
│   │  REST API   │    │  ┌────────────────────────┐  │ │
│   │  WebSocket  │    │  │ Bridge Client (outbound)│  │ │
│   │  ntfy compat│    │  │ → mosquitto:1883       │  │ │
│   │             │    │  │ → hivemq:8883          │  │ │
│   └──────┬──────┘    │  └────────────────────────┘  │ │
│          │           └──────────────┬───────────────┘ │
│          │                          │                 │
│          ▼                          ▼                 │
│   ┌──────────────────────────────────────────────┐   │
│   │           ConnectionManager                   │   │
│   │   broadcast::Sender<Arc<MessageResponse>>     │   │
│   │   user_channels: HashMap<i64, Sender>         │   │
│   │   topic_channels: HashMap<String, Sender>     │   │
│   └──────────────────────┬───────────────────────┘   │
│                          │                            │
│   ┌──────────────────────┴───────────────────────┐   │
│   │           MessageRepository                   │   │
│   │   SQLite: messages, topics, attachments       │   │
│   └──────────────────────────────────────────────┘   │
│                                                       │
│   ┌──────────────────────────────────────────────┐   │
│   │           JobRunner                           │   │
│   │   - Outgoing webhooks                         │   │
│   │   - FCM push notifications                    │   │
│   │   - Scheduled delivery                        │   │
│   │   - Attachment cleanup                        │   │
│   └──────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────┘
         ▲              ▲                    ▲
         │              │                    │
    Web/Mobile     IoT Devices        External Brokers
    (HTTP/WS)      (MQTT direct)      (bridge subscribe)
```

## Why rumqttd (Not rumqttc + Separate Broker)

After reviewing the rumqttd source code and examples:

1. **`rumqttd` already has a built-in bridge client** (`BridgeConfig`) — it can connect to external brokers and subscribe to their topics. No need for `rumqttc` as a separate dependency.

2. **`broker.link("client_id")` API** — creates an in-process pub/sub link. This is the bridge between rstify's `ConnectionManager` and the MQTT broker. No network overhead for internal message passing.

3. **`server.set_auth_handler(async fn(client_id, username, password) -> bool)`** — custom auth callback. We hook this to validate rstify client tokens.

4. **Single binary** — rumqttd embeds directly into the rstify binary. No separate process.

5. **Built-in WebSocket support** — `[ws.1]` config section. Can share the same port via path routing or use a dedicated port.

## Data Flow: MQTT Publish → rstify Message

```
IoT Device                   rumqttd broker              rstify internals
─────────                    ──────────────              ────────────────
MQTT PUBLISH
  topic: "sensors/temp"  ──► Router receives  ──►  link_rx.recv()
  payload: "22.5°C"          and distributes        (rstify-mqtt listener)
                             to subscribers              │
                                                         ▼
                                                   Parse MQTT payload
                                                   Map topic → rstify topic
                                                   (auto-create if needed)
                                                         │
                                                         ▼
                                                   message_repo.create(
                                                     topic_id, user_id,
                                                     title, message, priority
                                                   )
                                                         │
                                              ┌──────────┴──────────┐
                                              ▼                     ▼
                                        connections          tokio::spawn
                                        .broadcast_to_       - webhooks
                                         topic()             - FCM push
                                              │
                                              ▼
                                        WebSocket clients
                                        Web UI / Mobile
```

## Data Flow: rstify Message → MQTT Subscribers

```
HTTP POST /api/topics/sensors.temp/publish
        │
        ▼
  message_repo.create()
        │
        ├──► connections.broadcast_to_topic()  → WebSocket clients
        │
        └──► link_tx.publish(                  → MQTT subscribers
               "sensors/temp",                    (IoT devices,
                payload_json                       dashboards, etc.)
             )
```

## Data Flow: External Broker Bridge (Monitor Mode)

```
External Mosquitto (:1883)           rumqttd bridge            rstify
──────────────────────               ──────────────            ──────

Device publishes to                  Bridge subscribes
  "home/temperature"  ──────────►    to "home/#"  ──────►  link_rx.recv()
                                     (configured in             │
                                      mqtt_bridges table)       ▼
                                                          message_repo.create()
                                                          topic: "home/temperature"
                                                                │
                                                                ▼
                                                          Normal rstify pipeline:
                                                          WS broadcast, webhooks,
                                                          FCM push, storage
```

Key: **rstify connects as a normal MQTT client** — subscribing to monitor, publishing to control. The external broker and its devices continue operating normally. rstify is just another client on the broker.

## Data Flow: Control Devices via External Broker (Publish Mode)

```
User (Web/Mobile/API/CLI)            rstify                    External Broker
─────────────────────────            ──────                    ───────────────

POST /api/topics/                    Detect topic matches      Bridge publishes
  home.lights.living/publish  ──►    a bridge publish_topic    to remote broker
  {"message": "{\"state\":\"ON\"}"}       │                         │
                                          ▼                         ▼
                                     link_tx.publish(          home/lights/living
                                       "home/lights/living",   payload: {"state":"ON"}
                                       payload                      │
                                     )                              ▼
                                                               Smart bulb receives
                                                               command, turns ON
```

This means from rstify you can:
- **Monitor**: subscribe to `home/#` → see all sensor data in rstify
- **Control**: publish to `home/lights/living` → toggle a smart bulb
- **Automate**: webhooks fire on incoming MQTT → trigger outgoing MQTT publish (or HTTP)

The bridge is fully bidirectional per-topic:
```sql
INSERT INTO mqtt_bridges (name, remote_url, subscribe_topics, publish_topics)
VALUES (
  'home-mosquitto',
  'mqtt://192.168.1.50:1883',
  '["home/sensors/#", "home/status/#"]',    -- monitor these
  '["home/lights/#", "home/hvac/#"]'         -- control these
);
```

## Topic Notification Policies

### The Problem

A temperature sensor publishing every second generates 86,400 messages/day. Storing and streaming those is fine — that's telemetry. But pushing 86,400 phone notifications is insane.

The current code unconditionally fires FCM push for every message:

```rust
// topics.rs:324 — always pushes to topic owner
if let Some(ref fcm) = state.fcm {
    if let Some(owner_id) = topic.owner_id {
        tokio::spawn(async move { fcm.notify_user(...).await; });
    }
}
```

### The Solution: Per-Topic Notification Policy

Add notification settings to the topics table. These control **what happens after a message is created**, not whether the message is stored or streamed.

#### Migration: `019_topic_notification_policy.sql`

```sql
ALTER TABLE topics ADD COLUMN notify_policy TEXT NOT NULL DEFAULT 'always';
-- Values: 'always', 'never', 'threshold', 'on_change', 'digest'

ALTER TABLE topics ADD COLUMN notify_priority_min INTEGER DEFAULT 0;
-- Only notify if message priority >= this value (used with 'threshold')

ALTER TABLE topics ADD COLUMN notify_condition TEXT;
-- JSON condition for smart notifications (used with 'threshold')
-- e.g. {"field": "temperature", "operator": ">", "value": 40}

ALTER TABLE topics ADD COLUMN notify_digest_interval INTEGER;
-- Seconds between digest notifications (used with 'digest')
-- e.g. 3600 = one summary notification per hour

ALTER TABLE topics ADD COLUMN store_policy TEXT NOT NULL DEFAULT 'all';
-- Values: 'all', 'on_change', 'interval'
-- Controls whether every message is stored or only changes

ALTER TABLE topics ADD COLUMN store_interval INTEGER;
-- Minimum seconds between stored messages (used with 'interval')
-- e.g. 60 = store at most one message per minute, drop the rest
```

#### How Each Policy Works

| Policy | FCM Push | WebSocket Stream | Storage | Use Case |
|---|---|---|---|---|
| `always` (default) | Every message | Every message | Every message | Normal topics, alerts |
| `never` | Never | Every message | Every message | High-frequency telemetry, dashboards |
| `threshold` | Only when condition met | Every message | Every message | Alert on temp > 40°C |
| `on_change` | Only when value changes | Every message | Only changes | Binary sensors (door open/closed) |
| `digest` | Summary every N seconds | Every message | Every message | Hourly summary of sensor readings |

#### Examples

```
Temperature sensor (updates every second):
  notify_policy: "threshold"
  notify_condition: {"field": "temperature", "operator": ">", "value": 40}
  store_policy: "interval"
  store_interval: 60
  → Streams all readings live to dashboard
  → Stores one reading per minute (saves 98% disk space)
  → Only buzzes your phone when temperature exceeds 40°C

Door sensor (updates on open/close):
  notify_policy: "on_change"
  store_policy: "on_change"
  → Only notifies and stores when state actually changes
  → No duplicate "door is closed" messages

Server monitoring (updates every 5 seconds):
  notify_policy: "never"
  store_policy: "all"
  → Dashboard shows live data
  → Full history stored for graphing
  → Phone never buzzes (you watch the dashboard when you want to)

Daily backup status:
  notify_policy: "always"
  store_policy: "all"
  → Every message triggers a phone notification
  → Normal behavior, same as current rstify
```

#### Implementation in Message Handlers

The FCM push block in `topics.rs` and `messages.rs` gets wrapped with a policy check:

```rust
// Replace unconditional FCM push with policy-aware push
if req.scheduled_for.is_none() {
    if let Some(ref fcm) = state.fcm {
        if should_notify(&topic, &response) {
            // ... existing FCM spawn
        }
    }
}

fn should_notify(topic: &Topic, msg: &MessageResponse) -> bool {
    match topic.notify_policy.as_str() {
        "never" => false,
        "always" => true,
        "threshold" => {
            // Check priority threshold
            if msg.priority >= topic.notify_priority_min {
                return true;
            }
            // Check JSON condition if set
            if let Some(ref condition) = topic.notify_condition {
                return evaluate_condition(condition, &msg.message);
            }
            false
        }
        "on_change" => {
            // Compare with last stored message for this topic
            // Only notify if payload differs
            has_value_changed(topic, msg)
        }
        "digest" => {
            // Check if enough time has passed since last notification
            // If so, send a summary
            should_send_digest(topic)
        }
        _ => true, // default: always notify
    }
}
```

#### Store Policy in MQTT Ingest

For high-frequency MQTT telemetry, the store policy prevents database bloat:

```rust
// In rstify-mqtt/src/ingest.rs
fn should_store(topic: &Topic, last_stored: Option<&DateTime>) -> bool {
    match topic.store_policy.as_str() {
        "all" => true,
        "interval" => {
            // Only store if enough time has passed
            match (last_stored, topic.store_interval) {
                (Some(last), Some(interval)) => {
                    last.elapsed() >= Duration::from_secs(interval as u64)
                }
                _ => true,
            }
        }
        "on_change" => true, // checked against previous value at call site
        _ => true,
    }
}
```

#### API for Managing Policies

Update the existing topic endpoints:

```
PUT /api/topics/{name}
{
  "notify_policy": "threshold",
  "notify_priority_min": 8,
  "notify_condition": {"field": "temperature", "operator": ">", "value": 40},
  "store_policy": "interval",
  "store_interval": 60
}
```

#### Web UI Addition

In the Topics page, add a "Notification Settings" section when editing a topic:

```
┌─────────────────────────────────────────────┐
│  Edit Topic: home.sensors.temperature       │
│                                             │
│  Description: [Living room temp sensor   ]  │
│                                             │
│  Notification Policy:  [Threshold ▼]        │
│  Notify when priority ≥  [8         ]       │
│  Condition: temp > [40] °C                  │
│                                             │
│  Storage Policy:  [Every 60 seconds ▼]      │
│                                             │
│  [Cancel]                     [Save]        │
└─────────────────────────────────────────────┘
```

#### Mobile App

The live message stream (WebSocket) is unaffected — the dashboard always shows real-time data. Only the phone notification (FCM push) respects the policy. So you get:

- **Open app** → see live temperature readings updating every second
- **Close app** → phone is silent unless temperature exceeds 40°C
- **History view** → one data point per minute (not 86,400/day)

### Why Per-Topic (Not Per-Bridge or Per-User)

- **Per-bridge** is too coarse — you might want alerts from `home/smoke-detector` but not from `home/temperature` on the same broker
- **Per-user** is too complex — notification preferences belong to the data source, not the consumer
- **Per-topic** is the natural boundary — each sensor/device maps to a topic, and each topic has its own notification behavior

This also works for non-MQTT topics. A webhook delivering GitHub CI results every push could use `notify_policy: "threshold"` with `notify_priority_min: 8` to only buzz on failures.

---

## UI Organization

### Design Principles

1. **MQTT is not a separate product** — it's another way messages flow through rstify, alongside HTTP, WebSocket, webhooks, and ntfy. The UI should reflect this.
2. **Don't add tabs/pages for the sake of features** — integrate into existing flows where it makes sense, only add new pages for genuinely new concepts.
3. **Notification policies belong to Topics** — not a separate page. Policies are a property of the topic, like permissions.
4. **MQTT Bridges are a new concept** — they need their own page, but grouped logically with other integrations.

### What's New vs What Extends Existing

| Feature | UI Treatment |
|---|---|
| MQTT broker status | Extend **Dashboard** — new card |
| Topic notification policy | Extend **Topic edit modal** — new section |
| Topic storage policy | Extend **Topic edit modal** — new section |
| MQTT bridges (external brokers) | New page: **Bridges** |
| Live telemetry view | Extend **Topic detail view** — enhanced message list |
| Bridge management (mobile) | New section in **Settings** (admin) |

---

### Web UI: Sidebar Reorganization

Current sidebar is a flat list of 9 items. With MQTT, it needs logical grouping. Reorganize into sections:

```
┌─────────────────────────┐
│  🔲 rstify              │
├─────────────────────────┤
│                         │
│  Dashboard              │
│  Messages               │
│                         │
│  MANAGE                 │
│  Topics                 │
│  Applications           │
│  Clients                │
│                         │
│  INTEGRATIONS           │
│  Webhooks               │
│  MQTT Bridges           │  ← NEW
│                         │
│  ADMIN                  │
│  Users                  │
│  Permissions            │
│  Settings               │
│                         │
├─────────────────────────┤
│  jsprague (admin)       │
└─────────────────────────┘
```

The section headers ("MANAGE", "INTEGRATIONS", "ADMIN") are small uppercase labels — not clickable, just visual grouping. This scales cleanly if more integrations are added later.

#### Sidebar Implementation

```typescript
const navSections = [
  {
    items: [
      { to: '/', label: 'Dashboard', icon: 'LayoutDashboard' },
      { to: '/messages', label: 'Messages', icon: 'MessageSquare' },
    ],
  },
  {
    label: 'Manage',
    items: [
      { to: '/topics', label: 'Topics', icon: 'Radio' },
      { to: '/applications', label: 'Applications', icon: 'Box' },
      { to: '/clients', label: 'Clients', icon: 'Key' },
    ],
  },
  {
    label: 'Integrations',
    items: [
      { to: '/webhooks', label: 'Webhooks', icon: 'Webhook' },
      { to: '/bridges', label: 'MQTT Bridges', icon: 'Network' },
    ],
  },
  {
    label: 'Admin',
    admin: true,
    items: [
      { to: '/users', label: 'Users', icon: 'Users' },
      { to: '/permissions', label: 'Permissions', icon: 'Shield' },
      { to: '/settings', label: 'Settings', icon: 'Settings' },
    ],
  },
];
```

---

### Web UI: Page-by-Page Design

#### 1. Dashboard (Enhanced)

Add an MQTT status card alongside the existing health/stats cards:

```
┌─────────────────────────────────────────────────────────────┐
│  Dashboard                                                  │
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ Users    │ │ Topics   │ │ Messages │ │ Msgs 24h │       │
│  │    12    │ │    8     │ │   4,521  │ │   342    │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Server                                              │   │
│  │  ● Healthy   DB: ok   v0.8.0   Built: 2026-03-07   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ MQTT Broker                                         │   │
│  │  ● Running   Port: 1883   Connections: 14           │   │
│  │  Bridges: 2 active   Messages/min: 847              │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

Only shows if MQTT is enabled. Uses `GET /api/mqtt/status`.

#### 2. Topics Page (Enhanced Edit Modal)

The existing topic list table stays the same. The **edit modal** gets a new "Notifications" tab/section:

```
┌─────────────────────────────────────────────────────────────┐
│  Edit Topic: home.sensors.temperature                       │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ General                                              │   │
│  │                                                      │   │
│  │  Description  [Living room temp sensor            ]  │   │
│  │  Public Read  [✓]     Public Write  [ ]              │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Notifications                                        │   │
│  │                                                      │   │
│  │  Push Notification Policy:                           │   │
│  │  ○ Always — notify on every message                  │   │
│  │  ○ Never — silent, stream only                       │   │
│  │  ● Threshold — notify when condition met             │   │
│  │  ○ On Change — notify when value changes             │   │
│  │  ○ Digest — summarize every [___] minutes            │   │
│  │                                                      │   │
│  │  ┌─ Threshold Condition ───────────────────────┐     │   │
│  │  │  Min Priority: [8    ]  (0-10)              │     │   │
│  │  │  — OR —                                     │     │   │
│  │  │  JSON Field: [temperature]                  │     │   │
│  │  │  Operator:   [> ▼]                          │     │   │
│  │  │  Value:      [40  ]                         │     │   │
│  │  └─────────────────────────────────────────────┘     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Storage                                              │   │
│  │                                                      │   │
│  │  Storage Policy:                                     │   │
│  │  ● All — store every message                         │   │
│  │  ○ Interval — store at most once every [60] seconds  │   │
│  │  ○ On Change — store only when value differs         │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│                              [Cancel]        [Save]         │
└─────────────────────────────────────────────────────────────┘
```

The notification/storage sections are **collapsible** — collapsed by default for simple topics, expandable for IoT topics. This keeps the modal clean for users who don't need these features.

#### 3. Topics Page: Live View Enhancement

When clicking "Messages" on a topic, the current modal shows a static list. For MQTT telemetry topics, enhance this with a live-updating view:

```
┌─────────────────────────────────────────────────────────────┐
│  home.sensors.temperature — Messages              [✕]       │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  ● Live   ○ History          Auto-scroll [✓]         │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  12:04:32  {"temperature": 22.4, "humidity": 64}     │   │
│  │  12:04:31  {"temperature": 22.4, "humidity": 64}     │   │
│  │  12:04:30  {"temperature": 22.3, "humidity": 65}     │   │
│  │  12:04:29  {"temperature": 22.3, "humidity": 65}     │   │
│  │  12:04:28  {"temperature": 22.2, "humidity": 65}     │   │
│  │  ... streaming via WebSocket ...                     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Latest:  22.4°C   64% humidity                      │   │
│  │  Min/Max: 21.8°C — 23.1°C (last hour)                │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

- **Live tab**: connects to topic WebSocket, shows real-time messages
- **History tab**: paginated stored messages (existing behavior)
- **Summary bar**: extracts numeric values from JSON payloads for at-a-glance reading

#### 4. MQTT Bridges Page (New)

New page at `/bridges`. Similar layout to Webhooks page:

```
┌─────────────────────────────────────────────────────────────┐
│  MQTT Bridges                              [+ New Bridge]   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Name       │ Broker URL              │ Status │       │   │
│  ├────────────┼─────────────────────────┼────────┼───────┤   │
│  │ Home MQTT  │ mqtt://192.168.1.50:1883│ ● Live │ Edit  │   │
│  │ Office     │ mqtts://office.local:8883│ ● Live │ Edit  │   │
│  │ AWS IoT    │ mqtts://xxx.iot.aws:8883│ ○ Down │ Edit  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌ Home MQTT — Details (expanded) ─────────────────────┐   │
│  │                                                      │   │
│  │  Subscribe (Monitor):                                │   │
│  │    home/sensors/#          → home.sensors.*          │   │
│  │    home/status/#           → home.status.*           │   │
│  │                                                      │   │
│  │  Publish (Control):                                  │   │
│  │    home/lights/#           ← home.lights.*           │   │
│  │    home/hvac/#             ← home.hvac.*             │   │
│  │                                                      │   │
│  │  Stats: 847 msgs/min in · 12 msgs/min out            │   │
│  │  Connected since: 2h 34m ago                         │   │
│  │                                                      │   │
│  │              [Edit]  [Disable]  [Delete]              │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Create/Edit Bridge Modal:**

```
┌─────────────────────────────────────────────────────────────┐
│  New MQTT Bridge                                            │
│                                                             │
│  Name:         [Home Mosquitto                          ]   │
│  Broker URL:   [mqtt://192.168.1.50:1883                ]   │
│  Username:     [homeassistant                           ]   │
│  Password:     [••••••••                                ]   │
│  QoS:          [0 ▼]                                        │
│                                                             │
│  Topic Prefix: [mqtt.        ]  (prepended to rstify names) │
│                                                             │
│  ┌─ Subscribe (Monitor) ──────────────────────────────┐     │
│  │  [home/sensors/#                              ] [✕] │     │
│  │  [home/status/#                               ] [✕] │     │
│  │  [+ Add subscription]                               │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                             │
│  ┌─ Publish (Control) ────────────────────────────────┐     │
│  │  [home/lights/#                               ] [✕] │     │
│  │  [home/hvac/#                                 ] [✕] │     │
│  │  [+ Add publish topic]                              │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                             │
│  ☑ Auto-create rstify topics for new MQTT topics            │
│  ☑ Enabled                                                  │
│                                                             │
│                              [Cancel]        [Save]         │
└─────────────────────────────────────────────────────────────┘
```

---

### Mobile App: Navigation Strategy

The mobile app currently has 5 tabs. Adding a 6th tab is possible but starts to feel crowded. The better approach: **MQTT Bridges go into Settings** (admin section), and **notification policies integrate into Topics**.

#### Current tabs (unchanged):
```
[ Messages ] [ Topics ] [ Apps ] [ Webhooks ] [ Settings ]
```

No new tabs needed. Here's where MQTT features live:

#### Topics Tab: Enhanced Detail View

When you tap a topic, the detail view gets new sections:

```
┌──────────────────────────────────────────┐
│  ← home.sensors.temperature        ✏️ ✉️ │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ ● Live   ○ History                 │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ 22.4°C  ·  64% humidity           │  │  ← Latest value card
│  │ ▼21.8  ▲23.1 (1h)                 │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ 12:04:32  temp:22.4 hum:64        │  │
│  │ 12:04:31  temp:22.4 hum:64        │  │  ← Live streaming
│  │ 12:04:30  temp:22.3 hum:65        │  │     messages
│  │ 12:04:29  temp:22.3 hum:65        │  │
│  │ ...                               │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

The ✏️ (edit) button opens the topic edit modal, which now includes notification settings:

```
┌──────────────────────────────────────────┐
│  Edit Topic                              │
│                                          │
│  Description                             │
│  [Living room temp sensor            ]   │
│                                          │
│  Public Read              [═══●]         │
│  Public Write             [●═══]         │
│                                          │
│  ─── Notifications ──────────────────    │
│                                          │
│  Push Policy         [Threshold  ▼]      │
│                                          │
│  Notify when priority ≥  [8     ]        │
│  — OR —                                  │
│  Field [temperature]  [>]  Value [40]    │
│                                          │
│  ─── Storage ────────────────────────    │
│                                          │
│  Store Policy        [Interval   ▼]      │
│  Store every         [60    ] seconds    │
│                                          │
│          [Cancel]        [Save]          │
└──────────────────────────────────────────┘
```

#### Settings Tab: MQTT Bridges Section (Admin)

In the admin area of Settings, add a collapsible "MQTT Bridges" section:

```
┌──────────────────────────────────────────┐
│  Settings                                │
│                                          │
│  [Appearance]                            │
│  [Account]                               │
│  [Server]                                │
│  [Client Tokens]                         │
│  [Push Notifications]                    │
│                                          │
│  ▼ MQTT Bridges (2)                 [+]  │  ← Admin only
│  ┌────────────────────────────────────┐  │
│  │ 🟢 Home MQTT                      │  │
│  │    mqtt://192.168.1.50:1883       │  │
│  │    ↓ home/sensors/#, home/status/#│  │
│  │    ↑ home/lights/#, home/hvac/#   │  │
│  │    847 msgs/min                   │  │
│  ├────────────────────────────────────┤  │
│  │ 🟢 Office                         │  │
│  │    mqtts://office.local:8883      │  │
│  │    ↓ office/#                     │  │
│  │    23 msgs/min                    │  │
│  └────────────────────────────────────┘  │
│  Long-press to edit or delete            │
│                                          │
│  ▶ MQTT Broker                           │  ← Collapsed
│                                          │
│  ▼ User Management (3)                   │
│  ...                                     │
│                                          │
│  [Logout]                                │
└──────────────────────────────────────────┘
```

Tapping [+] opens a create bridge modal. Long-press opens edit/delete options. The "MQTT Broker" section shows broker status (port, connections, uptime).

#### Messages Tab: Source Indicator

Messages from MQTT bridges get a visual indicator:

```
┌────────────────────────────────────────┐
│  ┃ 🌡️ Temperature Alert          [🗑] │  ← icon from topic
│  ┃ home.sensors.temperature            │
│  ┃                                     │
│  ┃ Temperature is 42.3°C              │
│  ┃                                     │
│  ┃ 12:04:32 · via MQTT              │  ← source tag
│  ┃                    [🏷 alert]       │
└────────────────────────────────────────┘
```

The "via MQTT" tag helps users understand where the message originated. The existing source filter (All/App/Topic) works unchanged — MQTT messages come through topics.

---

### Web UI: New Files

```
web-ui/src/pages/
├── Bridges.tsx            ← NEW: MQTT bridges list + CRUD
└── (existing pages enhanced, not new files)

web-ui/src/components/
├── LiveMessageView.tsx    ← NEW: WebSocket-powered live message stream
└── NotificationPolicyForm.tsx  ← NEW: reusable form for topic notification settings
```

### Mobile App: New Files

```
client/src/components/
├── LiveTopicView.tsx      ← NEW: live streaming message view for topic detail
├── NotificationPolicy.tsx ← NEW: notification policy form component
└── BridgeCard.tsx         ← NEW: bridge display card for settings
```

No new tab files — everything integrates into existing screens.

---

### API Additions for UI

```
GET    /api/mqtt/status           → { enabled, port, connections, bridges_active, messages_per_min }
GET    /api/mqtt/bridges          → [{ id, name, remote_url, subscribe_topics, publish_topics, status, ... }]
POST   /api/mqtt/bridges          → create bridge
PUT    /api/mqtt/bridges/{id}     → update bridge
DELETE /api/mqtt/bridges/{id}     → delete bridge

PUT    /api/topics/{name}         → (enhanced: now accepts notify_policy, store_policy fields)
```

### TypeScript Types

```typescript
// Add to web-ui/src/api/types.ts and client/src/api/types.ts

interface Topic {
  // ... existing fields ...
  notify_policy: 'always' | 'never' | 'threshold' | 'on_change' | 'digest';
  notify_priority_min: number | null;
  notify_condition: NotifyCondition | null;
  notify_digest_interval: number | null;
  store_policy: 'all' | 'on_change' | 'interval';
  store_interval: number | null;
}

interface NotifyCondition {
  field: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  value: number | string;
}

interface MqttBridge {
  id: number;
  name: string;
  remote_url: string;
  subscribe_topics: string[];
  publish_topics: string[];
  username: string | null;
  qos: number;
  topic_prefix: string | null;
  enabled: boolean;
  status?: 'connected' | 'disconnected' | 'error';
  messages_per_min?: number;
  created_at: string;
}

interface MqttStatus {
  enabled: boolean;
  listen_addr: string | null;
  connections: number;
  bridges_active: number;
  messages_per_min: number;
}
```

---

### User Workflow Examples

#### "I want to monitor my home sensors"

1. Go to **MQTT Bridges** → **New Bridge**
2. Enter Mosquitto URL, credentials, subscribe to `home/#`
3. Topics auto-created: `home.sensors.temperature`, `home.sensors.humidity`, etc.
4. Go to **Topics** → tap `home.sensors.temperature` → **Edit**
5. Set notification policy: **Threshold** → temp > 40°C
6. Set storage policy: **Interval** → every 60 seconds
7. Go back to topic detail → switch to **Live** → see real-time readings

#### "I want to control my smart lights"

1. In the bridge config, add `home/lights/#` to **Publish** topics
2. Go to **Topics** → tap `home.lights.living` → **Send**
3. Type `{"state": "ON"}` → Publish
4. Message flows: rstify → bridge → Mosquitto → smart bulb

#### "I want an IoT device to push alerts directly to rstify"

1. No bridge needed — device connects directly to rstify's MQTT broker
2. Configure device: broker = `rstify.js-node.cc`, port 1883, username = client token
3. Device publishes to `alerts/smoke` → message appears in rstify
4. Topic `alerts.smoke` has notify_policy: `always` → phone buzzes immediately

---

## Implementation Plan

### New Crate: `crates/rstify-mqtt/`

```
crates/rstify-mqtt/
├── Cargo.toml
└── src/
    ├── lib.rs           # MqttService: start broker + bridges
    ├── config.rs        # MqttConfig from env vars / config
    ├── auth.rs          # Validate client tokens for MQTT CONNECT
    ├── ingest.rs        # link_rx listener: MQTT → rstify messages
    └── publish.rs       # rstify messages → MQTT link_tx.publish()
```

### Dependencies (Cargo.toml)

```toml
[dependencies]
rumqttd = { version = "0.20", features = ["websocket"] }
rstify-core = { path = "../rstify-core" }
rstify-db = { path = "../rstify-db" }
rstify-auth = { path = "../rstify-auth" }
tokio = { workspace = true }
tracing = { workspace = true }
serde = { workspace = true }
serde_json = { workspace = true }
sqlx = { workspace = true }
```

### Key Components

#### 1. `config.rs` — Configuration

Follows existing pattern of `Config::from_env()`:

```rust
pub struct MqttConfig {
    pub enabled: bool,              // MQTT_ENABLED (default: false)
    pub listen_addr: String,        // MQTT_LISTEN_ADDR (default: "0.0.0.0:1883")
    pub ws_listen_addr: Option<String>, // MQTT_WS_LISTEN_ADDR (optional, e.g. "0.0.0.0:8083")
    pub require_auth: bool,         // MQTT_REQUIRE_AUTH (default: true)
    pub max_payload_size: usize,    // MQTT_MAX_PAYLOAD (default: 20480)
    pub max_connections: usize,     // MQTT_MAX_CONNECTIONS (default: 1000)
}
```

#### 2. `auth.rs` — Authentication Hook

```rust
// Called by rumqttd for every MQTT CONNECT
// client_id: MQTT client identifier
// username: rstify client token (or JWT)
// password: unused (or secondary validation)
pub async fn authenticate(
    client_id: String,
    username: String,
    _password: String,
    client_repo: SqliteClientRepo,
    jwt_secret: String,
) -> bool {
    // Try client token first
    if client_repo.find_by_token(&username).await.is_ok() {
        return true;
    }
    // Try JWT
    if rstify_auth::tokens::validate_jwt(&username, &jwt_secret).is_ok() {
        return true;
    }
    false
}
```

#### 3. `ingest.rs` — MQTT → rstify Messages

```rust
// Runs in background, receives ALL messages published to the embedded broker
pub async fn run_mqtt_ingest(
    link_rx: LinkRx,
    topic_repo: SqliteTopicRepo,
    message_repo: SqliteMessageRepo,
    connections: Arc<ConnectionManager>,
    pool: SqlitePool,
) {
    loop {
        match link_rx.recv() {
            Ok(Some(Notification::Forward(forward))) => {
                let mqtt_topic = forward.publish.topic; // e.g. "sensors/temp"
                let payload = forward.publish.payload;

                // Map MQTT topic separator (/) to rstify topic name
                let topic_name = mqtt_topic.replace("/", ".");

                // Auto-create topic if it doesn't exist
                let topic = find_or_create_topic(&topic_repo, &topic_name).await;

                // Parse payload: try JSON first, fall back to plain text
                let (title, message) = parse_mqtt_payload(&payload);

                // Create rstify message (same path as HTTP handlers)
                let msg = message_repo.create(
                    None, Some(topic.id), None,
                    title.as_deref(), &message, priority,
                    None, None, None, None, None, None, None,
                ).await;

                // Broadcast to WebSocket subscribers
                connections.broadcast_to_topic(&topic_name, msg.to_response(Some(topic_name))).await;

                // Fire webhooks (same as topic publish handler)
                tokio::spawn(async move {
                    rstify_jobs::outgoing_webhooks::fire_outgoing_webhooks(&pool, &topic_name, &resp).await;
                });
            }
            _ => continue,
        }
    }
}
```

#### 4. `publish.rs` — rstify Messages → MQTT

```rust
// Subscribe to ConnectionManager topic broadcasts and forward to MQTT
pub async fn run_mqtt_publisher(
    link_tx: LinkTx,
    connections: Arc<ConnectionManager>,
) {
    // Subscribe to ALL topic broadcasts via a new ConnectionManager method
    let mut rx = connections.subscribe_all_topics().await;

    loop {
        if let Ok(msg) = rx.recv().await {
            let mqtt_topic = msg.topic.as_deref()
                .unwrap_or("rstify/unknown")
                .replace(".", "/");

            let payload = serde_json::to_vec(&msg).unwrap_or_default();
            let _ = link_tx.publish(mqtt_topic, payload);
        }
    }
}
```

#### 5. `lib.rs` — Service Orchestration

```rust
pub struct MqttService;

impl MqttService {
    pub async fn start(
        config: MqttConfig,
        state: AppState,
    ) -> Result<(), anyhow::Error> {
        // 1. Build rumqttd Config programmatically
        let mut broker_config = build_broker_config(&config);

        // 2. Set auth handler using rstify client tokens
        if config.require_auth {
            let client_repo = state.client_repo.clone();
            let jwt_secret = state.jwt_secret.clone();

            if let Some(v4) = broker_config.v4.as_mut() {
                if let Some(server) = v4.get_mut("1") {
                    server.set_auth_handler(move |_client_id, username, _password| {
                        let repo = client_repo.clone();
                        let secret = jwt_secret.clone();
                        async move {
                            authenticate(_client_id, username, _password, repo, secret).await
                        }
                    });
                }
            }
        }

        // 3. Create broker and get internal links
        let mut broker = Broker::new(broker_config);
        let (link_tx, link_rx) = broker.link("rstify-internal").unwrap();

        // 4. Subscribe to all topics (wildcard)
        link_tx.subscribe("#").unwrap();

        // 5. Start broker in background thread (rumqttd uses its own runtime)
        std::thread::spawn(move || {
            broker.start().unwrap();
        });

        // 6. Spawn ingest task (MQTT → rstify)
        tokio::spawn(run_mqtt_ingest(
            link_rx,
            state.topic_repo.clone(),
            state.message_repo.clone(),
            state.connections.clone(),
            state.pool.clone(),
        ));

        // 7. Spawn publisher task (rstify → MQTT)
        tokio::spawn(run_mqtt_publisher(
            link_tx,
            state.connections.clone(),
        ));

        Ok(())
    }
}
```

### Database Changes

#### New Migration: `xxx_mqtt_bridges.sql`

```sql
CREATE TABLE IF NOT EXISTS mqtt_bridges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    remote_url TEXT NOT NULL,          -- mqtt://192.168.1.50:1883
    subscribe_topics TEXT NOT NULL,     -- JSON array: ["home/#", "sensors/+/temp"]
    publish_topics TEXT,               -- JSON array: topics to forward TO remote (optional)
    username TEXT,                     -- Remote broker credentials
    password TEXT,                     -- Remote broker credentials
    qos INTEGER DEFAULT 0,            -- 0, 1, or 2
    topic_prefix TEXT,                 -- Prefix for rstify topic names (e.g. "mqtt.")
    enabled BOOLEAN DEFAULT TRUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

This table stores bridge configurations. On startup (or when bridges are CRUD'd via API), rstify dynamically creates rumqttd `BridgeConfig` entries.

#### New API Endpoints

```
GET    /api/mqtt/bridges         — List bridge configurations
POST   /api/mqtt/bridges         — Create a new bridge
PUT    /api/mqtt/bridges/{id}    — Update a bridge
DELETE /api/mqtt/bridges/{id}    — Delete a bridge
GET    /api/mqtt/status          — Broker status (connections, messages/sec)
```

### Changes to Existing Code

#### `crates/rstify-server/src/config.rs`
Add MQTT config fields.

#### `crates/rstify-server/src/main.rs`
Spawn MQTT service after JobRunner, before Axum serve:

```rust
// After job_runner.start()
if config.mqtt_enabled {
    let mqtt_config = MqttConfig::from_env();
    let mqtt_state = state.clone();
    tokio::spawn(async move {
        if let Err(e) = rstify_mqtt::MqttService::start(mqtt_config, mqtt_state).await {
            tracing::error!("MQTT service failed: {e}");
        }
    });
}
```

#### `crates/rstify-api/src/websocket/manager.rs`
Add method to subscribe to all topic broadcasts (for MQTT publisher):

```rust
pub async fn subscribe_all_topics(&self) -> broadcast::Receiver<Arc<MessageResponse>> {
    // New global broadcast channel for cross-protocol forwarding
}
```

### Topic Name Mapping

MQTT uses `/` as separator, rstify uses `.`:

| MQTT Topic | rstify Topic | Direction |
|---|---|---|
| `sensors/temperature` | `sensors.temperature` | MQTT → rstify |
| `home/living-room/lights` | `home.living-room.lights` | MQTT → rstify |
| `alerts.server.down` | `alerts/server/down` | rstify → MQTT |

Configurable via `MQTT_TOPIC_SEPARATOR` env var (default: auto-map `/` ↔ `.`).

### MQTT Payload Parsing

When an MQTT message arrives, parse the payload intelligently:

1. **JSON with rstify fields** → extract title, message, priority, tags
   ```json
   {"title": "Temp Alert", "message": "Temperature is 45°C", "priority": 8}
   ```

2. **Plain JSON** → store as message body, use topic as title
   ```json
   {"temperature": 22.5, "humidity": 65}
   ```

3. **Plain text** → use as message body directly
   ```
   Server backup complete
   ```

### Deployment: Public Server Access

For `https://rstify.js-node.cc`:

**Option 1: MQTT-over-WebSocket (easiest)**
- rumqttd listens on internal port 8083
- Caddy/nginx proxies `wss://rstify.js-node.cc/mqtt` → `localhost:8083`
- No firewall changes needed
- Works through corporate proxies

**Option 2: Direct MQTT TCP**
- rumqttd listens on port 1883 (or 8883 with TLS)
- Requires firewall port opening
- Better for IoT devices that don't support WebSocket

**Caddy config example:**
```
rstify.js-node.cc {
    # Existing HTTP/WS proxy
    reverse_proxy /api/* localhost:8080
    reverse_proxy /stream localhost:8080

    # MQTT-over-WebSocket
    reverse_proxy /mqtt localhost:8083
}
```

### Implementation Order

1. **Phase 1: Embedded broker (broker role)**
   - New crate `rstify-mqtt`
   - Config from env vars
   - Auth via client tokens
   - Ingest: MQTT publish → rstify message → WS broadcast + webhooks
   - Publish: rstify topic message → MQTT subscribers
   - Test with `mosquitto_pub` / `mosquitto_sub`

2. **Phase 2: Bridge client (monitor role)**
   - Database table for bridge configs
   - API endpoints for bridge CRUD
   - Dynamic bridge creation using rumqttd BridgeConfig
   - Web UI: bridge management page
   - Test with local Mosquitto

3. **Phase 3: UI + Polish**
   - Web UI: MQTT status dashboard
   - Mobile: MQTT bridge management
   - Documentation and examples
   - Home Assistant integration guide

### Estimated Scope

| Component | New Lines | Modified Lines |
|---|---|---|
| `rstify-mqtt` crate | ~400-500 | — |
| Migration + models | ~50 | — |
| API routes (bridges) | ~150 | — |
| Config changes | — | ~20 |
| Server startup | — | ~15 |
| ConnectionManager | — | ~20 |
| Web UI (bridges page) | ~200 | ~10 |
| **Total** | **~800-900** | **~65** |

### Risk Assessment

| Risk | Mitigation |
|---|---|
| rumqttd runs its own thread (not pure tokio) | `std::thread::spawn` for broker, `link_tx/rx` bridge to tokio tasks |
| Message loops (MQTT→rstify→MQTT) | Tag messages with source; skip re-publishing messages that originated from MQTT |
| Topic name collisions | Configurable prefix (`mqtt.`) for auto-created topics |
| Bridge reconnection | rumqttd BridgeConfig has built-in `reconnection_delay` |
| Memory usage with many subscribers | rumqttd router has configurable `max_connections` and segment limits |

### Testing Strategy

```bash
# Start rstify with MQTT enabled
MQTT_ENABLED=true MQTT_LISTEN_ADDR=0.0.0.0:1883 cargo run

# Publish via MQTT, verify in web UI
mosquitto_pub -h localhost -p 1883 -t "test/hello" -m "Hello from MQTT" \
  -u "C_xxxxxxxx"  # client token as username

# Subscribe via MQTT, send from web UI
mosquitto_sub -h localhost -p 1883 -t "test/#" -u "C_xxxxxxxx"
# Then POST /api/topics/test.hello/publish → should appear in mosquitto_sub

# Bridge test: connect to external broker
curl -X POST /api/mqtt/bridges -d '{
  "name": "local-mosquitto",
  "remote_url": "mqtt://192.168.1.50:1883",
  "subscribe_topics": ["home/#"],
  "topic_prefix": "mqtt."
}'
# Messages from home/# on external broker → appear as mqtt.home.* in rstify
```
