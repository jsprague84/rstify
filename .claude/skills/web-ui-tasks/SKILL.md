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

v3.4 (NOT v4 — different config/engine). `tailwind.config.js` is the source of truth. Do NOT bump to
v4 — it would break the shared-token wiring and (on mobile) NativeWind 4.

## Design system — Coinbase-informed, rstify's own identity

Tokens live in **`shared/design/tokens.cjs`** (single source for web + mobile, wired into
`tailwind.config.js`). The **mobile app is the reference look**; web-ui is being lifted to match it.

- **Use token classes, never hardcoded hex/px.** `bg-primary` · `bg-brand-{50..900}` ·
  `bg-surface-light-card` / `dark:bg-surface-card` · `text-display|heading|title|body|caption` ·
  `rounded-card|field|pill`. Neutrals = Tailwind `slate`. To change a value, edit `tokens.cjs` — never
  a component.
- **Primary is emphasis, not decoration.** One primary action per view; `bg-primary` / `brand-600`
  for CTAs, links, active states — never a page background. Backgrounds are white / `slate-50` (light)
  or `surface-*` (dark).
- **Spacing = 8pt grid** — Tailwind `2/3/4/6/8` (8/12/16/24/32px). Avoid arbitrary `px-[13px]`.
- **Generous rounding, restraint, whitespace** (the Coinbase rhythm). ≤ ~5 hues per screen; semantic
  colors (`success/warning/error/info`) only for status.
- **Every interactive element needs hover + focus-visible + active states.** Don't ship a bare button.
- **Legal firewall:** reproduce Coinbase's layout / palette / rhythm; NEVER lift their wordmark,
  typeface (Coinbase Sans), icon set, or copy. Type identity = system/geometric sans (Inter once loaded).

**Feedback loop (required, not optional):** close a screenshot loop — `vite` dev server + Playwright:
render → look → fix. A desktop screenshot hides responsive + a11y breakage, so **resize to 375px and
tab through / check contrast as a pass condition.** Pixel-matched magic numbers that shatter at mobile
width are the #1 failure mode.

## Done check

`cd web-ui && npm run build` (type-checks + builds).
