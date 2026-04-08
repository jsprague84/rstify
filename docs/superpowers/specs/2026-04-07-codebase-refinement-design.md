# Rstify Codebase Refinement Design

**Date:** 2026-04-07
**Status:** Draft
**Scope:** Backend, shared types layer, frontend (web-ui + mobile), testing

## Problem Statement

Rstify is a functional, feature-complete self-hosted notification server. The application works, but its codebase has accumulated patterns that make long-term maintenance and development harder than necessary:

- **Backend duplication** — Ownership verification, validation, pagination, and error handling patterns are copy-pasted across 10+ handler functions. Three route modules exceed 500 LOC each, mixing multiple concerns. Configuration is read via scattered `std::env::var` calls across 5+ files with no caching or validation.
- **Contract drift** — Two nearly identical TypeScript type definition files (337 and 366 lines) are maintained independently for web-ui and mobile with 95% overlap. API changes require manual updates to both, and the implementations have already diverged (different naming, missing fields, inconsistent null handling).
- **Frontend boilerplate** — 11 web-ui CRUD pages repeat the same `useState`/`useCallback`/try-catch/modal pattern. The mobile app's 7 hub screens duplicate equivalent patterns. No shared hooks or composable form components exist.
- **Inconsistent patterns** — Model-to-response conversion uses three different approaches. Repository error handling varies by module. Admin checks use two different styles. JSON serialization mixes `unwrap()`, `unwrap_or_default()`, and `map_err()` with no standard.
- **Thin test coverage** — ~47 unit tests cover core logic (auth, ACL, MQTT parsing) but no handler/endpoint tests exist. Shell scripts serve as the primary integration test layer.

## Goals

1. Establish clean, explicit backend boundaries by centralizing configuration, extracting shared handler/repository patterns, standardizing error and response behavior, and covering all new abstractions with unit tests
2. Eliminate contract drift by making Rust API DTOs the canonical source for shared frontend types, while consolidating handwritten cross-client utilities in a single frontend-safe package
3. Remove repeated frontend async, form, and CRUD-page boilerplate by introducing shared hooks and composable UI primitives for web-ui, then apply the same cleanup principles to duplicated mobile screen and store patterns using platform-appropriate abstractions
4. Build durable confidence through systematic test coverage that turns the refactor into a lasting architecture, not a one-time cleanup

## Non-Goals

- SQLite-to-Postgres migration or multi-database support
- Forced password change on first login or token revocation
- JWT refresh token mechanism
- Performance optimization or load testing
- Feature additions of any kind

---

## Phase 1: Backend Foundation

**Goal:** Establish clean, explicit backend boundaries by centralizing configuration, extracting shared handler/repository patterns, standardizing error and response behavior, and covering all new abstractions with unit tests.

### 1a. Centralized Config

Replace all scattered `env::var` calls with a single typed `Config` struct loaded and validated at startup in `rstify-server`.

**Structure:**
- Top-level `Config` struct parsed once at boot
- Sub-configs passed through `AppState` so modules only receive the fields they need:
  - `ServerConfig` — listen address, upload dir, max attachment size
  - `DatabaseConfig` — database URL, pool settings
  - `AuthConfig` — JWT secret, token expiry
  - `MqttConfig` — enabled, listen address, WS address, require auth, max payload, max connections
  - `FcmConfig` — project ID, service account path
  - `SmtpConfig` — host, port, user, password, from address
  - `RateLimitConfig` — burst, requests per second
  - `CorsConfig` — allowed origins

**Startup validation:**
- Missing required values produce clear boot failures with the variable name and expected format
- Malformed values (non-numeric port, invalid URL, JWT secret too short) fail immediately with actionable error messages
- Optional configs (FCM, SMTP, MQTT) are validated only when their feature is enabled

**Hard rule:** After centralization, `std::env::var` is only allowed in the config loading/bootstrap layer. No other crate or module reads environment variables directly.

### 1b. Cross-Cutting Backend Helpers

Extract patterns currently duplicated across 10+ handler functions into shared, tested primitives.

