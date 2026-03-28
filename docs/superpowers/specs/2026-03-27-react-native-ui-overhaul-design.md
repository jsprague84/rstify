# React Native UI Overhaul — Design Spec

**Date:** 2026-03-27
**Approach:** Clean Slate Rebuild (Big Bang)
**Scope:** Information architecture restructure, tech stack modernization, animation layer, feature parity

## 1. Problem Statement

The rstify mobile app treats all features with equal visual weight. Webhooks, MQTT config, and app management occupy the same tab-level prominence as the daily messaging experience. With 5 tabs already at the mobile maximum, the UI feels cluttered as features accumulate. Topics mix 12+ MQTT topics with regular messaging topics in a flat list.

The app is technically sound (clean TypeScript, good WebSocket architecture, Zustand state management) but lags behind modern mobile standards in animation, gestures, typography, and progressive disclosure.

**Goal:** Rebuild the mobile UI as a clean, information-dense messaging app with progressive disclosure — daily features front-and-center, power tools one tap deeper. Simultaneously modernize the tech stack to current best-in-class libraries.

## 2. Information Architecture

### Current: 5 Equal Tabs (Flat)
```
Messages | Topics | Apps | Webhooks | Settings
```
All features at the same level. No grouping, no hierarchy. MQTT topics mixed with messaging topics. Config tools given equal weight to daily messaging.

### New: 3-Tab Progressive Disclosure
```
Inbox | Channels | Hub
```

#### Inbox (Tab 1) — The Daily Driver
Primary screen, used 95% of the time. Messages grouped by source (app or topic).

**Two view modes** toggled by segmented control:
- **Grouped (default):** Messages collapsed by source. Shows app/topic icon, name, latest message preview, unread count, timestamp. Sorted by most recent activity. Tap a group to drill into the message thread for that source.
- **Stream:** Chronological flat list with source icons. Same data, different layout. For users who prefer the current Messages page behavior.

**Message thread (drill-down):** Full message detail for a single source. Shows all messages from that app/topic with markdown rendering, action buttons, priority coloring, big images, attachments. Uses Legend List with bottom-alignment for chat-like scroll behavior.

**Interactions:**
- Swipe left: Delete message/group
- Swipe right: Mark read / archive
- Long press: Zeego native context menu (delete, copy, share, mute source)
- Pull down: Animated refresh
- Segmented toggle: Switch Grouped / Stream views

#### Terminology: Channel vs Topic
A **Topic** is the backend data model (from the rstify/Gotify API). A **Channel** is the UI presentation of a Topic in the mobile app. The Channels tab displays Topics organized in folders. The rename is purely cosmetic — the API model remains `Topic`. Think of it as: Topics are the data, Channels are how you browse them.

#### Channels (Tab 2) — Topic Organization
Topics organized in collapsible folders with pinning.

**Folder types:**
- **Pinned:** User-pinned topics float to top. Green dot = live subscription.
- **User folders:** User-created groups (e.g., "Home Automation", "CI/CD"). Long-press topic → "Move to folder". Persisted in MMKV (no backend changes).
- **MQTT Topics:** Auto-grouped folder, collapsed by default. The 12+ MQTT topics stay hidden unless expanded.
- **Other:** Ungrouped topics.

**Interactions:**
- Tap topic → Message thread (same drill-down as Inbox)
- Toggle "Live" to stream real-time messages
- Publish button for writable topics
- FAB to create new topic
- Long press: Zeego context menu (edit, pin, move to folder, delete)

#### Hub (Tab 3) — Power Tools Dashboard
Everything else, categorized.

**Layout:**
- **User header:** Avatar, username, role, server URL
- **Integrations grid (2x2):** Apps (count), Webhooks (count), MQTT (status), Clients (count). Each taps into full management screen.
- **Account section:** Change password, notifications, appearance (theme selector)
- **Admin section (conditional):** User management, server info. Only visible for admin role.
- **Footer:** Version, logout

Each integration tile drills into the same full CRUD screens that exist today — Apps management, Webhook builder, MQTT config, Client management (connected API clients and their tokens). The functionality is preserved, just reorganized one tap deeper.

### Expo Router File Structure

Current:
```
app/
├── _layout.tsx
├── login.tsx
└── (tabs)/
    ├── _layout.tsx          # 5-tab layout
    ├── index.tsx            # Messages
    ├── apps.tsx
    ├── topics.tsx
    ├── webhooks.tsx
    └── settings.tsx
```

New:
```
app/
├── _layout.tsx
├── login.tsx
└── (tabs)/
    ├── _layout.tsx          # 3-tab layout (Inbox, Channels, Hub)
    ├── index.tsx            # Inbox (grouped/stream)
    ├── channels.tsx         # Channels (topic folders)
    └── hub.tsx              # Hub (tools dashboard)
├── thread/
│   └── [sourceId].tsx       # Message thread drill-down (shared by Inbox + Channels)
├── hub/
│   ├── apps.tsx             # App management
│   ├── webhooks.tsx         # Webhook builder
│   ├── mqtt.tsx             # MQTT config/status
│   ├── clients.tsx          # Client/token management
│   ├── users.tsx            # Admin: user management
│   └── settings.tsx         # Account settings
```

