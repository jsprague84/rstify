# Phase 7 Progress — Webhook UX & MQTT Monitoring

## Track A: Webhook UX Improvements

### Phase A1: Bug Fixes & Foundation
- [x] TASK 1: Fix Content-Type header override bug — extracted headers_contain_content_type() helper, both fire functions now check before setting default, unit test added
- [x] TASK 2: Add PATCH and DELETE HTTP methods — added DELETE match arm in both fire functions, PATCH+DELETE to web UI and mobile method pickers
- [x] TASK 3: Request timeout configuration (per-webhook) — migration 022, model/trait/impl updated, per-webhook timeout in reqwest client, UI in both web and mobile create/edit forms
- [x] TASK 4: Follow redirects toggle (per-webhook) — migration 023, model/trait/impl updated, reqwest redirect Policy per-webhook in both fire functions, UI checkbox in web create/edit forms, Switch in mobile create/edit forms
- [ ] TASK 5: Retry config in create form

### Phase A2: Testing & Response Viewer
- [ ] TASK 6: Custom test payload for outgoing webhooks (web only)
- [ ] TASK 7: Full response viewer for webhook tests (web only)
- [ ] TASK 8: Auth presets for outgoing webhooks

### Phase A3: Health & Monitoring
- [ ] TASK 9: Webhook health indicator on list view
- [ ] TASK 10: Response time sparkline (web only)
- [ ] TASK 11: Enhanced delivery log viewer (web only)

### Phase A4: Code Generation & Workflow
- [ ] TASK 12: Copy as curl command
- [ ] TASK 13: Copy as code — Python, JavaScript, Go (web only)
- [ ] TASK 14: Webhook quick-duplicate
- [ ] TASK 15: Inline enable/disable toggle
- [ ] TASK 16: Regenerate webhook token

### Phase A5: Organization & Templates
- [ ] TASK 17: Webhook groups/folders
- [ ] TASK 18: Content-Type selector for outgoing webhooks
- [ ] TASK 19: User-defined template variables

## Track B: MQTT Monitoring & Bridge Management

### Phase B1: Backend Infrastructure
- [ ] TASK 20: Wire BridgeManager into AppState
- [ ] TASK 21: Fix MQTT connections count + enhanced status endpoint

### Phase B2: MQTT UI Improvements
- [ ] TASK 22: Dashboard MqttStatusCard shows disabled state
- [ ] TASK 23: Broker status banner on Bridges page
- [ ] TASK 24: Bridge connection status indicators

### Phase B3: Final Audit
- [ ] TASK 25: Comprehensive implementation audit (all tasks verified across backend, web, mobile)

## Blockers
(none yet)