**Ownership/authorization helpers:**
- Introduce shared helpers that encapsulate find-by-id, not-found handling, and ownership verification in one reusable flow
- The exact generic shape should emerge from the repository interfaces rather than being forced prematurely — if some repos differ, the helpers should accommodate that
- Add repository methods such as `find_by_id_for_user()` where ownership-scoped lookup is a common and performance-relevant pattern (e.g., webhook variables currently fetches all user variables and filters in memory)
- Ownership logic pushed into repos should be limited to performance-relevant queries; authorization decisions that need to remain visible should stay in handler/service code

**Validation helpers:**
- Centralized validators for name length, message length, topic name format, JSON field validation
- Replace ad-hoc inline checks scattered across routes (currently duplicated in users.rs, applications.rs, topics.rs, messages.rs)

**Response builders (API DTOs only, not database models):**
- Repo returns domain/data models
- Handler maps to response DTOs using standardized `to_response()` methods
- Response helpers standardize output shape: pagination construction, `Z`-append for UTC dates applied uniformly
- These are for API response shaping, not database model transformation

**Safe serialization helpers:**
- Eliminate raw `unwrap()` in production serialization paths by introducing explicit serialization helpers that return typed application errors
- Replace the current mix of `unwrap()` (clients.rs:39,77), `unwrap_or_default()` (messages.rs:77-80), and ad-hoc patterns with a consistent approach

### 1c. Route Module Splitting

Split the three oversized route files by domain concern:

- `topics.rs` (616 LOC) → `topic_management.rs`, `topic_permissions.rs`, `topic_streaming.rs`
- `messages.rs` (562 LOC) → `message_crud.rs`, `message_search.rs`
- `webhooks.rs` (716 LOC) → `webhook_config.rs`, `webhook_delivery.rs`

**Completion criteria:**
- Each sub-module owns one concern
- Parent module only composes routers (re-exports a combined router)
- Cross-cutting logic moved to shared helpers from 1b
- No duplicated auth/validation/ownership blocks remain in split modules

### 1d. Repository & Error Consistency

- Standardize UNIQUE constraint handling across all repositories — currently only user and topic repos catch it; apply the same pattern to application, client, webhook, and bridge repos
- Standardize admin checks on `auth.require_admin()?` instead of inline `if !auth.user.is_admin` blocks (currently mixed across 68+ instances)
- Standardize repository-to-application error translation so common cases (not found, unique violation, forbidden, validation failure) map consistently across all modules

### 1e. Phase 1 Testing

**Rule:** No new shared backend abstraction is considered complete without tests.

Required test coverage for new abstractions:
- Config parsing and startup validation (valid, missing, malformed, edge cases)
- Ownership/permission helpers (authorized, unauthorized, admin override, not-found)
- Validation helpers (valid input, boundary values, rejection cases)
- Response/DTO mapping helpers (field transformation, Z-append, null handling)
- Error conversion behavior (CoreError → ApiError mapping, UNIQUE constraint handling, forbidden vs unauthorized distinctions)
- Safe serialization helpers (valid JSON, invalid input, failure paths)
- Admin authorization helper behavior

---

## Phase 2: Shared Types & Utilities Layer

**Goal:** Eliminate contract drift by making Rust API DTOs the canonical source for shared frontend types, while consolidating handwritten cross-client utilities in a single frontend-safe package.

**Ownership chain:** The backend is the source of truth and owns contract generation; the shared package stores the generated output; frontends are consumers only.

### 2a. Shared Package Structure

Create a `shared/` directory at the repo root as a lightweight TypeScript package.

```
shared/
├── index.ts              # Stable export surface
├── generated/
│   ├── index.ts          # Re-exports all generated types
│   └── types.ts          # ts-rs output (initially one file, split by domain if size warrants)
├── utils/
│   ├── index.ts          # Re-exports all utilities
│   └── time.ts           # Unified normalizeUtcDate, formatLocalTime, formatTimeAgo
├── package.json
└── tsconfig.json
```

**Package boundary rule:** The shared package contains only cross-client contracts and frontend-safe utilities. It must not depend on app-specific UI frameworks, mobile runtime APIs, or backend implementation details.