### Zustand Store Restructuring

The current `messagesStore` is a flat array. The grouped Inbox requires:

```typescript
// New store shape
interface MessagesStore {
  // Grouped index: sourceId → messages (sorted by date desc)
  groupedMessages: Map<string, Message[]>;
  // Source metadata: sourceId → { name, icon, unreadCount, latestTimestamp, sourceType }
  sourceMeta: Map<string, SourceMeta>;
  // View mode toggle
  viewMode: 'grouped' | 'stream';
  // Flat list for stream mode (derived from groupedMessages)
  streamMessages: Message[];
  // Actions
  addMessage(msg: Message): void;    // Inserts into correct group
  deleteMessage(id: number): void;
  deleteGroup(sourceId: string): void;
  markGroupRead(sourceId: string): void;
  setViewMode(mode: 'grouped' | 'stream'): void;
}
```

Source ID format: `app:{appId}` or `topic:{topicId}` to namespace grouping.

## 3. Tech Stack

### Upgrades
| Layer | Current | New | Rationale |
|-------|---------|-----|-----------|
| Framework | RN 0.83.2 / Expo SDK 55 | **Keep RN 0.83.x / Expo SDK 55** | Expo SDK pins the RN version; upgrading RN independently breaks expo-* packages. Upgrade to RN 0.84 when Expo SDK 56 ships. |
| Styling | StyleSheet (manual) | **NativeWind v5** | Tailwind parity with web UI, build-time compiled, `dark:` variants |
| Lists | FlatList | **Legend List v2** | Chat UI mode, bidirectional infinite scroll, dynamic sizes, pure JS |
| Markdown | react-native-markdown-display | **react-native-enriched-markdown** | Native text selection, VoiceOver/TalkBack, C-based parser |
| Storage | AsyncStorage + SecureStore | **MMKV** | 30x faster, sync API, AES-256 encryption, consolidates two deps |
| Context Menus | Custom modals | **Zeego** | Native platform menus, highest benchmark score (92.4) |
| Animations | Reanimated 4.2.1 (installed, unused) | **Reanimated 4** (adopt fully) | Already installed. Adopt CSS Animations API, shared values, layout animations. |
| Gestures | Gesture Handler 2.30 (installed, underutilized) | **Gesture Handler v2** (adopt Composition API) | Already installed. Adopt `Gesture.*` composition patterns for swipe-to-delete, multi-gesture. |

### Keep Unchanged
- **Zustand 5** — State management (already best-in-class)
- **Expo SDK 55 / RN 0.83.x** — Platform (latest, Expo pins RN version)
- **Expo Router** — Navigation (file-based routing)
- **expo-notifications** — Push notifications
- **expo-image** — Image rendering/caching
- **expo-haptics** — Haptic feedback
- **react-native-toast-message** — Toast notifications

### Remove
- `@react-native-async-storage/async-storage` — Replaced by MMKV
- `expo-secure-store` — Replaced by MMKV (encrypted)
- `react-native-markdown-display` — Replaced by enriched-markdown

### Migration: SecureStore/AsyncStorage → MMKV
Existing users have JWT tokens in `expo-secure-store` and theme preferences in `AsyncStorage`. Phase 1 must include a one-time migration step:
1. On app launch, check if MMKV has auth data. If not, read from SecureStore and AsyncStorage.
2. Write values to MMKV (encrypted instance for auth, standard for preferences).
3. Clear old stores.
4. Remove old dependencies only after migration code ships in at least one release.

This ensures existing users don't lose authentication on upgrade.

## 4. Design System

Established upfront via NativeWind `tailwind.config.js`. Every screen built on these tokens.

### Typography Scale
- **Display:** 28px, weight 800, -0.5 tracking (screen titles)
- **Heading:** 18px, weight 700 (section headers, source names)
- **Body:** 14px, weight 400, 1.5 line-height (message content)
- **Caption:** 11px, weight 400, 0.5 opacity (timestamps, metadata)
- **Code:** 12px, monospace, subtle background (inline code)

