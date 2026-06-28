---
name: web-ui-tasks
description: rstify web UI conventions — React 19 + Vite 6 + Tailwind 3. Hooks own async, pages own layout; shared FormField/FormModal; all HTTP via client.ts; dates via shared time utils. Use when editing web-ui/**.
paths: web-ui/**/*.tsx,web-ui/**/*.ts
---

# rstify web UI (React 19 · Vite 6 · TailwindCSS 3.4)

## Hooks own async, pages own layout

- `useCrudResource(fetchAll)` — list lifecycle (load, reload, error, mutations). `fetchAll` MUST be
  wrapped in `useCallback` or it infinite-loops.
- `useAsyncAction<T>()` — one-off async ops (loading + error).
- Pages MUST NOT use `try-catch` for API calls or `useState` for loading/error — the hooks own that.

## Shared components

- `FormField` — label + input/select/textarea/checkbox + error display.
- `FormModal` — Modal + submission + loading/error, auto-closes on success.
- All HTTP goes through `web-ui/src/api/client.ts` — no raw `fetch()` in pages.

## Dates

NEVER render raw date strings (`{m.date}`). Use `formatLocalTime()` / `formatTimeAgo()` from
`shared/utils/time.ts`. DataTable date columns need a `render` fn: `render: u => formatLocalTime(u.created_at)`.

## Types

Import API types from the `shared/` package (ts-rs generated from Rust DTOs) — don't redefine them
locally. If a type is missing, it needs `#[ts(export)]` on the Rust struct + `just generate-types`.

## Markdown

react-markdown 10 + remark-gfm + rehype-sanitize. Honors Gotify `client::display` `text/markdown`.

## Tailwind

v3.4 (NOT v4 — different config/engine). `tailwind.config.js` is the source of truth.

## Done check

`cd web-ui && npm run build` (type-checks + builds).