**Content rules:**
- `generated/` = machine-produced, API contract types only. Never hand-edited
- `utils/` = handwritten, framework-agnostic helpers. No app-specific business logic
- Client-specific derived view models, form schemas, and presentation-only state remain owned by each frontend and must not be added to shared

Both `web-ui` and `client` import from shared via relative path (e.g., `"../shared"` in each `package.json`). Stable imports like `import { MessageResponse, Topic, normalizeUtcDate } from "shared"` — no deep path imports required.

**Note:** After Phase 2 lands, the CLAUDE.md migration checklist step "Update TypeScript types (web UI + mobile)" should be updated to "Re-run `just generate-types` and verify shared output" to reflect the new codegen workflow.

### 2b. Codegen Pipeline (ts-rs)

Add `ts-rs` to backend crates, scoped to **API DTO structs only**.

**Scope rule:** Only API-facing DTOs get `#[derive(TS)]`. Database models, internal structs, and config types do not.

**DTO naming convention:** API-facing structs should follow a clear naming pattern that distinguishes them from internal models:
- Response types: `UserResponse`, `MessageResponse`, `PagedMessagesResponse`
- Request types: `CreateTopicRequest`, `UpdateTopicRequest`, `ChangePasswordRequest`
- Shared types used in both: `Paging`, `AttachmentInfo`, `MessageAction`

**Types covered:** API request/response DTOs for users, messages, applications, clients, topics, permissions, webhooks, pagination, auth, stats, and account management.

**Generation:**
- `just generate-types` runs ts-rs export into `shared/generated/types.ts`
- Generated TypeScript output is committed to the repository so frontend development does not require the Rust toolchain
- Initially one generated file; split by domain (e.g., `generated/auth.ts`, `generated/messages.ts`, `generated/topics.ts`) if size becomes unwieldy

### 2c. Unified Time Utilities

Consolidate the two divergent implementations into `shared/utils/time.ts`:

- Normalization of backend UTC strings (bare SQLite `"2026-03-29 04:31:12"` → ISO 8601 with Z)
- Safe parsing with consistent invalid-date handling (NaN guards)
- `formatLocalTime()` — full locale formatting
- `formatTimeAgo()` — relative time display

This is a standardization move, not just copying the web version. Both frontends delete their local `utils/time.ts` and import from shared.

### 2d. Frontend Type Migration

- Delete `web-ui/src/api/types.ts` and `client/src/api/types.ts`
- Replace with imports from `shared/generated/types.ts`
- Handwritten types that aren't API DTOs (frontend-only UI state, form types) stay local to each frontend
- API client files update their imports

**Phased adoption:** Migrate web-ui first (simpler, easier to verify), confirm everything builds, then migrate mobile.

### 2e. Phase 2 Guardrails

- No hand edits to generated files — if a type needs adjustment for the frontend, the fix goes in the Rust struct or in a handwritten extension in `shared/utils/`
- CI verifies generated output is up-to-date: diff check on `shared/generated/`. If Rust types change and codegen wasn't re-run, CI fails
- Shared package changes that affect generated contracts must be reviewed with both backend and frontend impact in mind

---

## Phase 3: Frontend Cleanup

**Goal:** Remove repeated frontend async, form, and CRUD-page boilerplate by introducing shared hooks and composable UI primitives for web-ui, then apply the same cleanup principles to duplicated mobile screen and store patterns using platform-appropriate abstractions.

### 3a. Web-UI Shared Hooks

**`useCrudResource<T>()`** — Manages resource lifecycle:
- Load list data, expose loading/error/reload state
- Standard mutation wrappers (create, update, delete) with consistent error handling and reload semantics
- Centralizes error normalization: async hooks normalize unknown thrown values into a consistent user-facing error shape
- Focused on resource lifecycle only — does not manage modal state, selection state, filtering/sorting UI, form shape, or optimistic updates
- If the hook grows crowded, the spec allows splitting into separate hooks for list/resource state and mutation actions

**`useAsyncAction()`** — Lighter-weight hook for one-off async operations (password change, webhook test, publish). Manages loading + error state for a single action without the full CRUD lifecycle.

