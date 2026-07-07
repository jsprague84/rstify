# rstify — Full Audit & Improvement Report

**Date:** 2026-07-07 · **Baseline:** master @ `93bb6ca`
**Method:** four parallel deep-read audits (backend architecture, security, frontend, feature-complexity), the two Critical security findings independently re-verified against source.
**Codebase:** 12,807 LOC Rust (+2,500 tests), 5,490 web-ui, 7,682 mobile, 295 shared · 8 crates · 29 migrations · 196 tests · 21 env vars.

---

## 0. Verdict

This is a **well-kept codebase by self-hosted-server standards** — centralized config with real tests, centralized UTC-`Z` date handling, batched attachment queries, `spawn_blocking` for Argon2, pinned HS256 JWT, constant-time HMAC, correct multi-user isolation, no SQLi, complete OpenAPI registration. The security *foundation* is solid.

But it has **grown past its architecture**. Two structural debts keep generating bugs, and there are **two live, exploitable Critical security holes** plus a cluster of stored-XSS vectors. The single most important architectural fact for your "simplified version" question: **the pure Gotify core is only ~37% of the backend (~4,800 of 12,807 LOC)** and is cleanly severable from everything else.

### Severity dashboard

| Area | Critical | High | Medium | Low/Info |
|---|---|---|---|---|
| Security | 2 | 3 | 9 | 11 |
| Backend arch/quality | — | 4 | 9 | 8 |
| Frontend | — | 1 (crash) | 5 | 6 |

---

## 1. Must-fix-now (verified live issues)

### 1.1 CRITICAL — Outgoing-webhook SSRF with response exfiltration
Any authenticated user who can configure/test an outgoing webhook can read internal services (cloud metadata, loopback, LAN) and see the response verbatim. Five compounding defects:

- **IPv6 validation gap** — `crates/rstify-api/src/utils.rs:57-60`: the V6 arm blocks only `is_loopback()`/`is_unspecified()`. `http://[::ffff:169.254.169.254]/`, `http://[fe80::1]/`, `http://[fd00::1]/` all pass. **(verified)**
- **Validation is config-time only** — `validate_webhook_url` is called at `config.rs:30,241` and `ntfy_publish.rs:293` but **never in the delivery path** (`outgoing_webhooks.rs`), which hands the substituted URL straight to `client.get(&target_url)`. **(verified)**
- **Redirects followed, never re-validated** — `outgoing_webhooks.rs:75-84,281-290` use `Policy::default()` (10 hops); a public host can `302` inward. **(verified)**
- **Template-in-host bypass** — `{{env.KEY}}` is substituted into the URL *after* validation; `http://{{env.TARGET}}/` validates (unresolvable host → DNS-fail-open at `utils.rs:40`) then resolves to attacker-controlled host at delivery. **(verified)**
- **Read-back exfil** — response body (512 chars async / 65536 on the test endpoint) is stored in `webhook_delivery_log` and returned via `GET /api/webhooks/{id}/deliveries` and the test endpoint. SSRF is *not blind*.

**Fix:** move SSRF validation to delivery time on the fully-substituted URL; resolve-and-pin the IP; install a redirect `Policy::custom` re-validating every hop; complete `is_private_ip` for IPv6 (mapped/link-local/ULA/reserved — use `ipnet`/`ip_network` instead of hand-rolling); make DNS failure fail **closed**; forbid templates in the host portion.

### 1.2 CRITICAL — Rate limiter is bypassable *and* a self-DoS
`crates/rstify-server/src/main.rs:270` serves with `axum::serve(listener, app)` — **no** `.into_make_service_with_connect_info::<SocketAddr>()`, so `ConnectInfo` is never inserted. The limiter key (`middleware/rate_limit.rs:76-92`) is: rightmost `X-Forwarded-For` → `ConnectInfo` (never present) → literal `"unknown"`. **(verified both files)**
- **Bypass:** direct clients control `X-Forwarded-For`; rotate it per request → unlimited rate.
- **Self-DoS:** direct clients sending no XFF collapse into one shared `"unknown"` bucket; one client at >10 rps 429s everyone.
- Nullifies the only brute-force protection on login (§1.4).

**Fix:** serve with `into_make_service_with_connect_info::<SocketAddr>()`; only honor XFF behind an explicit `TRUSTED_PROXY` config flag; never collapse un-attributable requests into one bucket.

