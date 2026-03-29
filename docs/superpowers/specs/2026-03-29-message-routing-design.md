# Message Routing & Notification Design

## Goal

Control which messages appear in the Inbox (with push notifications) vs. which only appear in their Channel/Topic view (silent). Currently all messages go to Inbox and can trigger push notifications. This design adds an `inbox` flag on messages and per-topic routing policy, with a configurable global priority threshold.

## Core Model

Every message gets an `inbox` boolean flag at creation time. This flag controls Inbox visibility AND push notifications — they are the same thing.

### Routing Rules (evaluated at message creation)

1. **App messages** (sent via app token, `appid` set, no topic) → always `inbox: true`
2. **Topic messages** → evaluate topic policy:
   - `inbox_override = "always"` → `inbox: true`
   - `inbox_override = "never"` → `inbox: false`
   - `inbox_override = "threshold"` → `inbox: priority >= topic.inbox_priority_min`
   - `inbox_override = NULL` (auto/default) → `inbox: priority >= global_threshold`

### What `inbox: true` means

- Message appears in the Inbox tab (grouped + stream views)
- FCM push notification is sent to the topic owner's devices
- WebSocket user stream delivers the message

### What `inbox: false` means

- Message is stored in the database
- Message appears ONLY in the Channels tab under its topic
- No push notification
- WebSocket topic-specific subscribers still receive it (for live topic view)
- Not delivered on the user WebSocket stream

## Schema Changes

### New migration: `027_message_inbox.sql`

```sql
ALTER TABLE messages ADD COLUMN inbox BOOLEAN NOT NULL DEFAULT 1;
```

All existing messages default to `inbox = 1` (visible in Inbox) for backwards compatibility.

### New migration: `028_topic_inbox_override.sql`

```sql
ALTER TABLE topics ADD COLUMN inbox_override TEXT DEFAULT NULL;
ALTER TABLE topics ADD COLUMN inbox_priority_min INTEGER DEFAULT NULL;
```

- `inbox_override`: `NULL` (auto — use global threshold), `"always"`, `"never"`, or `"threshold"` (use topic-specific `inbox_priority_min`)
- `inbox_priority_min`: topic-specific priority threshold, only used when `inbox_override = "threshold"`

### New migration: `029_settings_table.sql`

```sql
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
INSERT OR IGNORE INTO settings (key, value) VALUES ('inbox_priority_threshold', '5');
```

## Policy Evaluation Function

Single function used by all message creation paths:

```rust
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

For app messages (no topic), `inbox` is always `true` — apps have no channel to fall back to.

## Message Creation Paths

Every path that creates a message must set the `inbox` flag:

| Path | File | Rule |
|------|------|------|
| App publish | `routes/messages.rs` | `inbox: true` (always) |
| Topic publish | `routes/topics.rs` | `should_inbox(topic, priority, threshold)` |
| ntfy compat | `routes/ntfy_publish.rs` | `should_inbox(topic, priority, threshold)` |
| Incoming webhook | `routes/webhooks.rs` | `should_inbox(topic, priority, threshold)` for topic-targeted; `true` for app-targeted |
| MQTT ingest | `mqtt/ingest.rs` | `should_inbox(topic, priority, threshold)` |
| Scheduled delivery | `main.rs` | Already stored with flag; no change needed |

Each path must load the global threshold from the `settings` table (can be cached in `AppState` on startup and refreshed periodically).

## FCM Push Notification Integration

Replace the current `should_notify()` with the `inbox` flag:

- **Before:** `if should_notify(&topic, &response) { fcm.notify_user(...) }`
- **After:** `if msg.inbox { fcm.notify_user(...) }`

The existing `notify_policy` field on topics is superseded by `inbox_override` for inbox/push routing. The old `notify_policy` can be deprecated or kept for backwards compatibility with Gotify clients.

## API Changes

### `GET /message` — Inbox filter

Add optional query parameter `inbox`:
- `GET /message?inbox=true` — returns only inbox messages (used by Inbox tab)
- `GET /message?inbox=false` — returns only non-inbox messages (rarely needed)
- `GET /message` — returns all messages (backwards compatible)

### `GET /api/topics/{name}/json` — unchanged

Returns all messages for a topic regardless of inbox flag.

### `GET /api/settings` — new endpoint (admin)

Returns all settings as key-value pairs. Used to display and edit the global threshold.

### `PUT /api/settings/{key}` — new endpoint (admin)

Updates a setting. Used to change `inbox_priority_threshold`.

### Topic CRUD — updated

`CreateTopic` and `UpdateTopic` gain:
- `inbox_override?: string | null` — "always", "never", "threshold", or null
- `inbox_priority_min?: number | null` — custom threshold when override is "threshold"

## WebSocket Changes

### User stream (`/stream`)

Currently sends ALL messages. Change to only send messages where `inbox = true`. This matches the Inbox view and prevents noise from flooding the real-time feed.

### Topic stream (`/api/topics/{name}/ws`)

Unchanged — sends all messages for that topic regardless of inbox flag. Used for the live topic view in the Channels tab.

## Mobile App Changes

### Inbox store (`fetchMessages`)

Add `?inbox=true` parameter to the message list API call:

```typescript
const result = await api.listMessages(PAGE_SIZE, 0, true);
```

### WebSocket handler

No change needed — the backend will only send inbox messages on the user stream.

### Channels tab

No change — topic message fetching doesn't filter by inbox.

### Unread badge

Only count messages with `inbox: true`.

### Topic edit (mobile)

Add inbox dropdown to `EditTopicModal`:
- Auto (default — uses server threshold)
- Always
- Never
- Custom threshold (number picker)

## Web UI Changes

### Messages page

Add `?inbox=true` to the default message fetch. Optionally add a toggle to show all messages.

### Topics page — edit form

Add "Inbox Routing" section to the edit topic form:

```
Inbox: [Auto ▾]          (uses server default: >= 5)
       [Always]           (all messages go to inbox)
       [Never]            (channel only, no notifications)
       [Custom: >= [__]]  (custom priority threshold)
```

### Settings/Server page (admin)

Add "Default Inbox Threshold" setting:

```
Default Inbox Priority Threshold: [5]
Messages with priority >= this value appear in the Inbox and trigger push notifications.
```

## Default Priority Reference

| Priority | Typical Events | Default Inbox (>= 5) |
|----------|---------------|----------------------|
| 3 | Branch create/delete, CI requested | Channel only |
| 4 | Fork, comment, CI cancelled | Channel only |
| 5 | Push, issue opened, CI success | Inbox |
| 6 | Pre-release | Inbox |
| 7 | PR opened/merged | Inbox |
| 8 | CI failure, stable release | Inbox |

## Migration Path

1. Add `inbox` column defaulting to `1` — all existing messages remain in Inbox
2. Add topic fields — all topics start with `NULL` (auto/default behavior)
3. Add settings table with default threshold of 5
4. Update message creation paths to set the flag
5. Update API query to support `?inbox=true` filter
6. Update WebSocket to filter user stream
7. Update FCM to use `msg.inbox` instead of `should_notify()`
8. Update frontend to pass `?inbox=true`
9. Add UI for topic inbox override and global threshold setting

New messages after deployment follow the new routing. Existing messages all show in Inbox (backwards compatible). Users can then configure per-topic overrides to reduce noise.
