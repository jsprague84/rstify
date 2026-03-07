# rstify PRD Implementation Progress

## Phase 1: Critical Security Fixes
- [x] 1.1 Remove exposed credentials from Git tracking — already untracked and .gitignore covers .env, firebase, google-services
- [x] 1.2 SSRF protection for outgoing webhooks — validate_webhook_url blocks private/loopback/link-local/CGN IPs on create and update
- [x] 1.3 Fix CORS defaults — default to same-origin when CORS_ORIGINS unset
- [x] 1.4 Add security headers middleware — X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy
- [x] 1.5 Fix rate limiter memory leak — remove entries inactive >10min instead of inverted token check
- [x] 1.6 Add JSON field size limits for webhooks — template 64KB, headers 8KB on create and update

## Phase 2: Backend Robustness & Missing Features
- [x] 2.1 Fix webhook config update for outgoing fields — target_url, http_method, headers, body_template, max_retries, retry_delay_secs
- [x] 2.2 Add message update API — PUT /message/{id} with ownership check
- [x] 2.3 Add message search/filter API — FTS5 + query params (q, tag, priority, since, until, appid)
- [x] 2.4 Add batch operations — DELETE /message/batch and /message/all with ownership checks
- [x] 2.5 Add message retention policies — per-app retention_days with hourly cleanup job
- [x] 2.6 Optimize topic visibility query — single SQL JOIN replacing N+1 pattern
- [x] 2.7 Add health check endpoint — version in /health response + Dockerfile HEALTHCHECK
- [x] 2.8 Improve FCM initialization logging — error on incomplete config, info when disabled

## Phase 3: Web UI Improvements
- [x] 3.1 Add error boundary component — wraps app with retry UI
- [x] 3.2 Add toast notification system — replaced all alert() calls with toast
- [x] 3.3 Add topic editing — PUT /api/topics/{name} with edit modal in web UI
- [x] 3.4 Add 404 catch-all route — NotFound component with link to dashboard
- [x] 3.5 Add WebSocket connection indicator — green/yellow/red status in Messages header
- [x] 3.6 Webhook template help — collapsible template variables reference
- [x] 3.7 Improve DataTable for large datasets — pagination (25/page) + column sorting

## Phase 4: Mobile App Improvements
- [x] 4.1 Clean up dead code — removed MessageCard.old.tsx, fixed React import
- [x] 4.2 Fix theme consistency in MessageContent — useTheme() store
- [x] 4.3 Add WebSocket exponential backoff — 1s-30s, 50 max retries, connection status
- [x] 4.4 Add connection status indicator — colored dot in header
- [x] 4.5 Add message pagination (infinite scroll) — fetchOlderMessages + FlatList onEndReached
- [x] 4.6 Add request timeout to API client — 15s AbortController timeout

## Phase 5: DevOps & Documentation
- [x] 5.1 Update .env.example with all variables — all env vars documented
- [x] 5.2 Add Dockerfile HEALTHCHECK — done in Task 2.7
- [x] 5.3 Create comprehensive ENV reference doc — docs/CONFIGURATION.md
- [x] 5.4 Create backup/restore guide — docs/BACKUP.md
- [x] 5.5 Add Prometheus metrics endpoint — GET /metrics with requests, messages, ws connections

## Blockers
(none yet)

## Notes
- Phase 6 (differentiating features) is tracked separately in RALPH-PRD-PHASE6.md and RALPH-PROGRESS-PHASE6.md