### 1.3 HIGH — Stored XSS (two vectors, no CSP to blunt them)
- **SVG app icon** — `routes/applications.rs:26` allows `image/svg+xml`; `get_icon` (`:219,252-258`) is **unauthenticated**, served inline with stored `Content-Type` and **no `Content-Disposition: attachment`**. An SVG with `<script>` steals the JWT from `localStorage`. Allowlist is also skipped when the multipart part omits a content-type.
- **`click_url` as raw `href`** — `Messages.tsx:204-215` renders `<a href={m.click_url}>`; ingest (`ntfy_headers.rs:44-45`) stores it with no scheme validation. `X-Click: javascript:…` on an open topic (topics default `everyone_write=true`, `topics/management.rs:38-40`) runs on click.
- **No CSP anywhere** — `lib.rs:55-81` sets `nosniff`/`x-frame-options`/etc. but no `Content-Security-Policy`, so nothing blunts token theft from `localStorage`.

**Fix:** drop SVG icons (or serve `Content-Disposition: attachment` + `application/octet-stream`); reject icon uploads with missing content-type; allowlist `http(s)`/`mailto` on `click_url` at ingest + defense-in-depth in `Messages.tsx`; ship a tuned CSP + HSTS; set `x-xss-protection: 0`.

### 1.4 HIGH — No login brute-force protection
`routes/auth.rs:33-74`: `POST /api/auth/login` is covered only by the (bypassable) global limiter. No per-username throttle/lockout/backoff. Plus a timing oracle: unknown username returns before Argon2 (`:42-47`), valid username runs it (`:49`). **Fix:** dedicated stricter limiter keyed on username+real-IP with lockout; verify against a fixed dummy hash on the unknown-user path to equalize timing.

### 1.5 HIGH — Incoming-webhook `secret` silently ignored for grafana/generic types
`routes/webhooks/config.rs:426-450`: signature verification exists only in the `forgejo|gitea` and `github` arms. `grafana` and the catch-all never read `config.secret`, but the DTO accepts and stores one — users think it's enforced; it isn't. Also: empty/NULL secret fails open even for github/forgejo (`:361-362,395-396`); JSON is parsed *before* verification (refuting the AGENTS.md "HMAC verified before parse" invariant); no replay protection. **Fix:** enforce "secret set ⇒ a signature must pass, else 403"; treat `""` as unset; move parse after verify; add delivery-ID dedupe.

### 1.6 HIGH — Web UI hooks-order crash blanks the page on every outgoing-webhook test
`web-ui/src/pages/Webhooks.tsx:424`: `TestResultDisplay` calls `useState` *after* early returns at `:388-392`. When a test completes, render reaches the hook it didn't call during `loading` → React throws "Rendered more hooks than during the previous render" → ErrorBoundary blanks the page. **Fix:** hoist the `useState` above all returns.

---

## 2. Cross-cutting themes (where the audits converge)

### Theme A — The publish pipeline is the structural heart of the debt
The sequence *create message → policy check → broadcast → outgoing webhooks → FCM* is **copy-pasted at 6–7 sites** and has **diverged into real bugs** (`topics/streaming.rs:34-105`, `ntfy_publish.rs:60-200`, `webhooks/config.rs:452-509`, `messages/crud.rs:66-125`, `mqtt/ingest.rs:110-215`, `mqtt/bridge.rs:230-290`, `main.rs:111-141`):
- Incoming webhooks **never fire outgoing webhooks and never send FCM** (`config.rs:497-509`).
- App-targeted incoming webhooks **broadcast to nobody**.
- Scheduled messages fire outgoing webhooks **at creation time**, then the delivery callback does broadcast+FCM but **not** outgoing webhooks — webhook timing is wrong on both ends.

This is the same root cause as **`message_repo.create()` taking 15 positional args** (`rstify-db/.../message.rs:20-37`) — every feature bolted a param onto the core write path (`create_webhook_config` takes 19, `update` takes 14; adjacent `Option<&str>` swaps compile silently). **Fix both at once:** extract a single `MessagePublisher::publish(NewMessage, PublishOpts)` with a `NewMessage`/`NewWebhookConfig` parameter struct (`Default`-able). All seven sites become one-liners and the drift bugs disappear.

