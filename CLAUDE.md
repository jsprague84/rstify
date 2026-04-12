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

### Web UI and Mobile (shared utilities)
- NEVER display raw date strings (`{m.date}`, `{u.created_at}`)
- ALWAYS use `formatLocalTime()` or `formatTimeAgo()` from `shared/utils/time.ts`
- Mobile compact format: use `formatTimeAgoCompact()` from `shared/utils/time.ts`
- These utilities normalize bare SQLite dates to ISO 8601 with Z before parsing
- DataTable columns with dates MUST use a `render` function: `render: u => formatLocalTime(u.created_at)`

## Centralized Configuration

All environment variables are read in `crates/rstify-server/src/config.rs` at startup.

**Hard rule:** `std::env::var` is only allowed in the config bootstrap layer. No other crate or module reads environment variables directly.

Sub-configs passed through `AppState`:
- `ServerConfig` — listen address, upload dir, max attachment size
- `DatabaseConfig` — database URL
- `AuthConfig` — JWT secret (min 32 bytes), token expiry
- `MqttConfig` (optional) — listen address, WS address, require auth, max payload, max connections
- `FcmConfig` (optional) — project ID, service account path
- `SmtpConfig` (optional) — host, port, user, password, from address
- `RateLimitConfig` — burst, requests per second
- `CorsConfig` — allowed origins

## Shared Types & Utilities (`shared/`)

API types are generated from Rust DTOs via `ts-rs`. Both web-ui and client import from the `shared/` package.

### Type Generation
- Rust API-facing DTOs have `#[derive(TS)]` + `#[ts(export)]`
- Run `just generate-types` to regenerate `shared/generated/*.ts`
- Generated output is committed — frontend dev doesn't require the Rust toolchain
- CI verifies generated types are up-to-date (diff check)
- **NEVER hand-edit files in `shared/generated/`** — fix in the Rust struct instead

### Adding New API Types
1. Add `#[derive(TS)]` and `#[ts(export)]` to the Rust struct
2. Run `just generate-types`
3. Commit the generated output

### Shared Utilities
- `shared/utils/time.ts` — `normalizeUtcDate`, `formatLocalTime`, `formatTimeAgo`, `formatTimeAgoCompact`
- Both frontends import from `shared` — no local type or time utility files

## Web UI Architecture

### Hooks Own Async, Pages Own Layout
- `useCrudResource(fetchAll)` — manages list lifecycle (load, reload, error, mutations)
- `useAsyncAction<T>()` — manages one-off async operations (loading + error state)
- Pages MUST NOT contain `try-catch` for API calls — hooks handle errors
- Pages MUST NOT use `useState` for loading/error — hooks own that state
- `fetchAll` passed to `useCrudResource` MUST be wrapped in `useCallback` to prevent infinite loops

### Shared Components
- `FormField` — label + input/select/textarea/checkbox + error display
- `FormModal` — Modal + form submission + loading/error (auto-closes on success)
- All HTTP requests flow through `web-ui/src/api/client.ts` — no direct `fetch()` in pages

## Mobile App Architecture

### Hooks
- `useHubData(fetchFn)` — shared fetch/error/loading lifecycle for hub screens
- Initial load is silent (no Alert popup); pull-to-refresh and mutations show Alerts on failure
- `mutate()` handles reload after successful mutations

### Zustand Stores
- Use `createCache<T>(key)` from `client/src/utils/cache.ts` for MMKV persistence
- Cache helpers provide typed `load()`, `save()`, `clear()` — no manual `JSON.parse`/`stringify`

### NativeWind v4 (NOT v5)
- `View` and `Text` with `className` — safe everywhere
- `Pressable` with `className` — CRASHES in v4's CSS interop
- Use `ThemedPressable` or `AnimatedPressable` instead
- Mobile shared components: ThemedPressable, AnimatedPressable, ConfirmSheet, FormModal, FormInput

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

## API Documentation

- OpenAPI/Swagger UI served at `/docs` with JSON spec at `/docs/openapi.json`
- Route handlers use `#[utoipa::path]` annotations for automatic documentation
- DTOs use `#[derive(ToSchema)]` for schema generation
- When adding new endpoints, add `#[utoipa::path]` and register in `crates/rstify-api/src/openapi.rs`

## New Migration Checklist

1. Create `migrations/NNN_name.sql`
2. Register in `crates/rstify-db/src/pool.rs` migrations array
3. Update Rust model structs (add `#[derive(TS)]` + `#[ts(export)]` if API-facing)
4. Re-run `just generate-types` and verify shared output
5. Update API client methods if needed
6. Add `#[utoipa::path]` to new route handlers

## Testing

- **Backend unit tests:** Config, validation, ownership, error conversion (run with `cargo test`)
- **Handler integration tests:** In `crates/rstify-api/tests/` — use in-memory SQLite with production migrations
- **Test harness:** `tests/common/mod.rs` provides `TestApp` with seeded users and auth tokens
- **CI runs `cargo test --workspace`** — includes all unit + integration tests
- **Shell scripts** (`authenticated_tests.sh`, `test_production.sh`) remain as smoke tests

## Tech Stack

- **Backend:** Rust, Axum, SQLite (sqlx), JWT (Argon2), utoipa (OpenAPI)
- **Web UI:** React 19, TypeScript, Vite 6, TailwindCSS
- **Mobile:** React Native 0.83, Expo SDK 55, NativeWind v4.2.3, Zustand, MMKV
- **Shared:** `shared/` package — ts-rs generated types + time utilities
- **Testing:** cargo test, axum::test / tower::ServiceExt, in-memory SQLite

## Common Commands

- `cargo test --workspace` — run all tests (230+)
- `cargo check --workspace` — type-check without building
- `cargo fmt --all` — format Rust code
- `just generate-types` — regenerate TypeScript types from Rust DTOs
- `cd web-ui && npm run build` — build web UI
- `cd client && npx tsc --noEmit` — type-check mobile app
