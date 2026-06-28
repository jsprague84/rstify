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

## Done check

`cd client && npx tsc --noEmit`.
