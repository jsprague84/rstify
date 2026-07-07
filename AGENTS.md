# rstify — Agent Guide

Self-hosted, Gotify-API-compatible push-notification server. Multi-language monorepo:
Rust/Axum backend (`crates/`), React web UI (`web-ui/`), React Native/Expo mobile (`client/`),
shared ts-rs types (`shared/`). Owner: Johnathon Sprague.

## Session-start ritual

1. `cargo check --workspace` — type-check the backend before touching it.
2. Read the path-scoped skill for the area you're editing (`.claude/skills/{rust-backend,web-ui,mobile}-tasks/`).
3. After Rust DTO changes: `just generate-types`, then commit the regenerated `shared/generated/*.ts`.
4. Before done: `cargo test --workspace` (230+ tests) + the relevant frontend type-check.

## Stack — pinned versions (do not bump without asking)

| Component | Version | Why pinned |
|---|---|---|
| Rust / axum | edition 2021, axum 0.8 (+axum-extra 0.10) | 0.8 extractor/routing semantics; ws + multipart features |
| sqlx | 0.8 (sqlite, chrono, uuid) | compile-time-checked SQLite queries |
| tokio | 1 (full) | async runtime |
| jsonwebtoken | 9 | JWT auth (Argon2 password hashing) |
| utoipa / swagger-ui | 5 / 9 | OpenAPI generation at `/docs` |
| React / Vite | react 19, vite 6 | web-ui; react-router 7, react-markdown 10 |
| TailwindCSS | 3.4 | web-ui styling (NOT v4) |
| React Native / Expo | RN 0.83, Expo SDK 55 | mobile; expo-router |
| NativeWind | 4.2 (NOT v5) | RN styling — v5 had interop breakage |
| Zustand / MMKV | zustand 5, react-native-mmkv 4 | mobile state + persistence |

<!-- agentic-init: curated — preserve below verbatim on re-sync -->

## Date/Time Handling (MANDATORY — #1 footgun)

Timestamps are stored as UTC in SQLite via `datetime('now')`, which yields `"2026-03-29 04:31:12"` (no zone indicator).

- **Backend:** any model with `to_response()` MUST append `Z` to bare date fields:
  `if !date.ends_with('Z') && !date.contains('+') { format!("{}Z", date) }`. Models serializing dates
  directly (no `to_response()`) must still append `Z`.
