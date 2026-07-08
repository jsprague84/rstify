---
name: mobile-tasks
description: rstify mobile conventions — React Native 0.83 + Expo SDK 55 + NativeWind v4 + Zustand/MMKV. NativeWind v4 Pressable+className crashes; use ThemedPressable. Use when editing client/**.
paths: client/**/*.tsx,client/**/*.ts
---

# rstify mobile (RN 0.83 · Expo SDK 55 · NativeWind 4.2 · Zustand 5)

## NativeWind v4 — NOT v5 (load-bearing)

- `View` and `Text` with `className` — safe everywhere.
- **`Pressable` with `className` CRASHES** in v4's CSS interop (NavigationContext blow-up). Use
  `ThemedPressable` or `AnimatedPressable` instead.
- Mobile shared components: `ThemedPressable`, `AnimatedPressable`, `ConfirmSheet`, `FormModal`, `FormInput`.
- Metro config wraps `withNativeWind(config, { input: "./global.css" })`; babel uses `babel-preset-expo`.
  v5 is a separate, incompatible pre-release — do not "upgrade" into it.

## Hooks

`useHubData(fetchFn)` — shared fetch/error/loading for hub screens. Initial load is silent (no Alert);
pull-to-refresh and mutations Alert on failure. `mutate()` reloads after a successful mutation.

## State — Zustand + MMKV

Use `createCache<T>(key)` from `client/src/utils/cache.ts` for MMKV persistence. The cache helpers give
typed `load()` / `save()` / `clear()` — no manual `JSON.parse`/`stringify`.

## Dates

Use `formatLocalTime()` / `formatTimeAgo()` / `formatTimeAgoCompact()` from `shared/utils/time.ts`.
Never render raw SQLite date strings.

## Types

Import API types from the `shared/` package (ts-rs generated) — don't redefine locally.

## Expo SDK 55 notes

- expo-router; `ExpoRequest`/`ExpoResponse` removed in router 55.
- New Architecture; iOS deployment target 15.1; RN range ~0.83.
- `eas update` requires `--environment` in SDK 55+.

## Design system — Coinbase-informed, rstify's own identity

Tokens live in **`shared/design/tokens.cjs`** (single source for web + mobile, wired into
`client/tailwind.config.js`). **Mobile IS the reference look** — keep it clean; refine, don't churn.

- **Use token classes, never hardcoded hex.** `bg-primary` · `bg-brand-{50..900}` ·
  `dark:bg-surface-card` / `bg-surface-light-card` · `text-display|heading|title|body|caption` ·
  `rounded-card|field|pill`. Neutrals = Tailwind `slate`. Change values in `tokens.cjs`, not components.
- **Primary is emphasis, not decoration** — one primary action per screen; `bg-primary` for CTAs /
  active / links, never a screen background. Screens use `bg-slate-50 dark:bg-surface-bg`.
- **Spacing = 8pt grid** (Tailwind `2/3/4/6/8`); generous rounding; restraint; ≤ ~5 hues per screen.
  Semantic colors (`success/warning/error/info`) only for status.
- **Every interactive element uses `ThemedPressable` / `AnimatedPressable`** (never raw
  `<Pressable className>` — crashes on conditional re-render) and needs a press + a visible
  selected/active state.
- **Legal firewall:** reproduce Coinbase's layout / palette / rhythm; NEVER lift their wordmark,
  typeface (Coinbase Sans), icon set, or copy.

**Feedback loop (required):** close a device screenshot loop via adb — `npx expo run:android` (or Metro
+ installed dev client) → `adb exec-out screencap -p > shot.png` → view → fix. Check light **and** dark,
and small-width layout.

## Done check

`cd client && npx tsc --noEmit`.