### Theme B — Outgoing webhooks are simultaneously the highest-value feature and the most broken
This is the "webhook shortcuts → automation" subsystem you specifically want to keep/extend. Today it carries: the Critical SSRF (§1.1), a **UTF-8 truncation panic** in the synchronous test path (`outgoing_webhooks.rs:374` byte-slices at 512), a **new `reqwest::Client` built per delivery** (TLS handshake churn), **unbounded fire-and-forget retry tasks** (3 retries × 60s, no cancellation, no concurrency cap), **swallowed errors** that send unsubstituted `{{env.KEY}}` on a DB hiccup (`:27-33`), the web-UI hooks crash (§1.6), and a **null-payload edit bug** that wipes the HMAC secret on any save (`Webhooks.tsx:1008`). If you build the simplified version, this is the subsystem to redesign from scratch, not port.

### Theme C — "Validate once, act later" TOCTOU pattern
SSRF (§1.1), the `X-Attach` fetch (`ntfy_publish.rs` validates initial URL then follows redirects unbounded, buffers full body before size check), template substitution — all share the shape *check at config/parse time, use a different value at action time*. Worth a codified rule: **validate at the moment of the side effect, on the exact value used.**

### Theme D — Silent product drift (configured behavior that does nothing)
- **`should_notify` is never called** (`policy.rs:4-16`): the API validates and stores migration-020 notify-policy fields; the web UI exposes them; **no delivery path honors them.** A user setting "never notify" on a topic still gets pushes. FCM gating uses only `should_inbox`.
- `store_policy` honored only by MQTT ingest, ignored by all HTTP publishers.
- `on_change`/`digest` policy modes are stubbed to `true`.
- Mobile **unread counts are fiction** (`store/messages.ts:82` sets `unreadCount = messages.length`; every fetch wipes read state).

### Theme E — No missed-message recovery on WebSocket reconnect
Both frontends reconnect with backoff but **never refetch what was published during the disconnect** (`useMessageStream.ts:31-34` web; `useWebSocket.ts` mobile gives up permanently after 50 retries). Badge says "Live"; messages silently vanish. **Fix:** `onReconnect` → reload `since=<newest id>`.

### Theme F — Quantified dead weight
`moka` (workspace dep, zero references) · `jobs/webhooks.rs::execute_webhook` (never called) · `up_registrations` table (migration 012, zero Rust references — UnifiedPush never built) · 4 dead repo methods (`list_scheduled_due`, `delete_expired_messages`, `list_expired_attachments`, `mark_delivered`) · duplicate index `idx_topic_permissions_user` (013 dupes 009) · `tmp_rate_limit_probe.rs` (self-labeled "delete after audit") · `web-ui/src/pages/Docs.tsx` (459 lines hand-duplicating `/docs` Swagger).

---

## 3. Backend findings (condensed, beyond §1–2)

| # | Sev | Finding | Location | Fix |
|---|---|---|---|---|
| B1 | High | `rstify-api → rstify-mqtt` drags a **second full web stack** (axum 0.7.9 + hyper 0.14 + 3× tungstenite + 7 RUSTSEC advisories) into the most-edited crate | `rstify-api/Cargo.toml`, `state.rs:5` | Invert the dep: `BridgeControl` trait in core, mqtt implements, only `rstify-server` wires them |
| B2 | Med | Every sqlx error stringified to `CoreError::Database(String)` (81×) — unique-violation surfaces as 500 not 409 | pervasive | `impl From<sqlx::Error> for CoreError` inspecting `is_unique_violation`/`RowNotFound`; collapse 81 sites to `?` |
| B3 | Med | Repository-trait layer (367 lines) has one impl each, stores concrete types in `AppState`, and is bypassed by jobs/handlers going raw sqlx — abstraction cost with no payoff | `rstify-core/src/repositories/` | Either commit to traits or delete them and enforce "no raw sqlx outside rstify-db" |
| B4 | Med | Orphaned attachment **files** on message delete — `ON DELETE CASCADE` removes rows, nothing removes files at `storage_path` | `migrations/007`, `cleanup.rs:45-50` | Collect paths before delete + unlink, or add orphan-sweep to cleanup job |
| B5 | Med | Missing `messages(created_at)` index (used by search/count/retention scans); duplicate `idx_topic_permissions_user` | `message.rs:203-216`, `migrations/013:6` | Migration 030: add one index, drop the dup |
| B6 | Med | Blocking DNS (`ToSocketAddrs`) inside async handlers | `utils.rs`, `webhooks/config.rs:29-31` | `spawn_blocking` or `tokio::net::lookup_host` |
| B7 | Med | Shutdown waits for nothing — job `JoinHandle`s dropped, 2 main.rs loops uncancellable, webhook retries (≤3min) lost silently, MQTT on detached threads | `jobs/lib.rs:36-64`, `main.rs:274` | Store handles, `join_all` w/ timeout after cancel; thread cancel token into retry tasks |
| B8 | Low | `rstify-jobs` mixes periodic-loop runner with synchronous delivery library (why api+mqtt both depend on "jobs" without running jobs) | — | Split delivery into `rstify-delivery` |
| B9 | Low | Only one transaction in the codebase; publish+attach is non-atomic (crash leaves message with advertised-but-missing attachment) | `ntfy_publish.rs:94-165` | Wrap publish+attach in a tx |
| B10 | — | AGENTS.md says "230+ tests"; actual is **196**. CLI has 0 tests; all 5 job loops, FCM, SSE/WS, attachments untested | — | Truth-up docs; unit-test retention + scheduled-delivery (harness makes it trivial) |