- **SQL datetime comparisons:** use `"%Y-%m-%d %H:%M:%S"` (SQLite's internal format).
- **Frontends:** NEVER render raw date strings. Always `formatLocalTime()` / `formatTimeAgo()` /
  `formatTimeAgoCompact()` from `shared/utils/time.ts`. DataTable date columns need a `render` fn.

## Centralized Configuration

All env vars are read in `crates/rstify-server/src/config.rs` at startup. **Hard rule:** `std::env::var`
is allowed ONLY in that config bootstrap layer — no other crate/module reads env directly. Sub-configs
(`ServerConfig`, `DatabaseConfig`, `AuthConfig`, `FcmConfig`, `SmtpConfig`, `RateLimitConfig`,
`CorsConfig`) flow through `AppState`.

## Shared Types & Utilities (`shared/`)

API types are generated from Rust DTOs via ts-rs; both frontends import from the `shared/` package.

1. Add `#[derive(TS)]` + `#[ts(export)]` to API-facing structs.
2. `just generate-types` → regenerates `shared/generated/*.ts` (committed; frontend dev needs no Rust toolchain).
3. Commit the generated output. CI diff-checks it. **NEVER hand-edit `shared/generated/`** — fix the Rust struct.

`shared/utils/time.ts` is the only time-utility source — no local copies in either frontend.

## Webhooks

- **Incoming** `/api/wh/{token}`: `Bytes` extractor (NOT `Json<Value>`) so HMAC is verified before JSON parse.
  Markdown parsers return `WebhookMessageOutput` with `content_type: Some("text/markdown")` and set
  `extras_json` `{"client::display":{"contentType":"text/markdown"}}`.
- **Outgoing:** `{{env.KEY}}` substitution works in `body_template`, `target_url`, AND `headers`. Store
  secrets as webhook variables, never hardcoded. Outgoing webhooks are validated for SSRF at delivery
  time and pinned (see `rstify-jobs/src/ssrf.rs`).

## API Documentation

OpenAPI/Swagger UI at `/docs` (JSON at `/docs/openapi.json`). New route handlers need `#[utoipa::path]`
and registration in `crates/rstify-api/src/openapi.rs`; DTOs need `#[derive(ToSchema)]`.

## New Migration Checklist

1. `migrations/NNN_name.sql` → 2. register in `crates/rstify-db/src/pool.rs` migrations array →
3. update model structs (+`#[derive(TS)]`/`#[ts(export)]` if API-facing) → 4. `just generate-types` +
verify → 5. update API client methods → 6. add `#[utoipa::path]` to new handlers.

## Gotify compatibility (do not break)

rstify is 100% Gotify-API compatible. Message extras namespaces: `client::display`, `client::notification`,
`android::action`. Action types: `view`, `http`, `broadcast`. Preserve these when adding features.

<!-- /agentic-init: curated -->

## Folder conventions

```
crates/            Rust workspace (7 crates)
  rstify-core/     models, domain types
  rstify-db/       sqlx pool + migrations registry
  rstify-auth/     JWT / Argon2
  rstify-api/      Axum handlers + openapi.rs;  tests/ = handler integration tests
  rstify-jobs/     background jobs
  rstify-server/   binary entrypoint + config.rs (the ONLY env-reading layer)
  rstify-cli/      CLI
web-ui/            React 19 + Vite 6 + Tailwind 3  → skill: web-ui-tasks
client/            React Native 0.83 + Expo 55 + NativeWind 4  → skill: mobile-tasks
shared/            ts-rs generated types + time utils (imported by both frontends)
migrations/        NNN_name.sql (UTC datetime('now'))
```

## Stack-specific rules live in path-scoped skills

| Editing | Skill (auto-loads) | Owns |
|---|---|---|
| `crates/**/*.rs` | `rust-backend-tasks` | axum extractor order, sqlx, config rule, `Z`-dates, migrations |
| `web-ui/**` | `web-ui-tasks` | hooks-own-async, FormField/FormModal, client.ts, time utils |
| `client/**` | `mobile-tasks` | NativeWind v4 Pressable crash, Zustand+MMKV cache, useHubData |

## Where code goes

| Need | Location |
|---|---|
| New API endpoint | handler in `rstify-api`, register in `openapi.rs`, DTO in `rstify-core` |
| New env var | `rstify-server/src/config.rs` only, surfaced via `AppState` |
| Shared frontend type | Rust DTO + ts-rs export → `shared/generated/` |
| Date display | `shared/utils/time.ts` helper |

## Things to avoid

| Don't | Do |
|---|---|
| Render `{m.date}` raw | `formatLocalTime(m.date)` |
| `std::env::var` outside config.rs | thread config through `AppState` |
| Hand-edit `shared/generated/*.ts` | fix the Rust struct + `just generate-types` |
| `Pressable className` (RN) | `ThemedPressable` / `AnimatedPressable` |
| `try-catch` in web-ui pages | let `useCrudResource` / `useAsyncAction` own it |

## Definition of done

1. `cargo check --workspace` clean. 2. `cargo test --workspace` green. 3. Touched DTOs →
`just generate-types` + committed. 4. Frontend changes type-check (`web-ui: npm run build`,
`client: npx tsc --noEmit`). 5. New endpoints have `#[utoipa::path]`. 6. New migrations registered
in `pool.rs`. 7. `cargo fmt --all`. 8. Dates go through the `Z`/time-util path.

## Maintenance protocol

| Changed | Update |
|---|---|
| Cross-cutting convention or stack pin | this AGENTS.md |
| Stack-specific gotcha | the relevant `.claude/skills/*-tasks/` |
| Product behavior / feature scope | SPEC.md |
| Recurring mistake worth preventing | Encountered Lessons below |

## Three-tier knowledge

AGENTS.md = cross-cutting rules · `.claude/skills/*-tasks/` = per-stack detail (auto-loads on matching
paths) · Encountered Lessons = append-only log of mistakes-not-to-repeat.

## Encountered Lessons

<!-- Append one-liners as you hit non-obvious footguns. Prune stale entries. agentic-init: curated above -->

- (none yet)
