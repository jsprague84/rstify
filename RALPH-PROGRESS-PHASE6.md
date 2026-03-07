# rstify Phase 6 Implementation Progress

## Phase 6: Differentiating Features
- [x] 6.1 API key scoping / per-token permissions — scopes column on clients, read/write/admin/app:ID enforcement in auth extractor, web UI scope editor
- [x] 6.2 Webhook delivery logs — delivery_log table, logging in outgoing webhooks, GET /api/webhooks/{id}/deliveries, 30-day auto-cleanup, web UI log viewer
- [x] 6.3 ntfy-compatible publish API — /ntfy/{topic} routes, ntfy priority mapping (1-5 to rstify 0-10), ntfy action parsing, 4 unit tests
- [ ] 6.4 CLI client tool

## Blockers
(none yet)