**Rule:** Pages should not contain try-catch blocks for API calls — that logic lives in hooks. No new page-level `useState` for loading/error; if a page needs async state, it uses the shared hooks.

### 3b. Web-UI Shared Form Components

**`FormField`** — Label, input/select/textarea, validation error display. Replaces inline form markup duplicated across page-specific modals.

**`FormModal`** — Composes Modal + form submission handling + loading/error state (consuming `useAsyncAction`). Replaces the pattern where every page builds its own modal with embedded form and submit handler.

**`CrudPageLayout`** — Optional, opt-in composition helper: header with create button, DataTable, FormModal for create/edit, ConfirmDialog for delete. Pages configure it declaratively but can compose freely for pages with extra behavior. This is not a pseudo-framework — it helps with the most repetitive pages but is not mandatory.

**Rule:** FormField/FormModal are composable, not mandatory. Pages with unique form needs can compose directly, but the common case should use shared components.

### 3c. Web-UI API Client Cleanup

- Move the direct `fetch()` calls in Settings.tsx (password change) and Messages.tsx (action URLs) into proper API client methods
- **Hard rule:** All HTTP requests must flow through typed API client methods. Page and component code may not call `fetch()` directly

### 3d. Mobile App Cleanup

Apply equivalent cleanup principles to the mobile hub screens using abstractions appropriate to React Native, Zustand, and MMKV — not mirroring the web-ui implementation one-for-one.

**Screen-level patterns:**
- Extract shared fetch/error/loading pattern for hub pages (apps.tsx, users.tsx, clients.tsx, mqtt.tsx, webhooks.tsx all repeat the same `useState` + `useCallback` + `Alert.alert` structure)
- Break down oversized screens: webhooks.tsx (828 LOC) splits into focused components (WebhookForm, WebhookList, WebhookDetail)

**Store-level patterns:**
- Standardize Zustand store conventions: consistent cache key naming, shared persistence helpers extracted from duplicated `loadFromCache`/`saveToCache` implementations
- Persistence helpers should be small and boring: read cache, write cache, key naming convention, TTL/freshness if applicable. Not a heavy cache framework

**Platform constraints respected:** NativeWind v4 constraints, `ThemedPressable`/`AnimatedPressable` usage, Zustand instead of context, MMKV instead of localStorage.

### 3e. Migration Order

Within web-ui:
1. Migrate 1 simple CRUD page first (e.g., Clients) to prove the hook/component APIs
2. Migrate 1 moderately complex page second (e.g., Applications, which has icon upload)
3. Migrate remaining pages in batches

This validates the abstractions before spreading them everywhere.

### 3f. Phase 3 Guardrails

- **Hooks own async, pages own layout.** This is the core architectural boundary
- **Shared form pieces are recommended, not mandatory.** Pages with unique needs compose directly
- **No new page-level `useState` for loading/error.** Shared hooks handle this
- **Mobile cleanup is proportional.** Don't force web-ui abstractions onto React Native — extract what's genuinely duplicated, leave what's platform-specific
- **Preserve existing UX semantics.** Shared hooks and components must not accidentally change user-facing behavior (loading states, modal behavior, error visibility) unless a deliberate UX change is called out

---

## Phase 4: Testing & Hardening

**Goal:** Build durable confidence in the refactored codebase through systematic test coverage — unit tests enforced during Phases 1-3, then handler-level integration tests for critical API routes.

### 4a. Unit Tests for New Abstractions (concurrent with Phases 1-3)

This is a gate, not a phase. No new shared backend abstraction is considered complete without tests.

Required coverage:
- Config parsing and startup validation (valid, missing, malformed, edge cases)
- Ownership/permission helpers (authorized, unauthorized, admin override, not-found)
- Validation helpers (valid input, boundary values, rejection cases)
- Response/DTO mapping helpers (field transformation, Z-append, null handling)
- Error conversion behavior (CoreError → ApiError, UNIQUE constraint, forbidden vs unauthorized)
- Safe serialization helpers (valid JSON, invalid input, failure paths)
- Admin authorization helper behavior

### 4b. Handler-Level Integration Harness

