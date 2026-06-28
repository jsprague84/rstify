# rstify — Product Spec

> What rstify does and why. Coding conventions live in AGENTS.md; this file tracks product behavior
> and feature scope. Keep entries at the behavior level, not the implementation level.

## What it is

A self-hosted, Gotify-API-compatible push-notification server with a web UI and a native mobile app.
Drop-in for Gotify clients, plus features Gotify lacks (topics/pub-sub, webhooks, attachments, tags).

## Core surfaces

- **Backend** — Axum REST API + WebSocket stream + MQTT ingest/publish + OpenAPI at `/docs`.
- **Web UI** — React dashboard: apps, messages, topics, webhooks, users.
- **Mobile** — React Native/Expo app with FCM push.

## Shipped

<!-- Move features here once live. One line each: behavior, not code. -->

- Gotify-compatible message API (apps, messages, clients, extras: `client::display`/`notification`, `android::action`).
- Topics (pub-sub), incoming + outgoing webhooks (HMAC, `{{env.KEY}}` templating), file attachments, tags.
- JWT auth (Argon2), rate limiting, CORS, security headers.
- MQTT bridge with anti-loop guards; FCM/SMTP optional integrations.

## In progress

- Mobile Gotify-parity overhaul (markdown, click_url, icon_url, actions). See memory `project_mobile_overhaul`.

## Deferred / ideas

- Plugin system (Gotify has one; rstify doesn't yet).
- Forgejo webhook parsing + Uptime Kuma monitor notifications.

## Non-goals

- Breaking Gotify API compatibility for any new feature.

<!-- agentic-init: spec skeleton — flesh out per feature; /audit-spec-drift checks this against code -->