**Positives (leave alone):** the `to_utc_z()`/`ser_utc_z` date helper is centralized and tested (not copy-pasted) · attachment enrichment is batched (`IN (...)`, not N+1) · no unguarded unwraps in request paths · Argon2 on `spawn_blocking` · WS `Lagged` handled · `Arc<MessageResponse>` fan-out · the integration test harness (`tests/common/`) is actively used by 8/10 files — **do not delete it** despite the `dead_code` warnings (standard Rust idiom for shared integration modules).

---

## 4. Security findings (condensed, beyond §1)

| # | Sev | Finding | Location |
|---|---|---|---|
| S1 | Med | No WS/SSE connection cap — `active_count()` never enforced; open thousands → fd/mem exhaustion | `websocket/manager.rs:55-73` |
| S2 | Med | `X-Attach` fetch buffers full remote body before size check; unbounded/untimed `reqwest::get` | `ntfy_publish.rs:299-331` |
| S3 | Med | Token accepted in `?token=` query string (leaks to proxy logs/history/Referer) | `extractors/auth.rs:96-102` |
| S4 | Med | 90-day JWT, no revocation; password change doesn't invalidate. (Good: `is_admin` re-checked from DB, so demotion is immediate) | `rstify-auth/src/tokens.rs:42-63` |
| S5 | Low/Med | FTS5 `MATCH` takes raw input — malformed query (`"`, `AND`) → syntax error → 500 (error-based DoS; safely bound, no SQLi) | `message.rs:187-190` |
| S6 | Low | Default `admin/admin` seeded, only a warning logged, no forced rotation | `main.rs:32-43` |
| S7 | Low | `/metrics` unauthenticated (request/message/WS counts) | `routes/health.rs:60` |
| S8 | Low | Body-limit inconsistency: global 1 MiB layer < 25 MiB `max_attachment_size` < documented "10 MB" — inline uploads >1 MiB silently rejected | `lib.rs:42`, `config.rs:124` |
| S9 | Low | Webhook variables stored plaintext, returned in full by list API (intended to hold secrets) | `migrations/025`, `webhook_variables.rs:22` |
| S10 | Low | Outgoing-webhook `timeout/retries/delay` unclamped — large `max_retries` amplifies one message into many requests | `webhooks/config.rs:79-82` |
| S11 | Low | Client scope `can_access_app` fails open with no `app:` scopes; malformed JSON → `unwrap_or_default` (contained to one user) | `models/client.rs:37-50` |

**Verified positives (no action):** Argon2id w/ OWASP params on `spawn_blocking` · HS256 pinned, `exp` validated, `alg=none` rejected, secret required ≥32 bytes · incoming-webhook HMAC comparison is constant-time (`signature.rs:30-38`) · `{{env.KEY}}` reads **only** the per-user `webhook_variables` table, **not** process env (no AGENTS.md violation — though the `env.` name is misleading, consider renaming) · multi-user isolation correct across messages/apps/clients/topics/webhooks/attachments (no IDOR except the public icon) · no SQLi · attachment path-traversal prevented (`sanitize_filename` + UUID prefix) · markdown body is safe (`rehypeSanitize`, no `rehype-raw`).

