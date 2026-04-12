# rstify Development Conventions

## Date/Time Handling (MANDATORY)

All timestamps in this application are stored as UTC in SQLite via `datetime('now')`.

### Backend (Rust)
- SQLite `datetime('now')` produces `"2026-03-29 04:31:12"` (UTC, no indicator)
- Any model with a `to_response()` method MUST append `Z` to date fields that lack timezone info
- Pattern: `if !date.ends_with('Z') && !date.contains('+') { format!("{}Z", date) }`
- New models that serialize date fields directly (without `to_response()`) must still ensure `Z` is appended
- MQTT ingest: use `chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ")` — NOT `to_rfc3339()` (which produces `+00:00`)
- SQL datetime comparisons: use `"%Y-%m-%d %H:%M:%S"` format (matching SQLite's internal format)

### Web UI (React/TypeScript)
- NEVER display raw date strings (`{m.date}`, `{u.created_at}`)
- ALWAYS use `formatLocalTime()` or `formatTimeAgo()` from `web-ui/src/utils/time.ts`
- These utilities normalize bare SQLite dates to ISO 8601 with Z before parsing
- DataTable columns with dates MUST use a `render` function: `render: u => formatLocalTime(u.created_at)`

### Mobile App (React Native/TypeScript)
- ALWAYS use `formatLocalTime()` or `formatTimeAgo()` from `client/src/utils/time.ts`
- NEVER use raw `new Date(x).toLocaleString()` — use the shared utility instead
- Both utilities include `normalizeUtcDate()` and NaN guards

## NativeWind v4 (NOT v5)

The mobile app uses NativeWind v4.2.3. v5 is preview-only and incompatible.

- `View` and `Text` with `className` — safe everywhere
- `Pressable` with `className` — CRASHES with "NavigationContext not found" in v4's CSS interop
- Use `ThemedPressable` (inline styles + `useColorScheme`) for interactive elements needing theme colors
- Use `AnimatedPressable` (Reanimated wrapper) for press animations — bypasses CSS interop
- Never use `Pressable` with `className` directly

## Webhook Development

### Incoming Webhooks
- Handler at `/api/wh/{token}` uses `Bytes` extractor (not `Json<Value>`) for HMAC verification
- Signature check happens before JSON parsing
- Parsers return `WebhookMessageOutput` with `content_type: Some("text/markdown")` for rich messages
- Always set `extras_json` for markdown content: `{"client::display":{"contentType":"text/markdown"}}`

### Outgoing Webhooks
- `{{env.KEY}}` substitution works in `body_template`, `target_url`, AND `headers`
- Store secrets as webhook variables, not hardcoded in headers

### Anti-Loop
- MQTT ingest skips messages with `source: "webhook"` or `source: "api"` to prevent duplication
- MQTT publisher skips messages with `source: "mqtt"`
- Internal MQTT topics use `rstify/` prefix which the ingest ignores

## API Type Consistency

### Backend → Frontend Field Naming
- Backend uses `snake_case` with `#[serde(rename_all = "camelCase")]` and `#[serde(alias = "...")]`
- Frontend TypeScript types must match the serialized JSON field names
- When adding fields to backend models, update BOTH `web-ui/src/api/types.ts` AND `client/src/api/types.ts`

### New Migration Checklist
1. Create `migrations/NNN_name.sql`
2. Register in `crates/rstify-db/src/pool.rs` migrations array
3. Update Rust model structs
4. Re-run `just generate-types` and verify shared output
5. Update API client methods if needed

## Tech Stack

- **Backend:** Rust, Axum, SQLite (sqlx), JWT (Argon2)
- **Web UI:** React 19, TypeScript, Vite 6, TailwindCSS
- **Mobile:** React Native 0.83, Expo SDK 55, NativeWind v4.2.3, Zustand, MMKV
- **Shared components (mobile):** ThemedPressable, AnimatedPressable, ConfirmSheet, FormModal, FormInput
