# Phase 7 Progress — Webhook UX & MQTT Monitoring

## Track A: Webhook UX Improvements

### Phase A1: Bug Fixes & Foundation
- [x] TASK 1: Fix Content-Type header override bug — extracted headers_contain_content_type() helper, both fire functions now check before setting default, unit test added
- [x] TASK 2: Add PATCH and DELETE HTTP methods — added DELETE match arm in both fire functions, PATCH+DELETE to web UI and mobile method pickers
- [x] TASK 3: Request timeout configuration (per-webhook) — migration 022, model/trait/impl updated, per-webhook timeout in reqwest client, UI in both web and mobile create/edit forms
- [x] TASK 4: Follow redirects toggle (per-webhook) — migration 023, model/trait/impl updated, reqwest redirect Policy per-webhook in both fire functions, UI checkbox in web create/edit forms, Switch in mobile create/edit forms
- [x] TASK 5: Retry config in create form — added max_retries and retry_delay_secs to CreateWebhookConfig model/trait/impl/API, 3-column grid in web and mobile create forms matching edit form layout

### Phase A2: Testing & Response Viewer
- [x] TASK 6: Custom test payload for outgoing webhooks (web only) — backend accepts optional TestWebhookPayload body, web UI shows JSON editor before sending test, API client updated
- [x] TASK 7: Full response viewer for webhook tests (web only) — DetailedWebhookResponse captures headers/body/duration, tabbed Body|Headers view with status badge, duration display, JSON formatting, copy button
- [x] TASK 8: Auth presets for outgoing webhooks — web UI AuthSection component with None/Bearer/Basic/API Key dropdown, auto-detects existing auth from headers on edit; mobile has button picker for None/Bearer/Basic with appropriate inputs

### Phase A3: Health & Monitoring
- [x] TASK 9: Webhook health indicator on list view — list endpoint returns health data (last_delivery_at, success_rate from last 10 deliveries), web shows color-coded Health column with tooltip, mobile shows health dot next to name
- [x] TASK 10: Response time sparkline (web only) — backend returns last 20 durations per webhook, Sparkline.tsx pure SVG polyline component with avg-based color coding, shown in webhook list table
- [x] TASK 11: Enhanced delivery log viewer (web only) — backend adds offset/success filter params, web UI has All/Success/Failed filter buttons, expandable rows, relative time with tooltip, TEST badge, color-coded status, load more pagination

### Phase A4: Code Generation & Workflow
- [x] TASK 12: Copy as curl command — web UI Curl button in actions, mobile code-slash icon button, generates proper curl with method/headers/body for both incoming and outgoing webhooks
- [x] TASK 13: Copy as code — Python, JavaScript, Go (web only) — CodeGenerator component with tab interface for Python/JS/Go code generation, copy button, shown via Code button for outgoing webhooks
- [x] TASK 14: Webhook quick-duplicate — web UI Dup button in list actions, mobile copy-outline icon with Alert.alert confirmation, creates copy with " (copy)" suffix preserving all config fields
- [x] TASK 15: Inline enable/disable toggle — web UI replaced Yes/No text with clickable toggle switch in Enabled column, mobile already had Switch component
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