**AGENTS.md truth-ups needed:** "HMAC verified before JSON parse" is **refuted** (parse runs first, `config.rs:352-353`) · "10 MB attachment limit" is actually 25 MiB default, effectively 1 MiB via the global body layer.

---

## 5. Frontend findings (condensed, beyond §1.6)

**Web UI** — architecture is genuinely good for 5.5k LOC (clean pages/components/hooks/api split, right-sized Context, consistent `useCrudResource`+`FormModal`). The debt is concentrated:

| # | Sev | Finding | Location |
|---|---|---|---|
| F1 | Med | Search race, no debounce — overlapping responses clobber `setMessages` out of order | `Messages.tsx:89-104` |
| F2 | Med | `scheduled_for` sent as zone-less local time → scheduled sends fire hours off for non-UTC users | `Topics.tsx:413,436` |
| F3 | Med | Null-payload edits wipe credentials/secrets (bridge creds, webhook HMAC secret) on any save | `Bridges.tsx:63-64`, `Webhooks.tsx:1008` |
| F4 | Med | No missed-message catch-up on reconnect (Theme E) | `useMessageStream.ts:31-34` |
| F5 | Low | `relativeTime()` reimplements `formatTimeAgo`, skips `normalizeUtcDate` (bare SQLite date parsed as local) — violates the "only time-util source" rule | `Webhooks.tsx:862-872` |
| F6 | Low | Raw date render of `version.buildDate` | `Dashboard.tsx:109` |
| — | — | `Webhooks.tsx` is **1,234 lines / 22% of the app** (9 components, 5 modals); `Docs.tsx` (459) duplicates Swagger; message-card JSX duplicated 3× | — |

Root-cause enabler for F3: the Rust `Update*` DTOs force explicit nulls (callers write 13-field null blocks). Mark them `#[ts(optional)]` + `#[serde(skip_serializing_if = "Option::is_none")]` and both the ergonomics and the clear-on-save bug class disappear.

**Mobile (top 5):** healthier than the 40%-parity number suggests (clean Zustand+MMKV, `useHubData` mirrors `useCrudResource`, markdown works). Issues: (1) `hub/webhooks.tsx` 815 lines / ~40 `useState`; (2) unread counts are fiction (Theme D); (3) fragile realtime bootstrap grabs arbitrary `clients[0].token`, permanent give-up after 50 retries; (4) silent `catch {}` in `store/messages.ts:163`; (5) 8 remaining `<Pressable className>` NativeWind-v4 crash sites + raw dates (`MessageBubble.tsx:46`).

---

## 6. Feature inventory & the "simplified version" decision

### 6.1 What's actually in here (severability)

| Feature | LOC | Severable? | Keep in a lite build? |
|---|---|---|---|
| **Gotify core** (users/apps/clients/messages, auth, `/stream`, health) | ~4,600 | — (the keeper) | **Yes — the product** |
| Incoming webhooks (+ forgejo/github/grafana parsers, HMAC) | ~1,180 | Cleanly | **Yes** — the "shortcut → automation" story |
| Outgoing webhooks + variables | ~1,010 | Cleanly | **Yes** — but redesign, don't port (Theme B) |
| Topics + permissions + notify/inbox policy | ~1,220 | With schema edit | Cut — the complexity engine (drags ntfy, SSE, ACL, 8 policy cols) |
| ntfy compat layer | ~580 | Drags topics | Cut (auth-required anyway, not true drop-in) |
| **MQTT** (broker/ingest/publisher/bridges) | ~1,450 | **Cleanest big win** | **Cut first** — 2 broker crates + all 7 RUSTSEC advisories, already a deprecation candidate |
| FCM push | ~400 | Cleanly | Optional (only if mobile ships) |
| UnifiedPush | **0 code** | Vestigial | Delete migration 012 |
| SMTP | ~120 | Cleanly | Cut (whole `lettre`/native-tls tree for one ntfy header) |
| Attachments | ~500 | Degrades gracefully | Optional |
| FTS5 search | ~115 | Cleanly | Cheap keep (zero deps) |
| Expiry/retention/scheduled/inbox | ~350 | Partially (inbox is stickiest) | Keep retention; drop the rest unless mobile needs |
| Client scopes / settings / stats / CLI | ~480 | Trivially | Keep CLI (users love it, zero coupling) |