### Color Tokens
Semantic colors via NativeWind theme:
- `primary` (blue #3b82f6), `success` (green #22c55e), `warning` (orange #f59e0b), `error` (red #ef4444), `accent` (purple #8b5cf6), `info` (cyan #06b6d4)

Surface hierarchy (dark mode):
- `bg` (#0f172a), `surface` (#1e293b), `elevated` (#334155), `overlay` (#475569)

Priority border colors for message cards:
- 1-3: gray (#6b7280), 4-5: blue (#3b82f6), 6-7: orange (#f59e0b), 8-10: red (#ef4444)

### Dark Mode
NativeWind `dark:` variant. System preference via React Native `Appearance` API. User override persisted in MMKV. No manual theme context — NativeWind handles it.

## 5. Animation Layer

### Screen Transitions
- **Tab switch:** Crossfade with subtle slide (200ms, easeOut)
- **Drill-down:** Shared element transition — source icon/title animates from list to header
- **Modal:** Spring-driven slide-up with backdrop fade

### List Animations
- **Initial load:** Staggered fade-in (items appear sequentially, 50ms delay each)
- **New message:** Slide-in from top with spring bounce
- **Delete:** Swipe reveals red zone, item slides out + height collapses via layout animation
- **Reorder:** Layout animation when items shift position

### Micro-Interactions
- **Button press:** Scale 0.97 + haptic (Light)
- **Card press:** Scale 0.98 + subtle shadow change
- **Toggle:** Spring-animated thumb with color transition
- **Badge count:** Scale-pop when count changes
- **FAB:** Spring entrance from bottom on screen mount

### Loading States
- **Skeleton shimmer:** Content-shaped placeholders with shimmer animation (replaces ActivityIndicator)
- **Pull-to-refresh:** Custom animated indicator
- **Connection status:** Animated dot pulse (green=live, yellow=reconnecting, red=disconnected)

## 6. Feature Parity

### Gaps Closed
| Feature | Implementation |
|---------|---------------|
| Broadcast actions | expo-intent-launcher for Android intents |
| Big image display | Full-width hero image in message card from `client::notification` extras |
| Icon URL overrides | expo-image with per-message icon from extras |
| Offline message cache | MMKV, 100 messages per source group, encrypted |
| Image gallery / zoom | Pinch-to-zoom with Gesture Handler + Reanimated |

### Offline Strategy
- **Storage:** MMKV (not SQLite) — each source group stored as a single serialized key. Assumption: average message ~1KB with extras, 100 messages per source = ~100KB per key. With 30 active sources = ~3MB total. Well within MMKV's sweet spot. If message sizes or source counts grow significantly beyond this, migrate to SQLite. MMKV's sync API enables instant cache reads during scroll without async waterfall.
- **Cached data:** Last 100 messages per source, app list + icons, topic list + folders, user prefs
- **On launch:** Show cached data immediately, fetch fresh in background
- **On disconnect:** Banner "Offline — showing cached messages"
- **On reconnect:** Sync delta, merge new messages, animate them in
- **Expiry:** 24h soft expiry, refresh on next connect

### Enhanced Message Card
Full-featured card layout supporting all Gotify extras:
- Big image hero (from `client::notification` extras)
- Source icon with per-message override (icon_url)
- Priority color border
- Markdown content (enriched-markdown with native text selection)
- Action buttons (view, http, broadcast)
- Attachment indicator with image preview
- Click URL integration

## 7. Out of Scope

These are deferred to future passes:
- **MQTT client:** Hub will show config/status but actual MQTT pub/sub is a separate feature
- **Webhook builder enhancements:** Current CRUD preserved, advanced builder deferred
- **Test suite:** Important but separate initiative
- **Internationalization:** English-only, i18n infrastructure added later
- **HTML email rendering:** Would require WebView, markdown covers 99% of use cases
- **Color scheme refinement:** NativeWind theme makes this a single-file change post-refactor

## 8. Build Sequence

**Phase 1 — Foundation**
Install NativeWind v5 (with Metro/Babel config), Legend List v2, MMKV, enriched-markdown, Zeego. Configure Reanimated 4 CSS Animations. Build shared design system (tailwind.config.js, shared components, typography/color tokens). Implement SecureStore/AsyncStorage → MMKV migration. Restructure Expo Router files to 3-tab layout. Restructure Zustand messagesStore to grouped shape. Remove old deps after migration.

**Phase 2 — Inbox (Hero Screen)**
Build grouped message list with Legend List sections. Build message thread drill-down at `thread/[sourceId].tsx`. Implement swipe gestures, Zeego context menus, skeleton loading, staggered animations. Adapt existing WebSocket hook (`useWebSocket.ts`) to feed the new grouped store. Implement offline cache.

**Phase 3 — Channels + Hub**
Build Channels with folder grouping, MQTT auto-group, pinning. Build Hub with integration grid, account settings, admin section. Wire up all drill-down screens (Apps, Webhooks, MQTT, Clients).

**Phase 4 — Polish + Feature Parity**
Broadcast actions, big image display, icon URL overrides, image gallery/zoom. Screen transition animations, remaining micro-interactions. Connection status indicators. Final accessibility pass.

## 9. Future Passes (Noted)

- **MQTT & Webhook enhancement:** Richer pub/sub UI, webhook builder with templates, MQTT topic explorer
- **Color scheme & styling:** Theme customization, user-selectable accent colors, refined palette. NativeWind makes this a `tailwind.config.js` edit.
- **Test suite:** Component tests, integration tests, E2E with Detox or Maestro
