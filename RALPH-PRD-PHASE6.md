# rstify Phase 6 PRD — Differentiating Features Beyond Gotify

## Role

You are an expert full-stack engineer working on rstify — the gold-standard self-hosted messaging, automation, and notification platform. rstify is not merely a Gotify replacement; it is the most fully-featured and flexible self-hosted messaging application available, combining and surpassing the capabilities of Gotify, ntfy, Pushover, Apprise, and similar platforms into a single unified system. Its feature set spans push notifications, pub/sub topics, webhooks, scheduled delivery, file attachments, message actions, rich content (markdown/HTML), tagging, retention policies, and extensible automation — all with 100% Gotify API backward compatibility as a baseline, not a ceiling.

You have access to the Context7 MCP tool — use `resolve-library-id` then `query-docs` to look up current documentation for ANY library before implementing. Never guess at APIs — always verify with Context7 first.

## Prerequisites

Phases 1-5 from `RALPH-PRD.md` must be complete before starting this phase. These features build on the hardened, robust foundation established by those phases.

## Instructions

1. Read this entire PRD before starting any work.
2. Check `RALPH-PROGRESS-PHASE6.md` for what has already been completed. If it doesn't exist, create it.
3. Pick the **next uncompleted task** (ordered by number).
4. For each task:
   a. Use Context7 MCP (`resolve-library-id` then `query-docs`) to look up the latest API/docs for any library you will use.
   b. Implement the change following current best practices from the docs.
   c. Run `cargo check` (backend) or `cd web-ui && npm run build` (frontend) or `cd client && npx tsc --noEmit` (mobile) to verify.
   d. Run `cargo test --workspace` if you changed Rust code.
   e. Mark the task complete in `RALPH-PROGRESS-PHASE6.md` with a one-line summary of what was done.
   f. Commit the change with a descriptive message.
5. After completing a task, if you have capacity, continue to the next task.
6. When ALL tasks are complete, output: <promise>PHASE 6 COMPLETE</promise>
7. If you hit a blocker you cannot resolve, document it in `RALPH-PROGRESS-PHASE6.md` under a `## Blockers` section and skip to the next task.

## Quality Standards

- All Rust code must pass `cargo fmt --check` and `cargo clippy --workspace -- -D warnings`.
- All TypeScript must pass `tsc --noEmit` with no errors.
- Do not add unnecessary dependencies. Prefer stdlib/existing deps.
- Do not break Gotify API compatibility.
- Do not break existing tests.
- Every new backend feature should have at least one unit test.
- Use `#[serde(skip_serializing_if = "Option::is_none")]` on all Option fields in response types.
- Commit after each completed task — do not batch multiple tasks into one commit.

---

## Project Structure

```
crates/rstify-core/     — Models, traits, error types
crates/rstify-db/       — SQLite repository implementations
crates/rstify-api/      — Axum routes, middleware, extractors, FCM client
crates/rstify-server/   — Binary entry point, config, startup
crates/rstify-auth/     — JWT, token generation, ACL
crates/rstify-jobs/     — Background jobs (email, scheduled delivery, outgoing webhooks)
web-ui/                 — React 19 + Vite + TailwindCSS web interface
client/                 — React Native (Expo SDK 55) mobile app
migrations/             — SQLite migration SQL files
deploy/                 — Docker Compose, Forgejo CI config
```

---

## Phase 6: Differentiating Features — Beyond Gotify

These features are what separate rstify from every other self-hosted notification platform. Each one closes a gap with ntfy, Pushover, or Apprise and positions rstify as the single platform that replaces them all.

### 6.1 API key scoping / per-token permissions
- New migration: Add `scopes` column to `clients` table (TEXT, JSON array).
- Supported scopes: `read`, `write`, `admin`, `app:<id>` (restrict to specific app).
- Default: `["read", "write"]` for backward compatibility.
- Auth extractor checks scopes — a `write`-only token cannot list messages; a token scoped to `app:5` can only send/read messages for app 5.
- API: Scopes set on client creation (`POST /client`) and update (`PUT /client/{id}`).
- Web UI: Show and edit scopes in Clients page.

### 6.2 Webhook delivery logs
- New table: `webhook_delivery_log` (id, webhook_config_id, message_id, status_code, response_body_preview, duration_ms, attempted_at, success).
- Log every outgoing webhook delivery attempt (including retries).
- New API: `GET /api/webhooks/{id}/deliveries` — list recent delivery attempts with status.
- Web UI: "Delivery Log" expandable section on each webhook showing last 20 attempts with status badges (green/red).
- Auto-cleanup: Delete delivery logs older than 30 days.

### 6.3 ntfy-compatible publish API
- rstify already supports Gotify API. Add ntfy-style publish endpoint for drop-in ntfy compatibility:
  - `PUT /ntfy/{topic}` and `POST /ntfy/{topic}` — publish message.
  - Support ntfy headers: `X-Title`, `X-Priority`, `X-Tags`, `X-Click`, `X-Attach`, `X-Email`, `X-Delay`, `X-Actions`.
  - Map ntfy priority levels (1-5) to rstify priority levels (0-10).
  - Map ntfy tags to rstify tags.
  - Map ntfy actions to rstify message actions.
- This allows existing ntfy clients and integrations (Uptime Kuma, Home Assistant, etc.) to send to rstify without code changes.
- Note: This is a publishing compatibility layer only (not full ntfy server emulation).

### 6.4 CLI client tool
- Create a lightweight CLI tool for sending and receiving messages.
- New crate: `crates/rstify-cli/` with `clap` for argument parsing.
- Commands:
  - `rstify send --title "Alert" --message "Server down" --priority 8 --tag ops`
  - `rstify messages --app 5 --limit 20`
  - `rstify subscribe --topic alerts` (WebSocket listener, prints to stdout)
  - `rstify config --server https://your-server.com --token AP_xxxxx`
- Config stored in `~/.config/rstify/config.toml`.
- Pipe support: `echo "Backup complete" | rstify send --title "Backup"`
- Use Context7 to look up `clap` v4 patterns.
- This enables shell script and cron job integration without curl gymnastics.

---

## Context7 Usage Reminder

Before implementing ANY task, use Context7 MCP to verify current APIs:

```
1. resolve-library-id("axum", "middleware layer tower service")
2. query-docs(<library-id>, "specific question about the API you need")
```

Key libraries to look up:
- **axum** — routes, middleware, extractors, layers
- **sqlx** — query builders, migrations, SQLite specifics
- **serde** / **serde_json** — serialization attributes
- **reqwest** — HTTP client for webhook delivery
- **clap** — CLI argument parsing (v4)
- **react** — hooks patterns (React 19)
- **tailwindcss** — Utility classes for UI components

---

## Completion Criteria

All tasks 6.1-6.4 are implemented, tested, and committed. `RALPH-PROGRESS-PHASE6.md` shows all tasks marked complete. Output:

<promise>PHASE 6 COMPLETE</promise>