**Config surface:** 62% of env vars (13/21) belong to three optional integrations (MQTT 6, SMTP 5, FCM 2). A lite core needs 1 required + ~5 optional.

### 6.2 The two paths

**Path A — Prune in place.** Delete MQTT + UnifiedPush + SMTP + ntfy-compat + dead code, fix the criticals. Gets ~12.8k → ~7–8k LOC, kills all 7 RUSTSEC advisories and the duplicate axum/hyper stack, keeps the working app and its 196 tests. Mostly deletion — low risk, ~1–2 days.

**Path B — Greenfield `rstify-lite`.** Clean 2–3 crate design (not 8), one query layer, `MessagePublisher`/`NewMessage` done right from day one. Feature inventory estimate: **~3,000–3,500 LOC** for Gotify-core, **~5,000–5,500** with the two webhook extensions — vs today's 12,800, with `rumqttd`/`rumqttc`/`lettre`/`humantime`/`tungstenite` gone. UI drops from 11 screens to **5**: Login · Inbox (the live stream — the only screen that needs polish) · Sources (merged Applications+Topics) · Tokens (Clients) · Settings (account + admin accordion).

### 6.3 Recommendation — sequence, don't pick

1. **Fix the criticals now** (§1) regardless of path — they're live, small diffs, and the SSRF + XSS + rate-limiter are the kind of thing you don't leave running on a homelab box reachable from anywhere.
2. **Prune MQTT + dead weight** (Path A subset) — deletion, kills the CVEs and the duplicate web stack in one move, de-risks the decision by letting you *see* the clean core.
3. **Then decide greenfield vs keep** from a ~7k-LOC baseline. Given your goals (clean, Rust, webhook-automation-first) and that the killer feature you want is exactly the subsystem that's most broken today, **Path B is attractive** — but only worth it if you build the one thing this app got wrong from the start: a single `MessagePublisher` so features stop accreting onto a 15-arg function. If you do Path B, lift the web-UI foundation (`useCrudResource`, `useMessageStream`, `FormModal`, `api/client.ts`) unchanged — the complexity lives in the pages, not the foundation.

The "webhook shortcuts → trigger automations" idea is the right north star for the extended-beyond-Gotify story. Build it on delivery-time SSRF validation, a persistent outbox (you already have `webhook_delivery_log` — a `pending` state makes retries survive restarts), and clamped retry/timeout knobs.

---

## 7. Prioritized roadmap

**P0 — live security (do first, any path)**
1. Rate-limiter keying (§1.2) — `into_make_service_with_connect_info` + trusted-proxy flag. Small diff, high impact.
2. Outgoing-webhook SSRF end-to-end (§1.1) — delivery-time validation, IP pinning, redirect re-validation, IPv6 completion, DNS fail-closed.
3. XSS cluster (§1.3) — drop/neuter SVG icons, allowlist `click_url` schemes, ship CSP + HSTS.
4. Login throttle + timing equalization (§1.4).
5. Enforce incoming-webhook signatures where a secret is set (§1.5).

**P1 — structural bug-factory & correctness**
6. Extract `MessagePublisher` + `NewMessage`/`NewWebhookConfig` structs (Theme A) — fixes the three publish-drift bugs and the 15/19-arg constructors together.
7. Fix the web-UI hooks crash (§1.6) and the null-payload secret-wipe (F3, via optional DTOs).
8. Wire `should_notify` into the delivery path or delete the fields (Theme D).
9. Reconnect catch-up on both frontends (Theme E).
10. Attachment file lifecycle + `X-Attach` streaming cap (B4, S2).

**P2 — decoupling & cleanup**
11. Invert `rstify-api → rstify-mqtt` (B1), then cut MQTT + dead weight (Theme F).
12. `impl From<sqlx::Error> for CoreError` (B2); index migration 030 (B5); `spawn_blocking` DNS (B6).
13. Shutdown that waits (B7); clamp webhook knobs (S10); connection caps (S1).
14. Doc truth-ups: AGENTS.md "230+ tests" → 196, "HMAC before parse" refuted, "10MB" → 25MiB/1MiB; split `Webhooks.tsx`; replace `Docs.tsx` with a link to `/docs`.