After Phase 1 stabilizes the backend surface:

- Use `axum::test` / `tower::ServiceExt` to test handlers without a running server
- Isolated test state: in-memory SQLite database per test (production uses SQLite, so this is faithful to real behavior)
- Test databases created from the same migrations used in production, not ad hoc test-only schemas
- Shared test fixtures: helper functions for creating authenticated test requests, seeding test data (users, apps, topics, tokens)
- Fixtures should be minimal, deterministic, and explicit about ownership/auth relationships

### 4c. Critical Route Coverage

Prioritized by risk, starting with routes where auth, ownership, and validation intersect:

1. **Auth-sensitive endpoints** — login, token validation, JWT expiry behavior
2. **Ownership-protected mutations** — application CRUD, client CRUD, webhook config updates
3. **Topics routes** — create, publish, permission enforcement, ACL wildcard matching
4. **Messages routes** — create, search, pagination, attachment handling
5. **Webhooks routes** — incoming webhook verification, outgoing contract/verification logic (true external delivery behavior remains covered by smoke tests)
6. **Validation-heavy flows** — create/update with constraint violations, field length limits

**Each route family must include baseline coverage for the relevant contract cases:** happy path, authentication failure, authorization failure/forbidden, validation failure, and not-found behavior where applicable. Not every route needs every case if a case is structurally irrelevant, but the standard should be applied intentionally.

**Handler tests should assert:** status codes, response body shape, and key payload fields — not just whether a request succeeded.

### 4d. Completion Criteria

- Refactored route families are not considered complete until they have baseline handler coverage
- Shell-script integration tests (`authenticated_tests.sh`, `test_production.sh`) remain as smoke tests but are not the primary confidence layer for backend correctness
- Handler tests run in CI alongside existing unit tests

---

## Success Metrics

Measurable outcomes that define completion:

- [ ] Zero direct `std::env::var` usage outside config/bootstrap layer
- [ ] Zero direct `fetch()` usage outside API client layer (both frontends)
- [ ] Shared frontend API DTOs imported from `shared/` only — local type definition files deleted
- [ ] CI enforces generated type freshness (diff check)
- [ ] Oversized route modules split: no route file exceeds ~300 LOC
- [ ] Raw `unwrap()` eliminated from production serialization paths
- [ ] Baseline handler coverage for all refactored critical route families (happy path, auth failure, validation failure, not-found, forbidden)
- [ ] Duplicated web-ui CRUD boilerplate reduced: shared hooks used across all 11 target pages
- [ ] Duplicate web/mobile type definitions eliminated (two `types.ts` files → zero)
- [ ] All new shared backend abstractions have unit tests

## Deferred Work

Explicitly out of scope for this effort:

- Frontend component tests (unit/integration tests for React components)
- End-to-end browser tests
- Mobile app test infrastructure
- Performance/load testing
- Rust → TS codegen expansion beyond API DTOs
- Config file support (TOML/YAML) beyond env-based startup config
- SQLite-to-Postgres migration or multi-database support
- JWT refresh tokens or token revocation
- Forced password change on first login
- OpenAPI/Swagger documentation generation
- Feature additions of any kind

## Risks

- **Ownership helper generics** — If repository interfaces aren't uniform enough, a single generic helper may become awkward. Mitigation: allow per-resource helpers that share a pattern rather than forcing one generic shape.
- **ts-rs limitations** — Some Rust types (enums with data, complex generics) may not map cleanly to TypeScript. Mitigation: scope codegen to simple DTOs; complex types get handwritten TypeScript in `shared/utils/`.
- **CrudPageLayout rigidity** — If the layout component becomes too opinionated, pages will fight it. Mitigation: keep it opt-in, composition-based, with escape hatches. Kill it if it causes more friction than it removes.
- **Mobile NativeWind constraints** — Shared component patterns from web-ui may not translate. Mitigation: mobile cleanup uses equivalent principles, not identical implementations.
- **Refactor without regressions** — Moving code always risks breaking behavior. Mitigation: Phase 4a testing runs concurrent with refactoring; existing shell scripts serve as smoke tests; handler tests follow.
