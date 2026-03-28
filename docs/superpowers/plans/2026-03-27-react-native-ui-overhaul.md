# React Native UI Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the rstify mobile app from 5-tab flat hierarchy to 3-tab progressive disclosure (Inbox/Channels/Hub) with modern tech stack.

**Architecture:** Clean slate rebuild — new screens built on NativeWind v5 design system, Legend List v2 for message lists, MMKV for storage, Zeego for native context menus, Reanimated 4 for animations. Old screens kept as reference, deleted at end. Expo Router file structure restructured for 3-tab layout with drill-down routes.

**Tech Stack:** React Native 0.83.2, Expo SDK 55, NativeWind v5, Legend List v2, MMKV, react-native-enriched-markdown, Zeego, Reanimated 4, Gesture Handler v2, Zustand 5, Expo Router

**Spec:** `docs/superpowers/specs/2026-03-27-react-native-ui-overhaul-design.md`

---

## CRITICAL ERRATA — Read Before Implementing

The code snippets in this plan contain known API mismatches that MUST be corrected during implementation. Implementing agents should apply these fixes to every file they touch:

### E1: API Client Pattern
**Wrong:** `import { rstifyClient } from '../api'` and `rstifyClient.method()`
**Correct:** `import { getApiClient, initApiClient } from '../api'` then `const client = getApiClient(); client.method()`
- There is no exported `rstifyClient` symbol. Use `getApiClient()` to get the singleton.
- There is no `setBaseUrl()` method. Use `initApiClient(baseUrl)` to change the server URL.
- There is no `setToken()` method. Use `initApiClient(baseUrl)` which creates a new client; the token is set via `client.setToken(token)` — check the actual RstifyClient class for the correct method.
- **Applies to:** Every store file, every component that calls the API.

### E2: MessageResponse Field Names
**Wrong:** `msg.topic_name`, `msg.appname`
**Correct:** `msg.topic` (string | null), `msg.appid` (number | null). There is no `appname` field.
- `makeSourceId()` should use: `if (msg.topic) return \`topic:${msg.topic}\`; return \`app:${msg.appid}\`;`
- `makeSourceMeta()` name: for topics use `msg.topic`, for apps resolve the name from `useApplicationsStore.getState().getApp(msg.appid)?.name ?? \`App ${msg.appid}\``
- **Applies to:** messages store (`makeSourceId`, `makeSourceMeta`), StreamMessageCard, SourceGroupCard routing.

### E3: UserResponse Field Names
**Wrong:** `user.name`, `user.admin`
**Correct:** `user.username` (string), `user.is_admin` (boolean)
- **Applies to:** Hub screen, auth store, any component displaying user info.

### E4: WebSocket Hook API
**Wrong:** `const { status } = useUserWebSocket(token, callback)`
**Correct:** `const { connectionStatus } = useUserWebSocket({ clientToken: token, onMessage: callback })`
- The hook accepts an options object `{ clientToken, onMessage, enabled? }` and returns `{ connectionStatus }`.
- **Applies to:** Inbox screen (Task 9).

### E5: NativeWind v5 Babel Config
**Wrong:** Adding `"nativewind/babel"` as a separate preset
**Correct:** Only use `["babel-preset-expo", { jsxImportSource: "nativewind" }]` — NativeWind v5 uses Metro integration only, not a babel preset. Remove the `"nativewind/babel"` preset line from Task 1 Step 6.

### E6: Alert.prompt is iOS-Only
**Wrong:** `Alert.prompt(...)` in Channels screen for folder creation
**Correct:** Use a modal with TextInput for cross-platform folder name input. Create a simple `TextInputModal` component or inline a modal in the Channels screen.

### E7: MMKV Encryption Key
The hardcoded `encryptionKey: 'rstify-secure-v1'` in `mmkv.ts` is a security downgrade from SecureStore (which uses OS keychain). For the initial implementation this is acceptable, but a follow-up task should derive the key from the OS keychain. Add a TODO comment noting this.

### E8: Shared Utilities
Extract `formatTimeAgo()` to `client/src/utils/time.ts` instead of duplicating it in SourceGroupCard and StreamMessageCard.

### E9: Cache Write Debouncing
The `saveToCache()` in messages store fires on every `addMessage()`. Add a 2-second debounce to avoid writing 3MB on every WebSocket message:
```typescript
let cacheTimer: ReturnType<typeof setTimeout> | null = null;
function debouncedSave(fn: () => void) {
  if (cacheTimer) clearTimeout(cacheTimer);
  cacheTimer = setTimeout(fn, 2000);
}
```

### E10: Missing Features (Implement During Relevant Tasks)
- **PublishModal:** Create `client/src/components/channels/PublishModal.tsx` during Task 11. Port from the publish modal in `_ref_topics.tsx`.
- **Zeego on Inbox:** Add Zeego `DropdownMenu` wrapper to SourceGroupCard and StreamMessageCard (Task 8) for long-press context menus (delete, copy, mute source).
- **Image gallery/zoom:** Add pinch-to-zoom overlay for image attachments in MessageBubble/MessageAttachments (Task 15).

---

## File Structure Map

### New Files to Create
```
client/
├── global.css                           # NativeWind global styles
├── tailwind.config.js                   # NativeWind theme tokens
├── metro.config.js                      # Metro config with NativeWind
├── nativewind-env.d.ts                  # NativeWind TypeScript declarations
├── src/
│   ├── storage/
│   │   ├── mmkv.ts                      # MMKV instances (default + encrypted)
│   │   └── migration.ts                 # SecureStore/AsyncStorage → MMKV migration
│   ├── store/
│   │   ├── messages.ts                  # REWRITE: grouped message store
│   │   ├── channels.ts                  # NEW: channel folders, pins, MQTT grouping
│   │   ├── auth.ts                      # REWRITE: MMKV-backed auth
│   │   ├── theme.ts                     # REWRITE: MMKV-backed theme
│   │   └── applications.ts             # REWRITE: MMKV-backed app cache
│   ├── components/
│   │   ├── design/
│   │   │   ├── SkeletonShimmer.tsx      # Skeleton loading placeholder
│   │   │   ├── AnimatedPressable.tsx    # Scale + haptic press wrapper
│   │   │   ├── ConnectionStatus.tsx     # Animated pulse dot
│   │   │   ├── SegmentedControl.tsx     # Grouped/Stream toggle
│   │   │   └── SwipeableRow.tsx         # Swipe-to-delete/archive row
│   │   ├── inbox/
│   │   │   ├── SourceGroupCard.tsx      # Grouped view: source with preview + badge
│   │   │   ├── StreamMessageCard.tsx    # Stream view: single message row
│   │   │   └── MessageBubble.tsx        # Thread view: full message with all features
│   │   ├── channels/
│   │   │   ├── ChannelRow.tsx           # Single topic row with live indicator
│   │   │   ├── FolderSection.tsx        # Collapsible folder header + children
│   │   │   └── PublishModal.tsx         # Publish message to topic
│   │   ├── hub/
│   │   │   ├── IntegrationTile.tsx      # 2x2 grid tile (Apps, Webhooks, etc.)
│   │   │   └── SettingsRow.tsx          # Arrow-linked settings row
│   │   ├── MessageContent.tsx           # REWRITE: enriched-markdown
│   │   ├── MessageActions.tsx           # REWRITE: NativeWind + broadcast
│   │   ├── MessageAttachments.tsx       # REWRITE: NativeWind + image gallery
│   │   ├── MessageIcon.tsx              # REWRITE: NativeWind
│   │   └── EmptyState.tsx              # REWRITE: NativeWind + animation
│   └── hooks/
│       └── useWebSocket.ts             # KEEP: minimal changes
├── app/
│   ├── _layout.tsx                      # REWRITE: NativeWind provider + migration
│   ├── login.tsx                        # REWRITE: NativeWind
│   ├── (tabs)/
│   │   ├── _layout.tsx                  # REWRITE: 3-tab layout
│   │   ├── index.tsx                    # NEW: Inbox screen
│   │   ├── channels.tsx                 # NEW: Channels screen
│   │   └── hub.tsx                      # NEW: Hub screen
│   ├── thread/
│   │   └── [sourceId].tsx               # NEW: Message thread drill-down
│   └── hub/
│       ├── apps.tsx                     # REWRITE: NativeWind (from old apps.tsx)
│       ├── webhooks.tsx                 # REWRITE: NativeWind (from old webhooks.tsx)
│       ├── mqtt.tsx                     # NEW: MQTT status/config
│       ├── clients.tsx                  # NEW: Client management
│       ├── users.tsx                    # REWRITE: Admin user management (from settings.tsx)
│       └── settings.tsx                 # REWRITE: Account settings (subset of old settings.tsx)
```

### Files to Delete (Phase 4 cleanup)
```
client/app/(tabs)/apps.tsx               # Moved to hub/apps.tsx
client/app/(tabs)/topics.tsx             # Replaced by channels.tsx
client/app/(tabs)/webhooks.tsx           # Moved to hub/webhooks.tsx
client/app/(tabs)/settings.tsx           # Split into hub/settings.tsx + hub/users.tsx
client/src/theme/colors.ts              # Replaced by tailwind.config.js tokens
```

---

## Phase 1: Foundation

### Task 1: Install Dependencies & Configure NativeWind

**Files:**
- Modify: `client/package.json`
- Create: `client/tailwind.config.js`
- Create: `client/global.css`
- Create: `client/metro.config.js`
- Create: `client/nativewind-env.d.ts`
- Modify: `client/babel.config.js`
- Modify: `client/app.json`

- [ ] **Step 1: Install new dependencies**

Run from `client/` directory:
```bash
npx expo install nativewind tailwindcss@^3.4 react-native-css-interop
npx expo install @legendapp/list
npx expo install react-native-mmkv
npx expo install react-native-enriched-markdown
npx expo install zeego
npx expo install expo-intent-launcher
```

- [ ] **Step 2: Create tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Semantic
        primary: { DEFAULT: '#3b82f6', light: '#60a5fa', dark: '#2563eb' },
        success: { DEFAULT: '#22c55e', light: '#4ade80', dark: '#16a34a' },
        warning: { DEFAULT: '#f59e0b', light: '#fbbf24', dark: '#d97706' },
        error: { DEFAULT: '#ef4444', light: '#f87171', dark: '#dc2626' },
        accent: { DEFAULT: '#8b5cf6', light: '#a78bfa', dark: '#7c3aed' },
        info: { DEFAULT: '#06b6d4', light: '#22d3ee', dark: '#0891b2' },
        // Surfaces (dark mode defaults)
        surface: {
          bg: '#0f172a',
          card: '#1e293b',
          elevated: '#334155',
          overlay: '#475569',
        },
        // Light surfaces
        'surface-light': {
          bg: '#ffffff',
          card: '#f9fafb',
          elevated: '#f3f4f6',
          overlay: '#e5e7eb',
        },
      },
      fontSize: {
        'display': ['28px', { lineHeight: '34px', fontWeight: '800', letterSpacing: '-0.5px' }],
        'heading': ['18px', { lineHeight: '24px', fontWeight: '700' }],
        'body': ['14px', { lineHeight: '21px', fontWeight: '400' }],
        'caption': ['11px', { lineHeight: '16px', fontWeight: '400' }],
        'code': ['12px', { lineHeight: '18px', fontWeight: '400' }],
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 3: Create global.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 4: Create metro.config.js**

```javascript
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: "./global.css" });
```

- [ ] **Step 5: Create nativewind-env.d.ts**

```typescript
/// <reference types="nativewind/types" />
```

- [ ] **Step 6: Update babel.config.js**

Read the current babel.config.js first. Add NativeWind preset while keeping existing Reanimated plugin:

```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      "react-native-reanimated/plugin",
    ],
  };
};
```

- [ ] **Step 7: Update tsconfig.json**

Add NativeWind env reference. Read current tsconfig first, then add to `include`:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true
  },
  "include": [
    "**/*.ts",
    "**/*.tsx",
    ".expo/types/**/*.ts",
    "expo-env.d.ts",
    "nativewind-env.d.ts"
  ]
}
```

- [ ] **Step 8: Verify build compiles**

```bash
cd /home/jsprague/dev/rstify/client && npx expo start --clear
```

Press `q` to quit after confirming no build errors. If NativeWind shows metro errors, check that `global.css` path is correct in metro.config.js.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat(mobile): install NativeWind v5, Legend List, MMKV, enriched-markdown, Zeego"
```

---

### Task 2: Set Up MMKV Storage & Migration

**Files:**
- Create: `client/src/storage/mmkv.ts`
- Create: `client/src/storage/migration.ts`

- [ ] **Step 1: Create MMKV instances**

Create `client/src/storage/mmkv.ts`:

```typescript
import { MMKV } from 'react-native-mmkv';

// Default storage for preferences, cache, UI state
export const storage = new MMKV({
  id: 'rstify-default',
});

// Encrypted storage for auth tokens and sensitive data
export const secureStorage = new MMKV({
  id: 'rstify-secure',
  encryptionKey: 'rstify-secure-v1',
});

// Zustand persist middleware adapter for MMKV
export const mmkvStateStorage = {
  getItem: (name: string): string | null => {
    return storage.getString(name) ?? null;
  },
  setItem: (name: string, value: string): void => {
    storage.set(name, value);
  },
  removeItem: (name: string): void => {
    storage.delete(name);
  },
};
```

- [ ] **Step 2: Create migration from SecureStore/AsyncStorage**

Create `client/src/storage/migration.ts`:

```typescript
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { storage, secureStorage } from './mmkv';

const MIGRATION_KEY = 'mmkv_migration_complete';

export async function migrateToMmkv(): Promise<void> {
  if (storage.getBoolean(MIGRATION_KEY)) {
    return; // Already migrated
  }

  try {
    // Migrate auth token from SecureStore
    const token = await SecureStore.getItemAsync('rstify_token');
    if (token) {
      secureStorage.set('rstify_token', token);
    }

    // Migrate server URL from SecureStore
    const serverUrl = await SecureStore.getItemAsync('rstify_server_url');
    if (serverUrl) {
      secureStorage.set('rstify_server_url', serverUrl);
    }

    // Migrate theme preference from AsyncStorage
    const themeMode = await AsyncStorage.getItem('theme_mode');
    if (themeMode) {
      storage.set('theme_mode', themeMode);
    }

    // Mark migration complete
    storage.set(MIGRATION_KEY, true);

    // Clean up old stores (best-effort)
    try {
      await SecureStore.deleteItemAsync('rstify_token');
      await SecureStore.deleteItemAsync('rstify_server_url');
      await AsyncStorage.removeItem('theme_mode');
    } catch {
      // Cleanup failure is non-critical
    }
  } catch (error) {
    console.warn('MMKV migration failed, will retry on next launch:', error);
  }
}
```

- [ ] **Step 3: Verify MMKV loads without crash**

Add a temporary test in the root layout. We'll integrate properly in Task 4.

```bash
cd /home/jsprague/dev/rstify/client && npx expo start --clear
```

- [ ] **Step 4: Commit**

```bash
git add client/src/storage/ && git commit -m "feat(mobile): add MMKV storage layer with SecureStore/AsyncStorage migration"
```

---

### Task 3: Rewrite Zustand Stores for MMKV + Grouped Messages

**Files:**
- Rewrite: `client/src/store/auth.ts`
- Rewrite: `client/src/store/theme.ts`
- Rewrite: `client/src/store/messages.ts`
- Rewrite: `client/src/store/applications.ts`
- Create: `client/src/store/channels.ts`
- Modify: `client/src/store/index.ts`

- [ ] **Step 1: Rewrite auth store with MMKV**

Read current `client/src/store/auth.ts` first. Rewrite to use MMKV encrypted storage instead of SecureStore. Keep the same public interface:

```typescript
import { create } from 'zustand';
import { secureStorage } from '../storage/mmkv';
import { rstifyClient } from '../api';
import type { UserResponse } from '../api/types';

const TOKEN_KEY = 'rstify_token';
const SERVER_URL_KEY = 'rstify_server_url';
const DEFAULT_SERVER_URL = '';

interface AuthState {
  token: string | null;
  user: UserResponse | null;
  serverUrl: string;
  isAuthenticated: boolean;
  isLoading: boolean;
  initialize: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  setServerUrl: (url: string) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  serverUrl: secureStorage.getString(SERVER_URL_KEY) ?? DEFAULT_SERVER_URL,
  isAuthenticated: false,
  isLoading: true,

  initialize: async () => {
    const token = secureStorage.getString(TOKEN_KEY);
    const serverUrl = secureStorage.getString(SERVER_URL_KEY) ?? DEFAULT_SERVER_URL;

    if (token && serverUrl) {
      rstifyClient.setBaseUrl(serverUrl);
      rstifyClient.setToken(token);
      try {
        const user = await rstifyClient.currentUser();
        set({ token, user, serverUrl, isAuthenticated: true, isLoading: false });
        return;
      } catch {
        // Token expired or invalid
        secureStorage.delete(TOKEN_KEY);
      }
    }
    set({ isLoading: false, serverUrl });
  },

  login: async (username, password) => {
    const { serverUrl } = get();
    rstifyClient.setBaseUrl(serverUrl);
    const res = await rstifyClient.login({ username, password });
    rstifyClient.setToken(res.token);
    secureStorage.set(TOKEN_KEY, res.token);
    const user = await rstifyClient.currentUser();
    set({ token: res.token, user, isAuthenticated: true });
  },

  logout: () => {
    secureStorage.delete(TOKEN_KEY);
    rstifyClient.setToken('');
    set({ token: null, user: null, isAuthenticated: false });
  },

  setServerUrl: (url) => {
    const cleaned = url.replace(/\/+$/, '');
    secureStorage.set(SERVER_URL_KEY, cleaned);
    set({ serverUrl: cleaned });
  },
}));
```

- [ ] **Step 2: Rewrite theme store with MMKV**

Read current `client/src/store/theme.ts` first. Replace AsyncStorage with MMKV sync reads:

```typescript
import { create } from 'zustand';
import { Appearance } from 'react-native';
import { storage } from '../storage/mmkv';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
}

function resolveIsDark(mode: ThemeMode): boolean {
  if (mode === 'system') {
    return Appearance.getColorScheme() === 'dark';
  }
  return mode === 'dark';
}

const savedMode = (storage.getString('theme_mode') as ThemeMode) ?? 'system';

export const useThemeStore = create<ThemeState>((set) => ({
  mode: savedMode,
  isDark: resolveIsDark(savedMode),

  setMode: (mode) => {
    storage.set('theme_mode', mode);
    set({ mode, isDark: resolveIsDark(mode) });
  },
}));

// Listen for system theme changes
Appearance.addChangeListener(({ colorScheme }) => {
  const state = useThemeStore.getState();
  if (state.mode === 'system') {
    useThemeStore.setState({ isDark: colorScheme === 'dark' });
  }
});
```

- [ ] **Step 3: Rewrite messages store with grouped architecture**

Read current `client/src/store/messages.ts` first. This is the most critical rewrite — the flat list becomes a grouped map:

```typescript
import { create } from 'zustand';
import { rstifyClient } from '../api';
import { storage } from '../storage/mmkv';
import type { MessageResponse } from '../api/types';

const PAGE_SIZE = 50;
const CACHE_PREFIX = 'msg_cache_';
const MAX_CACHED_PER_SOURCE = 100;

export interface SourceMeta {
  sourceId: string;
  name: string;
  iconUrl: string | null;
  sourceType: 'app' | 'topic';
  unreadCount: number;
  latestTimestamp: string;
  latestPreview: string;
  priority: number;
}

type ViewMode = 'grouped' | 'stream';

interface MessagesState {
  // Grouped data
  groupedMessages: Map<string, MessageResponse[]>;
  sourceMeta: Map<string, SourceMeta>;

  // View control
  viewMode: ViewMode;

  // Loading state
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;

  // Actions
  fetchMessages: () => Promise<void>;
  fetchOlderMessages: () => Promise<void>;
  addMessage: (msg: MessageResponse) => void;
  deleteMessage: (id: number) => void;
  deleteGroup: (sourceId: string) => void;
  deleteAllMessages: () => Promise<void>;
  markGroupRead: (sourceId: string) => void;
  setViewMode: (mode: ViewMode) => void;
  getStreamMessages: () => MessageResponse[];
  getGroupedSources: () => SourceMeta[];
  getMessagesForSource: (sourceId: string) => MessageResponse[];

  // Cache
  loadFromCache: () => void;
  saveToCache: () => void;
}

function makeSourceId(msg: MessageResponse): string {
  if (msg.topic_name) return `topic:${msg.topic_name}`;
  return `app:${msg.appid}`;
}

function makeSourceMeta(msg: MessageResponse, existingMeta?: SourceMeta): SourceMeta {
  const sourceId = makeSourceId(msg);
  return {
    sourceId,
    name: msg.topic_name || msg.appname || `App ${msg.appid}`,
    iconUrl: msg.icon_url ?? null,
    sourceType: msg.topic_name ? 'topic' : 'app',
    unreadCount: (existingMeta?.unreadCount ?? 0) + 1,
    latestTimestamp: msg.date,
    latestPreview: msg.message?.substring(0, 80) ?? '',
    priority: Math.max(msg.priority ?? 0, existingMeta?.priority ?? 0),
  };
}

export const useMessagesStore = create<MessagesState>((set, get) => ({
  groupedMessages: new Map(),
  sourceMeta: new Map(),
  viewMode: (storage.getString('inbox_view_mode') as ViewMode) ?? 'grouped',
  isLoading: false,
  isLoadingMore: false,
  hasMore: true,

  fetchMessages: async () => {
    set({ isLoading: true });
    try {
      const res = await rstifyClient.listMessages(PAGE_SIZE);
      const messages = res.messages ?? [];
      const grouped = new Map<string, MessageResponse[]>();
      const meta = new Map<string, SourceMeta>();

      for (const msg of messages) {
        const sid = makeSourceId(msg);
        if (!grouped.has(sid)) grouped.set(sid, []);
        grouped.get(sid)!.push(msg);
        meta.set(sid, makeSourceMeta(msg, meta.get(sid)));
      }

      // Reset unread counts on initial fetch (these are already-seen messages)
      for (const [key, m] of meta) {
        meta.set(key, { ...m, unreadCount: 0 });
      }

      set({
        groupedMessages: grouped,
        sourceMeta: meta,
        isLoading: false,
        hasMore: messages.length >= PAGE_SIZE,
      });

      get().saveToCache();
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  fetchOlderMessages: async () => {
    const { isLoadingMore, hasMore, groupedMessages } = get();
    if (isLoadingMore || !hasMore) return;

    // Find oldest message ID across all groups
    let oldestId = Infinity;
    for (const msgs of groupedMessages.values()) {
      for (const msg of msgs) {
        if (msg.id < oldestId) oldestId = msg.id;
      }
    }
    if (oldestId === Infinity) return;

    set({ isLoadingMore: true });
    try {
      const res = await rstifyClient.listMessages(PAGE_SIZE, oldestId);
      const newMessages = res.messages ?? [];

      if (newMessages.length === 0) {
        set({ isLoadingMore: false, hasMore: false });
        return;
      }

      const grouped = new Map(groupedMessages);
      const meta = new Map(get().sourceMeta);

      for (const msg of newMessages) {
        const sid = makeSourceId(msg);
        if (!grouped.has(sid)) grouped.set(sid, []);
        const existing = grouped.get(sid)!;
        // Deduplicate
        if (!existing.some(m => m.id === msg.id)) {
          existing.push(msg);
        }
        if (!meta.has(sid)) {
          meta.set(sid, { ...makeSourceMeta(msg), unreadCount: 0 });
        }
      }

      set({
        groupedMessages: grouped,
        sourceMeta: meta,
        isLoadingMore: false,
        hasMore: newMessages.length >= PAGE_SIZE,
      });
    } catch {
      set({ isLoadingMore: false });
    }
  },

  addMessage: (msg) => {
    const { groupedMessages, sourceMeta } = get();
    const sid = makeSourceId(msg);
    const grouped = new Map(groupedMessages);
    const meta = new Map(sourceMeta);

    if (!grouped.has(sid)) grouped.set(sid, []);
    const existing = grouped.get(sid)!;

    // Deduplicate
    if (existing.some(m => m.id === msg.id)) return;

    // Prepend (newest first)
    grouped.set(sid, [msg, ...existing]);
    meta.set(sid, makeSourceMeta(msg, meta.get(sid)));

    set({ groupedMessages: grouped, sourceMeta: meta });
    get().saveToCache();
  },

  deleteMessage: (id) => {
    const { groupedMessages, sourceMeta } = get();
    const grouped = new Map<string, MessageResponse[]>();
    const meta = new Map(sourceMeta);

    for (const [sid, msgs] of groupedMessages) {
      const filtered = msgs.filter(m => m.id !== id);
      if (filtered.length > 0) {
        grouped.set(sid, filtered);
      } else {
        meta.delete(sid);
      }
    }

    set({ groupedMessages: grouped, sourceMeta: meta });

    // Fire API delete (best-effort)
    rstifyClient.deleteMessage(id).catch(() => {});
  },

  deleteGroup: (sourceId) => {
    const { groupedMessages, sourceMeta } = get();
    const msgs = groupedMessages.get(sourceId);
    if (!msgs) return;

    const grouped = new Map(groupedMessages);
    grouped.delete(sourceId);
    const meta = new Map(sourceMeta);
    meta.delete(sourceId);

    set({ groupedMessages: grouped, sourceMeta: meta });

    // Delete all messages in group via API
    for (const msg of msgs) {
      rstifyClient.deleteMessage(msg.id).catch(() => {});
    }
  },

  deleteAllMessages: async () => {
    await rstifyClient.deleteAllMessages();
    set({
      groupedMessages: new Map(),
      sourceMeta: new Map(),
    });
    storage.delete(CACHE_PREFIX + 'groups');
  },

  markGroupRead: (sourceId) => {
    const { sourceMeta } = get();
    const meta = new Map(sourceMeta);
    const existing = meta.get(sourceId);
    if (existing) {
      meta.set(sourceId, { ...existing, unreadCount: 0 });
      set({ sourceMeta: meta });
    }
  },

  setViewMode: (mode) => {
    storage.set('inbox_view_mode', mode);
    set({ viewMode: mode });
  },

  getStreamMessages: () => {
    const { groupedMessages } = get();
    const all: MessageResponse[] = [];
    for (const msgs of groupedMessages.values()) {
      all.push(...msgs);
    }
    return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  getGroupedSources: () => {
    const { sourceMeta } = get();
    return Array.from(sourceMeta.values()).sort(
      (a, b) => new Date(b.latestTimestamp).getTime() - new Date(a.latestTimestamp).getTime()
    );
  },

  getMessagesForSource: (sourceId) => {
    const { groupedMessages } = get();
    return groupedMessages.get(sourceId) ?? [];
  },

  loadFromCache: () => {
    try {
      const cached = storage.getString(CACHE_PREFIX + 'groups');
      if (!cached) return;
      const data = JSON.parse(cached);
      const grouped = new Map<string, MessageResponse[]>(Object.entries(data.grouped ?? {}));
      const meta = new Map<string, SourceMeta>(Object.entries(data.meta ?? {}));
      set({ groupedMessages: grouped, sourceMeta: meta });
    } catch {
      // Cache corrupted, ignore
    }
  },

  saveToCache: () => {
    try {
      const { groupedMessages, sourceMeta } = get();
      // Trim each group to MAX_CACHED_PER_SOURCE
      const trimmed: Record<string, MessageResponse[]> = {};
      for (const [sid, msgs] of groupedMessages) {
        trimmed[sid] = msgs.slice(0, MAX_CACHED_PER_SOURCE);
      }
      const metaObj: Record<string, SourceMeta> = {};
      for (const [sid, m] of sourceMeta) {
        metaObj[sid] = m;
      }
      storage.set(CACHE_PREFIX + 'groups', JSON.stringify({ grouped: trimmed, meta: metaObj }));
    } catch {
      // Cache write failure is non-critical
    }
  },
}));
```

- [ ] **Step 4: Create channels store**

Create `client/src/store/channels.ts`:

```typescript
import { create } from 'zustand';
import { storage } from '../storage/mmkv';
import { rstifyClient } from '../api';
import type { Topic } from '../api/types';

interface Folder {
  id: string;
  name: string;
  topicNames: string[];
  collapsed: boolean;
}

interface ChannelsState {
  topics: Topic[];
  folders: Folder[];
  pinnedTopics: string[];
  isLoading: boolean;

  fetchTopics: () => Promise<void>;
  createFolder: (name: string) => void;
  deleteFolder: (id: string) => void;
  moveToFolder: (topicName: string, folderId: string | null) => void;
  toggleFolderCollapsed: (folderId: string) => void;
  pinTopic: (topicName: string) => void;
  unpinTopic: (topicName: string) => void;
  isPinned: (topicName: string) => boolean;
  isMqttTopic: (topic: Topic) => boolean;
  getFolderedTopics: () => {
    pinned: Topic[];
    folders: (Folder & { topics: Topic[] })[];
    mqtt: Topic[];
    other: Topic[];
  };
}

const FOLDERS_KEY = 'channel_folders';
const PINS_KEY = 'channel_pins';

function loadFolders(): Folder[] {
  try {
    const raw = storage.getString(FOLDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function loadPins(): string[] {
  try {
    const raw = storage.getString(PINS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export const useChannelsStore = create<ChannelsState>((set, get) => ({
  topics: [],
  folders: loadFolders(),
  pinnedTopics: loadPins(),
  isLoading: false,

  fetchTopics: async () => {
    set({ isLoading: true });
    try {
      const topics = await rstifyClient.listTopics();
      set({ topics, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  createFolder: (name) => {
    const { folders } = get();
    const newFolder: Folder = {
      id: `folder_${Date.now()}`,
      name,
      topicNames: [],
      collapsed: false,
    };
    const updated = [...folders, newFolder];
    storage.set(FOLDERS_KEY, JSON.stringify(updated));
    set({ folders: updated });
  },

  deleteFolder: (id) => {
    const { folders } = get();
    const updated = folders.filter(f => f.id !== id);
    storage.set(FOLDERS_KEY, JSON.stringify(updated));
    set({ folders: updated });
  },

  moveToFolder: (topicName, folderId) => {
    const { folders } = get();
    const updated = folders.map(f => ({
      ...f,
      topicNames: f.id === folderId
        ? [...new Set([...f.topicNames, topicName])]
        : f.topicNames.filter(t => t !== topicName),
    }));
    storage.set(FOLDERS_KEY, JSON.stringify(updated));
    set({ folders: updated });
  },

  toggleFolderCollapsed: (folderId) => {
    const { folders } = get();
    const updated = folders.map(f =>
      f.id === folderId ? { ...f, collapsed: !f.collapsed } : f
    );
    storage.set(FOLDERS_KEY, JSON.stringify(updated));
    set({ folders: updated });
  },

  pinTopic: (topicName) => {
    const { pinnedTopics } = get();
    const updated = [...new Set([...pinnedTopics, topicName])];
    storage.set(PINS_KEY, JSON.stringify(updated));
    set({ pinnedTopics: updated });
  },

  unpinTopic: (topicName) => {
    const { pinnedTopics } = get();
    const updated = pinnedTopics.filter(t => t !== topicName);
    storage.set(PINS_KEY, JSON.stringify(updated));
    set({ pinnedTopics: updated });
  },

  isPinned: (topicName) => get().pinnedTopics.includes(topicName),

  isMqttTopic: (topic) => {
    // MQTT topics typically have hierarchical names with / separators
    // or are created by the MQTT bridge
    return topic.name.includes('/') || topic.name.startsWith('mqtt');
  },

  getFolderedTopics: () => {
    const { topics, folders, pinnedTopics } = get();
    const topicMap = new Map(topics.map(t => [t.name, t]));
    const assigned = new Set<string>();

    // Pinned
    const pinned = pinnedTopics
      .map(name => topicMap.get(name))
      .filter((t): t is Topic => !!t);
    pinned.forEach(t => assigned.add(t.name));

    // User folders
    const foldersWithTopics = folders.map(f => ({
      ...f,
      topics: f.topicNames
        .map(name => topicMap.get(name))
        .filter((t): t is Topic => !!t),
    }));
    for (const f of foldersWithTopics) {
      f.topics.forEach(t => assigned.add(t.name));
    }

    // MQTT auto-group
    const mqtt = topics.filter(t => !assigned.has(t.name) && get().isMqttTopic(t));
    mqtt.forEach(t => assigned.add(t.name));

    // Everything else
    const other = topics.filter(t => !assigned.has(t.name));

    return { pinned, folders: foldersWithTopics, mqtt, other };
  },
}));
```

- [ ] **Step 5: Rewrite applications store with MMKV caching**

Read current `client/src/store/applications.ts`. Rewrite to cache in MMKV:

```typescript
import { create } from 'zustand';
import { storage } from '../storage/mmkv';
import { rstifyClient } from '../api';
import type { Application } from '../api/types';

const CACHE_KEY = 'app_cache';

interface ApplicationsState {
  apps: Map<number, Application>;
  fetchApplications: () => Promise<void>;
  getApp: (id: number) => Application | undefined;
  getIconUrl: (appId: number) => string | null;
}

function loadCache(): Map<number, Application> {
  try {
    const raw = storage.getString(CACHE_KEY);
    if (!raw) return new Map();
    const entries: [number, Application][] = JSON.parse(raw);
    return new Map(entries);
  } catch { return new Map(); }
}

export const useApplicationsStore = create<ApplicationsState>((set, get) => ({
  apps: loadCache(),

  fetchApplications: async () => {
    try {
      const apps = await rstifyClient.listApplications();
      const appMap = new Map(apps.map(a => [a.id, a]));
      set({ apps: appMap });
      // Persist to MMKV
      storage.set(CACHE_KEY, JSON.stringify(Array.from(appMap.entries())));
    } catch {
      // Use cached data on failure
    }
  },

  getApp: (id) => get().apps.get(id),

  getIconUrl: (appId) => {
    const app = get().apps.get(appId);
    if (!app?.image) return null;
    return rstifyClient.applicationIconUrl(appId);
  },
}));
```

- [ ] **Step 6: Update store index**

Read and update `client/src/store/index.ts`:

```typescript
export { useAuthStore } from './auth';
export { useThemeStore } from './theme';
export { useMessagesStore } from './messages';
export type { SourceMeta } from './messages';
export { useApplicationsStore } from './applications';
export { useChannelsStore } from './channels';
```

- [ ] **Step 7: Commit**

```bash
git add client/src/store/ && git commit -m "feat(mobile): rewrite Zustand stores for MMKV + grouped messages + channels"
```

---

### Task 4: Shared Design Components

**Files:**
- Create: `client/src/components/design/AnimatedPressable.tsx`
- Create: `client/src/components/design/SkeletonShimmer.tsx`
- Create: `client/src/components/design/ConnectionStatus.tsx`
- Create: `client/src/components/design/SegmentedControl.tsx`
- Create: `client/src/components/design/SwipeableRow.tsx`

- [ ] **Step 1: Create AnimatedPressable**

```typescript
// client/src/components/design/AnimatedPressable.tsx
import React from 'react';
import { Pressable, type PressableProps } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

interface Props extends PressableProps {
  scaleDown?: number;
  haptic?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function AnimatedPressable({
  scaleDown = 0.97,
  haptic = true,
  onPressIn,
  onPressOut,
  onPress,
  children,
  ...props
}: Props) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressableBase
      onPressIn={(e) => {
        scale.value = withSpring(scaleDown, { damping: 15, stiffness: 300 });
        if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, { damping: 15, stiffness: 300 });
        onPressOut?.(e);
      }}
      onPress={onPress}
      style={animatedStyle}
      {...props}
    >
      {children}
    </AnimatedPressableBase>
  );
}
```

- [ ] **Step 2: Create SkeletonShimmer**

```typescript
// client/src/components/design/SkeletonShimmer.tsx
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

interface Props {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  className?: string;
}

export function SkeletonShimmer({ width = '100%', height = 16, borderRadius = 8, className }: Props) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      className={`bg-surface-elevated dark:bg-surface-elevated ${className ?? ''}`}
      style={[{ width: width as any, height, borderRadius }, animatedStyle]}
    />
  );
}

export function MessageCardSkeleton() {
  return (
    <View className="mx-4 mb-2 p-3 rounded-xl bg-surface-light-card dark:bg-surface-card">
      <View className="flex-row items-start gap-2">
        <SkeletonShimmer width={28} height={28} borderRadius={6} />
        <View className="flex-1 gap-2">
          <SkeletonShimmer width="60%" height={14} />
          <SkeletonShimmer width="90%" height={12} />
          <SkeletonShimmer width="40%" height={10} />
        </View>
      </View>
    </View>
  );
}
```

- [ ] **Step 3: Create ConnectionStatus**

```typescript
// client/src/components/design/ConnectionStatus.tsx
import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

type Status = 'connected' | 'reconnecting' | 'disconnected';

const STATUS_COLORS: Record<Status, string> = {
  connected: 'bg-success',
  reconnecting: 'bg-warning',
  disconnected: 'bg-error',
};

const STATUS_LABELS: Record<Status, string> = {
  connected: 'Live',
  reconnecting: 'Reconnecting...',
  disconnected: 'Disconnected',
};

export function ConnectionStatus({ status }: { status: Status }) {
  const pulseOpacity = useSharedValue(1);

  useEffect(() => {
    if (status === 'connected') {
      pulseOpacity.value = withRepeat(
        withTiming(0.4, { duration: 2000 }),
        -1,
        true,
      );
    } else {
      pulseOpacity.value = 1;
    }
  }, [status]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  return (
    <View className="flex-row items-center gap-1.5">
      <Animated.View
        className={`w-2 h-2 rounded-full ${STATUS_COLORS[status]}`}
        style={pulseStyle}
      />
      <Text className="text-caption text-slate-400 dark:text-slate-500">
        {STATUS_LABELS[status]}
      </Text>
    </View>
  );
}
```

- [ ] **Step 4: Create SegmentedControl**

```typescript
// client/src/components/design/SegmentedControl.tsx
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

interface Props {
  segments: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
}

export function SegmentedControl({ segments, selectedIndex, onChange }: Props) {
  const handlePress = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(index);
  };

  return (
    <View className="flex-row bg-surface-light-elevated dark:bg-surface-elevated rounded-lg p-0.5">
      {segments.map((label, i) => (
        <Pressable
          key={label}
          onPress={() => handlePress(i)}
          className={`flex-1 py-1.5 px-3 rounded-md items-center ${
            i === selectedIndex
              ? 'bg-white dark:bg-surface-card'
              : ''
          }`}
        >
          <Text
            className={`text-[13px] font-semibold ${
              i === selectedIndex
                ? 'text-slate-900 dark:text-slate-100'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
```

- [ ] **Step 5: Create SwipeableRow**

```typescript
// client/src/components/design/SwipeableRow.tsx
import React from 'react';
import { View, Text } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

interface Props {
  onDelete?: () => void;
  onArchive?: () => void;
  children: React.ReactNode;
}

const SWIPE_THRESHOLD = 80;

export function SwipeableRow({ onDelete, onArchive, children }: Props) {
  const translateX = useSharedValue(0);

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((e) => {
      // Clamp: left swipe for delete, right swipe for archive
      if (e.translationX < 0 && onDelete) {
        translateX.value = Math.max(e.translationX, -120);
      } else if (e.translationX > 0 && onArchive) {
        translateX.value = Math.min(e.translationX, 120);
      }
    })
    .onEnd((e) => {
      if (e.translationX < -SWIPE_THRESHOLD && onDelete) {
        translateX.value = withTiming(-300, { duration: 200 });
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
        runOnJS(onDelete)();
      } else if (e.translationX > SWIPE_THRESHOLD && onArchive) {
        translateX.value = withTiming(300, { duration: 200 });
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
        runOnJS(onArchive)();
      } else {
        translateX.value = withSpring(0);
      }
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const deleteStyle = useAnimatedStyle(() => ({
    opacity: translateX.value < -20 ? 1 : 0,
  }));

  const archiveStyle = useAnimatedStyle(() => ({
    opacity: translateX.value > 20 ? 1 : 0,
  }));

  return (
    <View className="relative overflow-hidden">
      {/* Delete background (left swipe) */}
      <Animated.View
        className="absolute inset-0 bg-error items-end justify-center pr-6"
        style={deleteStyle}
      >
        <Text className="text-white font-semibold text-[13px]">Delete</Text>
      </Animated.View>

      {/* Archive background (right swipe) */}
      <Animated.View
        className="absolute inset-0 bg-primary items-start justify-center pl-6"
        style={archiveStyle}
      >
        <Text className="text-white font-semibold text-[13px]">Read</Text>
      </Animated.View>

      {/* Content */}
      <GestureDetector gesture={pan}>
        <Animated.View style={rowStyle}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add client/src/components/design/ && git commit -m "feat(mobile): add shared design components — AnimatedPressable, Skeleton, ConnectionStatus, SegmentedControl, SwipeableRow"
```

---

### Task 5: Rewrite Root Layout with NativeWind + Migration

**Files:**
- Rewrite: `client/app/_layout.tsx`

- [ ] **Step 1: Read current root layout**

Read `client/app/_layout.tsx` to understand auth guard, notification handling, and slot rendering.

- [ ] **Step 2: Rewrite with NativeWind provider and MMKV migration**

Rewrite `client/app/_layout.tsx`. Key changes:
- Import `global.css` for NativeWind
- Run MMKV migration on mount
- Keep auth guard logic
- Keep notification response listener
- Remove old theme context if any

```typescript
import '../global.css';
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../src/store/auth';
import { useApplicationsStore } from '../src/store/applications';
import { useMessagesStore } from '../src/store/messages';
import { migrateToMmkv } from '../src/storage/migration';
import { showMessageNotification } from '../src/services/notifications';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  const [migrated, setMigrated] = useState(false);
  const { isAuthenticated, isLoading, initialize } = useAuthStore();
  const { fetchApplications } = useApplicationsStore();
  const { addMessage, loadFromCache } = useMessagesStore();

  // Run MMKV migration first, then initialize auth
  useEffect(() => {
    migrateToMmkv().then(() => {
      setMigrated(true);
      loadFromCache();
      initialize().then(() => {
        if (useAuthStore.getState().isAuthenticated) {
          fetchApplications();
        }
      });
    });
  }, []);

  // Handle notification tap → open click URL
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const clickUrl = response.notification.request.content.data?.clickUrl;
        if (clickUrl && typeof clickUrl === 'string') {
          Linking.openURL(clickUrl);
        }
      }
    );
    return () => subscription.remove();
  }, []);

  if (!migrated || isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface-light-bg dark:bg-surface-bg">
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="(tabs)" />
        ) : (
          <Stack.Screen name="login" />
        )}
      </Stack>
      <Toast />
    </GestureHandlerRootView>
  );
}
```

- [ ] **Step 3: Verify the app launches**

```bash
cd /home/jsprague/dev/rstify/client && npx expo start --clear
```

- [ ] **Step 4: Commit**

```bash
git add client/app/_layout.tsx && git commit -m "feat(mobile): rewrite root layout with NativeWind, MMKV migration, offline cache load"
```

---

### Task 6: Rewrite 3-Tab Layout

**Files:**
- Rewrite: `client/app/(tabs)/_layout.tsx`

- [ ] **Step 1: Read current tab layout**

Read `client/app/(tabs)/_layout.tsx` for icon and styling patterns.

- [ ] **Step 2: Rewrite to 3-tab layout**

```typescript
// client/app/(tabs)/_layout.tsx
import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../../src/store';

export default function TabLayout() {
  const { isDark } = useThemeStore();

  const tabBarStyle = {
    backgroundColor: isDark ? '#0f172a' : '#ffffff',
    borderTopColor: isDark ? '#1e293b' : '#f3f4f6',
    borderTopWidth: 1,
    paddingBottom: 4,
    height: 56,
  };

  const activeTint = isDark ? '#60a5fa' : '#2563eb';
  const inactiveTint = isDark ? '#64748b' : '#94a3b8';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: activeTint,
        tabBarInactiveTintColor: inactiveTint,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inbox',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="mail" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="channels"
        options={{
          title: 'Channels',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="radio" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="hub"
        options={{
          title: 'Hub',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 3: Create placeholder screens for channels and hub**

Create `client/app/(tabs)/channels.tsx`:
```typescript
import React from 'react';
import { View, Text } from 'react-native';

export default function ChannelsScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-surface-light-bg dark:bg-surface-bg">
      <Text className="text-slate-500">Channels — Phase 3</Text>
    </View>
  );
}
```

Create `client/app/(tabs)/hub.tsx`:
```typescript
import React from 'react';
import { View, Text } from 'react-native';

export default function HubScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-surface-light-bg dark:bg-surface-bg">
      <Text className="text-slate-500">Hub — Phase 3</Text>
    </View>
  );
}
```

- [ ] **Step 4: Temporarily keep old tab files**

Rename old tab files so they don't conflict but are available as reference:
```bash
cd /home/jsprague/dev/rstify/client/app/(tabs)
mv apps.tsx _ref_apps.tsx
mv topics.tsx _ref_topics.tsx
mv webhooks.tsx _ref_webhooks.tsx
mv settings.tsx _ref_settings.tsx
```

- [ ] **Step 5: Verify 3-tab navigation works**

```bash
cd /home/jsprague/dev/rstify/client && npx expo start --clear
```

Confirm: Inbox, Channels, Hub tabs render. Inbox shows placeholder or empty state.

- [ ] **Step 6: Commit**

```bash
git add client/app/ && git commit -m "feat(mobile): restructure to 3-tab layout (Inbox/Channels/Hub)"
```

---

## Phase 2: Inbox (Hero Screen)

### Task 7: Rewrite Core Message Components with NativeWind

**Files:**
- Rewrite: `client/src/components/MessageContent.tsx`
- Rewrite: `client/src/components/MessageIcon.tsx`
- Rewrite: `client/src/components/MessageActions.tsx`
- Rewrite: `client/src/components/MessageAttachments.tsx`
- Rewrite: `client/src/components/EmptyState.tsx`

- [ ] **Step 1: Rewrite MessageContent with enriched-markdown**

Read current `client/src/components/MessageContent.tsx`. Rewrite using enriched-markdown:

```typescript
// client/src/components/MessageContent.tsx
import React from 'react';
import { View, Text } from 'react-native';
import EnrichedMarkdown from 'react-native-enriched-markdown';
import type { MessageResponse } from '../api/types';

interface Props {
  message: MessageResponse;
}

export function MessageContent({ message }: Props) {
  const isMarkdown =
    message.extras?.["client::display"]?.contentType === "text/markdown";

  if (!isMarkdown || !message.message) {
    return (
      <Text className="text-body text-slate-700 dark:text-slate-300">
        {message.message}
      </Text>
    );
  }

  return (
    <View className="mt-1">
      <EnrichedMarkdown
        value={message.message}
        markdownStyle={{
          heading1: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
          heading2: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
          paragraph: { fontSize: 14, lineHeight: 21, marginBottom: 8 },
          code: { fontSize: 12, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 4, paddingHorizontal: 4 },
          codeBlock: { fontSize: 12, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 8, padding: 12 },
          link: { color: '#3b82f6' },
          blockquote: { borderLeftWidth: 3, borderLeftColor: '#3b82f6', paddingLeft: 12, opacity: 0.8 },
        }}
      />
    </View>
  );
}
```

**Note:** The exact `react-native-enriched-markdown` API may differ. Check Context7 docs during implementation if the import or props don't match. Fall back to `react-native-markdown-display` if enriched-markdown has compatibility issues with Expo SDK 55.

- [ ] **Step 2: Rewrite MessageIcon**

Read current `client/src/components/MessageIcon.tsx`. Rewrite with NativeWind:

```typescript
// client/src/components/MessageIcon.tsx
import React from 'react';
import { View, Text } from 'react-native';
import { Image } from 'expo-image';
import { useApplicationsStore } from '../store';

interface Props {
  appId?: number;
  iconUrl?: string | null;
  size?: number;
  name?: string;
}

export function MessageIcon({ appId, iconUrl, size = 28, name }: Props) {
  const { getIconUrl } = useApplicationsStore();

  const resolvedUrl = iconUrl ?? (appId ? getIconUrl(appId) : null);
  const initial = (name ?? '?')[0].toUpperCase();

  if (resolvedUrl) {
    return (
      <Image
        source={{ uri: resolvedUrl }}
        className="rounded-md"
        style={{ width: size, height: size }}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={200}
      />
    );
  }

  return (
    <View
      className="rounded-md bg-primary/20 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <Text className="text-primary font-bold" style={{ fontSize: size * 0.4 }}>
        {initial}
      </Text>
    </View>
  );
}
```

- [ ] **Step 3: Rewrite MessageActions with broadcast support**

Read current `client/src/components/MessageActions.tsx`. Add expo-intent-launcher for broadcast:

```typescript
// client/src/components/MessageActions.tsx
import React, { useState } from 'react';
import { View, Text, Alert } from 'react-native';
import * as Linking from 'expo-linking';
import * as IntentLauncher from 'expo-intent-launcher';
import Toast from 'react-native-toast-message';
import { AnimatedPressable } from './design/AnimatedPressable';
import type { MessageResponse } from '../api/types';

interface Action {
  action: string;
  label: string;
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  extras?: Record<string, string>;
}

function parseActions(message: MessageResponse): Action[] {
  if (message.actions && Array.isArray(message.actions)) {
    return message.actions;
  }
  if (message.extras?.["android::action"]?.actions) {
    return message.extras["android::action"].actions.map((a: any) => ({
      action: a.type || a.action || 'view',
      label: a.label || a.name || 'Action',
      url: a.url,
      method: a.method,
      headers: a.headers,
      body: a.body,
      extras: a.extras,
    }));
  }
  return [];
}

export function MessageActions({ message }: { message: MessageResponse }) {
  const [executing, setExecuting] = useState<string | null>(null);
  const actions = parseActions(message);

  if (actions.length === 0) return null;

  const executeAction = async (action: Action) => {
    setExecuting(action.label);
    try {
      switch (action.action) {
        case 'view':
          if (action.url) await Linking.openURL(action.url);
          break;

        case 'http':
          if (action.url) {
            const res = await fetch(action.url, {
              method: action.method || 'POST',
              headers: action.headers,
              body: action.body,
            });
            Toast.show({
              type: res.ok ? 'success' : 'error',
              text1: res.ok ? 'Action completed' : `Error: ${res.status}`,
            });
          }
          break;

        case 'broadcast':
          if (action.extras) {
            try {
              await IntentLauncher.startActivityAsync(
                IntentLauncher.ActivityAction.MAIN,
                { extra: action.extras }
              );
            } catch {
              Toast.show({ type: 'info', text1: 'Broadcast sent' });
            }
          }
          break;
      }
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Action failed', text2: error.message });
    } finally {
      setExecuting(null);
    }
  };

  return (
    <View className="flex-row gap-1.5 mt-2">
      {actions.slice(0, 3).map((action) => (
        <AnimatedPressable
          key={action.label}
          onPress={() => executeAction(action)}
          disabled={executing !== null}
          className={`px-3 py-1.5 rounded-md ${
            action.action === 'view'
              ? 'bg-primary/10'
              : action.action === 'http'
              ? 'bg-success/10'
              : 'bg-accent/10'
          }`}
        >
          <Text
            className={`text-[11px] font-semibold ${
              action.action === 'view'
                ? 'text-primary'
                : action.action === 'http'
                ? 'text-success'
                : 'text-accent'
            }`}
          >
            {executing === action.label ? '...' : action.label}
            {action.action === 'view' ? ' →' : ''}
          </Text>
        </AnimatedPressable>
      ))}
    </View>
  );
}
```

- [ ] **Step 4: Rewrite MessageAttachments**

Read current `client/src/components/MessageAttachments.tsx`. Rewrite with NativeWind + image press for future gallery:

```typescript
// client/src/components/MessageAttachments.tsx
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import type { MessageResponse } from '../api/types';
import { useAuthStore } from '../store';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MessageAttachments({ message }: { message: MessageResponse }) {
  const { serverUrl, token } = useAuthStore();

  if (!message.extras?.["client::attachment"]) return null;

  const attachment = message.extras["client::attachment"];
  const url = `${serverUrl}${attachment.url}`;
  const isImage = attachment.mime_type?.startsWith('image/');

  return (
    <View className="mt-2 border-t border-slate-100 dark:border-slate-700 pt-2">
      {isImage && (
        <Pressable onPress={() => Linking.openURL(url)}>
          <Image
            source={{ uri: url, headers: { Authorization: `Bearer ${token}` } }}
            className="w-full h-40 rounded-lg"
            contentFit="cover"
            transition={200}
          />
        </Pressable>
      )}
      <Pressable
        onPress={() => Linking.openURL(url)}
        className="flex-row items-center gap-1.5 mt-1"
      >
        <Text className="text-caption text-slate-400">
          📎 {attachment.name ?? 'attachment'}
          {attachment.size ? ` (${formatFileSize(attachment.size)})` : ''}
        </Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 5: Rewrite EmptyState with animation**

```typescript
// client/src/components/EmptyState.tsx
import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
}

export function EmptyState({ icon, title, subtitle }: Props) {
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 12 });
    opacity.value = withSpring(1);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      className="flex-1 items-center justify-center p-6"
      style={animatedStyle}
    >
      <Ionicons name={icon} size={48} color="#94a3b8" />
      <Text className="text-heading text-slate-500 dark:text-slate-400 mt-4">
        {title}
      </Text>
      {subtitle && (
        <Text className="text-body text-slate-400 dark:text-slate-500 mt-2 text-center">
          {subtitle}
        </Text>
      )}
    </Animated.View>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add client/src/components/ && git commit -m "feat(mobile): rewrite message components with NativeWind + enriched-markdown + broadcast actions"
```

---

### Task 8: Build Inbox Source Group Card & Stream Card

**Files:**
- Create: `client/src/components/inbox/SourceGroupCard.tsx`
- Create: `client/src/components/inbox/StreamMessageCard.tsx`

- [ ] **Step 1: Create SourceGroupCard (grouped view item)**

```typescript
// client/src/components/inbox/SourceGroupCard.tsx
import React from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { AnimatedPressable } from '../design/AnimatedPressable';
import { SwipeableRow } from '../design/SwipeableRow';
import { MessageIcon } from '../MessageIcon';
import type { SourceMeta } from '../../store/messages';
import { useMessagesStore } from '../../store';

const PRIORITY_BORDERS: Record<string, string> = {
  low: 'border-l-slate-400',
  medium: 'border-l-primary',
  high: 'border-l-warning',
  critical: 'border-l-error',
};

function priorityLevel(p: number): string {
  if (p >= 8) return 'critical';
  if (p >= 6) return 'high';
  if (p >= 4) return 'medium';
  return 'low';
}

export function SourceGroupCard({ source }: { source: SourceMeta }) {
  const { deleteGroup, markGroupRead } = useMessagesStore();
  const borderClass = PRIORITY_BORDERS[priorityLevel(source.priority)];
  const timeAgo = formatTimeAgo(source.latestTimestamp);

  return (
    <SwipeableRow
      onDelete={() => deleteGroup(source.sourceId)}
      onArchive={() => markGroupRead(source.sourceId)}
    >
      <AnimatedPressable
        onPress={() => {
          markGroupRead(source.sourceId);
          router.push(`/thread/${encodeURIComponent(source.sourceId)}`);
        }}
        className={`mx-4 mb-2 p-3 rounded-xl bg-white dark:bg-surface-card border-l-[3px] ${borderClass}`}
      >
        <View className="flex-row items-start gap-2.5">
          <MessageIcon
            iconUrl={source.iconUrl}
            name={source.name}
            size={32}
          />
          <View className="flex-1 min-w-0">
            <View className="flex-row justify-between items-center">
              <Text
                className="text-[14px] font-bold text-slate-900 dark:text-slate-100"
                numberOfLines={1}
              >
                {source.name}
              </Text>
              <View className="flex-row items-center gap-2">
                {source.unreadCount > 0 && (
                  <View className="bg-primary/20 px-1.5 py-0.5 rounded-full">
                    <Text className="text-[10px] font-bold text-primary">
                      {source.unreadCount} new
                    </Text>
                  </View>
                )}
                <Text className="text-caption text-slate-400">
                  {timeAgo}
                </Text>
              </View>
            </View>
            <Text
              className="text-[12px] text-slate-500 dark:text-slate-400 mt-1"
              numberOfLines={2}
            >
              {source.latestPreview}
            </Text>
          </View>
        </View>
      </AnimatedPressable>
    </SwipeableRow>
  );
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}
```

- [ ] **Step 2: Create StreamMessageCard (stream view item)**

```typescript
// client/src/components/inbox/StreamMessageCard.tsx
import React from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { AnimatedPressable } from '../design/AnimatedPressable';
import { SwipeableRow } from '../design/SwipeableRow';
import { MessageIcon } from '../MessageIcon';
import { useMessagesStore, useApplicationsStore } from '../../store';
import type { MessageResponse } from '../../api/types';

export function StreamMessageCard({ message }: { message: MessageResponse }) {
  const { deleteMessage } = useMessagesStore();
  const { getApp } = useApplicationsStore();
  const app = message.appid ? getApp(message.appid) : undefined;
  const sourceName = message.topic_name || app?.name || `App ${message.appid}`;
  const timeAgo = formatTimeAgo(message.date);

  return (
    <SwipeableRow onDelete={() => deleteMessage(message.id)}>
      <AnimatedPressable
        onPress={() => {
          const sourceId = message.topic_name
            ? `topic:${message.topic_name}`
            : `app:${message.appid}`;
          router.push(`/thread/${encodeURIComponent(sourceId)}`);
        }}
        className="mx-4 mb-1.5 p-3 rounded-xl bg-white dark:bg-surface-card"
      >
        <View className="flex-row gap-2.5 items-start">
          <MessageIcon
            appId={message.appid}
            iconUrl={message.icon_url}
            name={sourceName}
          />
          <View className="flex-1 min-w-0">
            <View className="flex-row justify-between items-center">
              <Text className="text-[12px] font-semibold text-slate-900 dark:text-slate-100">
                {sourceName}
              </Text>
              <Text className="text-caption text-slate-400">{timeAgo}</Text>
            </View>
            {message.title && (
              <Text
                className="text-[13px] font-semibold text-slate-800 dark:text-slate-200 mt-0.5"
                numberOfLines={1}
              >
                {message.title}
              </Text>
            )}
            <Text
              className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5"
              numberOfLines={2}
            >
              {message.message}
            </Text>
          </View>
        </View>
      </AnimatedPressable>
    </SwipeableRow>
  );
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/inbox/ && git commit -m "feat(mobile): add SourceGroupCard and StreamMessageCard for Inbox views"
```

---

### Task 9: Build Inbox Screen

**Files:**
- Rewrite: `client/app/(tabs)/index.tsx`

- [ ] **Step 1: Read current Messages screen**

Read `client/app/(tabs)/index.tsx` for WebSocket integration, search, and filter patterns.

- [ ] **Step 2: Build Inbox screen with grouped + stream modes**

Rewrite `client/app/(tabs)/index.tsx`:

```typescript
import React, { useEffect, useCallback, useState } from 'react';
import { View, Text, RefreshControl, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LegendList } from '@legendapp/list';
import { SegmentedControl } from '../../src/components/design/SegmentedControl';
import { ConnectionStatus } from '../../src/components/design/ConnectionStatus';
import { MessageCardSkeleton } from '../../src/components/design/SkeletonShimmer';
import { SourceGroupCard } from '../../src/components/inbox/SourceGroupCard';
import { StreamMessageCard } from '../../src/components/inbox/StreamMessageCard';
import { EmptyState } from '../../src/components/EmptyState';
import { useMessagesStore, useAuthStore, useApplicationsStore } from '../../src/store';
import { useUserWebSocket } from '../../src/hooks/useWebSocket';
import { showMessageNotification } from '../../src/services/notifications';
import type { SourceMeta } from '../../src/store/messages';
import type { MessageResponse } from '../../src/api/types';

const VIEW_SEGMENTS = ['Grouped', 'Stream'];

export default function InboxScreen() {
  const {
    viewMode, setViewMode,
    isLoading, isLoadingMore, hasMore,
    fetchMessages, fetchOlderMessages, addMessage,
    getGroupedSources, getStreamMessages,
  } = useMessagesStore();
  const { token } = useAuthStore();
  const { fetchApplications } = useApplicationsStore();
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // WebSocket connection
  const { status } = useUserWebSocket(
    token,
    useCallback((msg: MessageResponse) => {
      addMessage(msg);
      showMessageNotification(msg);
    }, []),
  );

  // Initial fetch
  useEffect(() => {
    fetchMessages();
    fetchApplications();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMessages();
    setRefreshing(false);
  }, []);

  const selectedIndex = viewMode === 'grouped' ? 0 : 1;

  // Filter by search
  const groupedSources = getGroupedSources().filter(
    (s) => !search || s.name.toLowerCase().includes(search.toLowerCase())
  );
  const streamMessages = getStreamMessages().filter(
    (m) =>
      !search ||
      m.title?.toLowerCase().includes(search.toLowerCase()) ||
      m.message?.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface-light-bg dark:bg-surface-bg">
        <View className="p-4 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <MessageCardSkeleton key={i} />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-light-bg dark:bg-surface-bg" edges={['top']}>
      {/* Header */}
      <View className="px-4 pt-2 pb-3">
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-display text-slate-900 dark:text-slate-100">
            Inbox
          </Text>
          <ConnectionStatus status={status} />
        </View>

        {/* Search */}
        <TextInput
          className="bg-surface-light-elevated dark:bg-surface-elevated rounded-lg px-3 py-2 text-[14px] text-slate-900 dark:text-slate-100"
          placeholder="Search messages..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
        />

        {/* Segmented control */}
        <View className="mt-3">
          <SegmentedControl
            segments={VIEW_SEGMENTS}
            selectedIndex={selectedIndex}
            onChange={(i) => setViewMode(i === 0 ? 'grouped' : 'stream')}
          />
        </View>
      </View>

      {/* List */}
      {viewMode === 'grouped' ? (
        <LegendList
          data={groupedSources}
          keyExtractor={(item: SourceMeta) => item.sourceId}
          renderItem={({ item }: { item: SourceMeta }) => (
            <SourceGroupCard source={item} />
          )}
          recycleItems
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="mail-open-outline"
              title="No messages"
              subtitle="Messages from your apps and topics will appear here"
            />
          }
        />
      ) : (
        <LegendList
          data={streamMessages}
          keyExtractor={(item: MessageResponse) => String(item.id)}
          renderItem={({ item }: { item: MessageResponse }) => (
            <StreamMessageCard message={item} />
          )}
          recycleItems
          onEndReached={() => {
            if (hasMore && !isLoadingMore) fetchOlderMessages();
          }}
          onEndReachedThreshold={0.3}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="mail-open-outline"
              title="No messages"
              subtitle="Messages from your apps and topics will appear here"
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Verify Inbox renders with real data**

```bash
cd /home/jsprague/dev/rstify/client && npx expo start --clear
```

Login, verify messages load in both grouped and stream modes. Test search, pull-to-refresh, WebSocket updates.

- [ ] **Step 4: Commit**

```bash
git add client/app/(tabs)/index.tsx && git commit -m "feat(mobile): build Inbox screen with grouped/stream views, Legend List, skeleton loading"
```

---

### Task 10: Build Message Thread Drill-Down

**Files:**
- Create: `client/app/thread/[sourceId].tsx`
- Create: `client/src/components/inbox/MessageBubble.tsx`

- [ ] **Step 1: Create MessageBubble (full message card in thread)**

```typescript
// client/src/components/inbox/MessageBubble.tsx
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { MessageContent } from '../MessageContent';
import { MessageActions } from '../MessageActions';
import { MessageAttachments } from '../MessageAttachments';
import type { MessageResponse } from '../../api/types';
import { useAuthStore } from '../../store';

const PRIORITY_COLORS: Record<string, string> = {
  low: 'border-l-slate-400',
  medium: 'border-l-primary',
  high: 'border-l-warning',
  critical: 'border-l-error',
};

function priorityLevel(p: number): string {
  if (p >= 8) return 'critical';
  if (p >= 6) return 'high';
  if (p >= 4) return 'medium';
  return 'low';
}

export function MessageBubble({ message }: { message: MessageResponse }) {
  const { serverUrl, token } = useAuthStore();
  const border = PRIORITY_COLORS[priorityLevel(message.priority ?? 0)];
  const clickUrl = message.click_url || message.extras?.["client::notification"]?.click?.url;
  const bigImage = message.extras?.["client::notification"]?.bigImageUrl;
  const timestamp = new Date(message.date).toLocaleString();

  const priorityLabel = (message.priority ?? 0) >= 6
    ? `⚠ Priority ${message.priority}`
    : null;

  return (
    <View className={`mx-4 mb-2 rounded-xl bg-white dark:bg-surface-card border-l-[3px] ${border} overflow-hidden`}>
      {/* Big image hero */}
      {bigImage && (
        <Pressable onPress={() => Linking.openURL(bigImage)}>
          <Image
            source={{ uri: bigImage }}
            className="w-full h-36"
            contentFit="cover"
            transition={200}
          />
        </Pressable>
      )}

      <View className="p-3">
        {/* Header: priority + timestamp */}
        <View className="flex-row justify-between items-center mb-1.5">
          {priorityLabel ? (
            <Text className="text-[11px] font-semibold text-error">{priorityLabel}</Text>
          ) : (
            <View />
          )}
          <Text className="text-caption text-slate-400">{timestamp}</Text>
        </View>

        {/* Title */}
        {message.title && (
          <Pressable
            onPress={clickUrl ? () => Linking.openURL(clickUrl) : undefined}
          >
            <Text className="text-[14px] font-bold text-slate-900 dark:text-slate-100 mb-1">
              {message.title}
              {clickUrl ? ' →' : ''}
            </Text>
          </Pressable>
        )}

        {/* Content */}
        <MessageContent message={message} />

        {/* Actions */}
        <MessageActions message={message} />

        {/* Attachments */}
        <MessageAttachments message={message} />

        {/* Tags */}
        {message.tags && message.tags.length > 0 && (
          <View className="flex-row gap-1 mt-2">
            {message.tags.map((tag) => (
              <Text key={tag} className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 px-1.5 py-0.5 rounded">
                {tag}
              </Text>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Create thread drill-down screen**

Create directory and file:
```bash
mkdir -p /home/jsprague/dev/rstify/client/app/thread
```

```typescript
// client/app/thread/[sourceId].tsx
import React, { useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LegendList } from '@legendapp/list';
import { Ionicons } from '@expo/vector-icons';
import { MessageBubble } from '../../src/components/inbox/MessageBubble';
import { MessageIcon } from '../../src/components/MessageIcon';
import { EmptyState } from '../../src/components/EmptyState';
import { useMessagesStore, useApplicationsStore } from '../../src/store';
import { useThemeStore } from '../../src/store/theme';
import type { MessageResponse } from '../../src/api/types';

export default function ThreadScreen() {
  const { sourceId } = useLocalSearchParams<{ sourceId: string }>();
  const { isDark } = useThemeStore();
  const { getMessagesForSource, sourceMeta } = useMessagesStore();
  const { getApp } = useApplicationsStore();

  const decodedId = decodeURIComponent(sourceId ?? '');
  const messages = getMessagesForSource(decodedId);
  const meta = sourceMeta.get(decodedId);

  // Resolve source name and icon
  let sourceName = meta?.name ?? decodedId;
  let iconUrl = meta?.iconUrl ?? null;
  let appId: number | undefined;

  if (decodedId.startsWith('app:')) {
    const id = parseInt(decodedId.split(':')[1], 10);
    const app = getApp(id);
    if (app) {
      sourceName = app.name;
      appId = app.id;
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-light-bg dark:bg-surface-bg" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons
            name="arrow-back"
            size={24}
            color={isDark ? '#f1f5f9' : '#111827'}
          />
        </Pressable>
        <MessageIcon
          appId={appId}
          iconUrl={iconUrl}
          name={sourceName}
          size={32}
        />
        <View>
          <Text className="text-[16px] font-bold text-slate-900 dark:text-slate-100">
            {sourceName}
          </Text>
          <Text className="text-caption text-slate-400">
            {messages.length} message{messages.length !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      {/* Messages */}
      <LegendList
        data={messages}
        keyExtractor={(item: MessageResponse) => String(item.id)}
        renderItem={({ item }: { item: MessageResponse }) => (
          <MessageBubble message={item} />
        )}
        recycleItems
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 16 }}
        ListEmptyComponent={
          <EmptyState
            icon="chatbubble-outline"
            title="No messages"
            subtitle="Messages from this source will appear here"
          />
        }
      />
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Verify thread navigation works**

Test: Tap a source group in Inbox → thread opens with messages. Back button returns to Inbox.

- [ ] **Step 4: Commit**

```bash
git add client/app/thread/ client/src/components/inbox/MessageBubble.tsx && git commit -m "feat(mobile): add message thread drill-down with full message rendering"
```

---

## Phase 3: Channels + Hub

### Task 11: Build Channels Screen

**Files:**
- Rewrite: `client/app/(tabs)/channels.tsx`
- Create: `client/src/components/channels/ChannelRow.tsx`
- Create: `client/src/components/channels/FolderSection.tsx`
- Create: `client/src/components/channels/PublishModal.tsx`

- [ ] **Step 1: Create ChannelRow**

```typescript
// client/src/components/channels/ChannelRow.tsx
import React from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import * as DropdownMenu from 'zeego/dropdown-menu';
import { AnimatedPressable } from '../design/AnimatedPressable';
import { useChannelsStore } from '../../store';
import type { Topic } from '../../api/types';

export function ChannelRow({ topic }: { topic: Topic }) {
  const { isPinned, pinTopic, unpinTopic, folders, moveToFolder } = useChannelsStore();
  const pinned = isPinned(topic.name);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        <AnimatedPressable
          onPress={() => router.push(`/thread/${encodeURIComponent(`topic:${topic.name}`)}`)}
          className="px-4 py-3 flex-row justify-between items-center bg-white dark:bg-surface-card rounded-lg mx-4 mb-1.5"
        >
          <View className="flex-row items-center gap-2.5">
            {pinned && <View className="w-2 h-2 rounded-full bg-success" />}
            <Text className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">
              {topic.name}
            </Text>
          </View>
          {topic.description && (
            <Text className="text-caption text-slate-400" numberOfLines={1}>
              {topic.description}
            </Text>
          )}
        </AnimatedPressable>
      </DropdownMenu.Trigger>

      <DropdownMenu.Content>
        <DropdownMenu.Item
          key="pin"
          onSelect={() => pinned ? unpinTopic(topic.name) : pinTopic(topic.name)}
        >
          <DropdownMenu.ItemTitle>
            {pinned ? 'Unpin' : 'Pin to Top'}
          </DropdownMenu.ItemTitle>
        </DropdownMenu.Item>

        {folders.map((folder) => (
          <DropdownMenu.Item
            key={`move-${folder.id}`}
            onSelect={() => moveToFolder(topic.name, folder.id)}
          >
            <DropdownMenu.ItemTitle>
              Move to {folder.name}
            </DropdownMenu.ItemTitle>
          </DropdownMenu.Item>
        ))}

        <DropdownMenu.Item
          key="remove-folder"
          onSelect={() => moveToFolder(topic.name, null)}
        >
          <DropdownMenu.ItemTitle>Remove from Folder</DropdownMenu.ItemTitle>
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
```

- [ ] **Step 2: Create FolderSection**

```typescript
// client/src/components/channels/FolderSection.tsx
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChannelRow } from './ChannelRow';
import type { Topic } from '../../api/types';

interface Props {
  title: string;
  icon: string;
  color: string;
  topics: Topic[];
  collapsed?: boolean;
  onToggle?: () => void;
  count?: number;
}

export function FolderSection({ title, icon, color, topics, collapsed, onToggle, count }: Props) {
  if (topics.length === 0) return null;

  return (
    <View className="mb-4">
      <Pressable
        onPress={onToggle}
        className="flex-row items-center justify-between px-4 mb-2"
      >
        <View className="flex-row items-center gap-1.5">
          <Text className="text-[10px] uppercase tracking-wider font-semibold" style={{ color }}>
            {icon} {title}
          </Text>
        </View>
        {collapsed !== undefined && (
          <Text className="text-[12px] text-slate-400">
            {collapsed ? `▶ ${count ?? topics.length} topics` : '▼'}
          </Text>
        )}
      </Pressable>

      {!collapsed && topics.map((topic) => (
        <ChannelRow key={topic.name} topic={topic} />
      ))}
    </View>
  );
}
```

- [ ] **Step 3: Build Channels screen**

Rewrite `client/app/(tabs)/channels.tsx`:

```typescript
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedPressable } from '../../src/components/design/AnimatedPressable';
import { FolderSection } from '../../src/components/channels/FolderSection';
import { EmptyState } from '../../src/components/EmptyState';
import { useChannelsStore } from '../../src/store';

export default function ChannelsScreen() {
  const {
    isLoading, fetchTopics,
    getFolderedTopics, toggleFolderCollapsed,
    createFolder, folders,
  } = useChannelsStore();
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [mqttCollapsed, setMqttCollapsed] = useState(true);

  useEffect(() => { fetchTopics(); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTopics();
    setRefreshing(false);
  }, []);

  const { pinned, folders: userFolders, mqtt, other } = getFolderedTopics();

  // Search filter
  const filterTopics = (topics: any[]) =>
    search ? topics.filter(t => t.name.toLowerCase().includes(search.toLowerCase())) : topics;

  const handleCreateFolder = () => {
    Alert.prompt('New Folder', 'Enter folder name:', (name) => {
      if (name?.trim()) createFolder(name.trim());
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-light-bg dark:bg-surface-bg" edges={['top']}>
      <View className="px-4 pt-2 pb-3">
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-display text-slate-900 dark:text-slate-100">
            Channels
          </Text>
          <AnimatedPressable onPress={handleCreateFolder}>
            <Ionicons name="folder-open-outline" size={22} color="#64748b" />
          </AnimatedPressable>
        </View>
        <TextInput
          className="bg-surface-light-elevated dark:bg-surface-elevated rounded-lg px-3 py-2 text-[14px] text-slate-900 dark:text-slate-100"
          placeholder="Search channels..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {pinned.length === 0 && mqtt.length === 0 && other.length === 0 && userFolders.length === 0 ? (
          <EmptyState icon="radio-outline" title="No channels" subtitle="Topics you subscribe to will appear here" />
        ) : (
          <>
            <FolderSection
              title="Pinned"
              icon="📌"
              color="#3b82f6"
              topics={filterTopics(pinned)}
            />

            {userFolders.map((folder) => (
              <FolderSection
                key={folder.id}
                title={folder.name}
                icon="📁"
                color="#a78bfa"
                topics={filterTopics(folder.topics)}
                collapsed={folder.collapsed}
                onToggle={() => toggleFolderCollapsed(folder.id)}
              />
            ))}

            <FolderSection
              title="MQTT Topics"
              icon="🔌"
              color="#f59e0b"
              topics={filterTopics(mqtt)}
              collapsed={mqttCollapsed}
              onToggle={() => setMqttCollapsed(!mqttCollapsed)}
              count={mqtt.length}
            />

            <FolderSection
              title="Other"
              icon=""
              color="#6b7280"
              topics={filterTopics(other)}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add client/app/(tabs)/channels.tsx client/src/components/channels/ && git commit -m "feat(mobile): build Channels screen with folders, MQTT auto-group, pinning, Zeego menus"
```

---

### Task 12: Build Hub Screen + Drill-Down Routes

**Files:**
- Rewrite: `client/app/(tabs)/hub.tsx`
- Create: `client/src/components/hub/IntegrationTile.tsx`
- Create: `client/src/components/hub/SettingsRow.tsx`
- Create: `client/app/hub/apps.tsx`
- Create: `client/app/hub/webhooks.tsx`
- Create: `client/app/hub/mqtt.tsx`
- Create: `client/app/hub/clients.tsx`
- Create: `client/app/hub/settings.tsx`
- Create: `client/app/hub/users.tsx`

- [ ] **Step 1: Create IntegrationTile and SettingsRow**

```typescript
// client/src/components/hub/IntegrationTile.tsx
import React from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { AnimatedPressable } from '../design/AnimatedPressable';

interface Props {
  icon: string;
  title: string;
  subtitle: string;
  href: string;
}

export function IntegrationTile({ icon, title, subtitle, href }: Props) {
  return (
    <AnimatedPressable
      onPress={() => router.push(href as any)}
      className="flex-1 bg-white dark:bg-surface-card rounded-xl p-4"
    >
      <Text className="text-[18px] mb-1.5">{icon}</Text>
      <Text className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </Text>
      <Text className="text-caption text-slate-400 mt-0.5">{subtitle}</Text>
    </AnimatedPressable>
  );
}
```

```typescript
// client/src/components/hub/SettingsRow.tsx
import React from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { AnimatedPressable } from '../design/AnimatedPressable';

interface Props {
  title: string;
  value?: string;
  href?: string;
  onPress?: () => void;
}

export function SettingsRow({ title, value, href, onPress }: Props) {
  return (
    <AnimatedPressable
      onPress={href ? () => router.push(href as any) : onPress}
      className="bg-white dark:bg-surface-card rounded-lg px-4 py-3 flex-row justify-between items-center mb-1"
    >
      <Text className="text-[13px] text-slate-900 dark:text-slate-100">{title}</Text>
      <Text className="text-[12px] text-slate-400">{value ?? '→'}</Text>
    </AnimatedPressable>
  );
}
```

- [ ] **Step 2: Build Hub screen**

Rewrite `client/app/(tabs)/hub.tsx`:

```typescript
import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IntegrationTile } from '../../src/components/hub/IntegrationTile';
import { SettingsRow } from '../../src/components/hub/SettingsRow';
import { AnimatedPressable } from '../../src/components/design/AnimatedPressable';
import { useAuthStore, useApplicationsStore } from '../../src/store';
import { useThemeStore } from '../../src/store/theme';

export default function HubScreen() {
  const { user, serverUrl, logout } = useAuthStore();
  const { apps } = useApplicationsStore();
  const { mode, setMode, isDark } = useThemeStore();
  const isAdmin = user?.admin === true;

  const initial = (user?.name ?? '?')[0].toUpperCase();
  const themeLabel = mode === 'system' ? 'System' : mode === 'dark' ? 'Dark' : 'Light';

  const cycleTheme = () => {
    const next = mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light';
    setMode(next);
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-light-bg dark:bg-surface-bg" edges={['top']}>
      <ScrollView className="flex-1 px-4 pt-2">
        {/* User header */}
        <View className="flex-row items-center gap-3 mb-6 mt-2">
          <View className="w-11 h-11 rounded-xl bg-primary items-center justify-center">
            <Text className="text-white text-[18px] font-bold">{initial}</Text>
          </View>
          <View>
            <Text className="text-[15px] font-bold text-slate-900 dark:text-slate-100">
              {user?.name}
            </Text>
            <Text className="text-caption text-slate-400">
              {isAdmin ? 'admin' : 'user'} · {serverUrl?.replace(/^https?:\/\//, '')}
            </Text>
          </View>
        </View>

        {/* Integrations grid */}
        <Text className="text-[10px] uppercase tracking-wider font-semibold text-primary mb-2.5">
          Integrations
        </Text>
        <View className="flex-row gap-2 mb-2">
          <IntegrationTile
            icon="📱"
            title="Apps"
            subtitle={`${apps.size} registered`}
            href="/hub/apps"
          />
          <IntegrationTile
            icon="🔗"
            title="Webhooks"
            subtitle="Manage"
            href="/hub/webhooks"
          />
        </View>
        <View className="flex-row gap-2 mb-6">
          <IntegrationTile
            icon="🔌"
            title="MQTT"
            subtitle="Config"
            href="/hub/mqtt"
          />
          <IntegrationTile
            icon="🔑"
            title="Clients"
            subtitle="Manage"
            href="/hub/clients"
          />
        </View>

        {/* Account */}
        <Text className="text-[10px] uppercase tracking-wider font-semibold text-accent mb-2.5">
          Account
        </Text>
        <View className="mb-6">
          <SettingsRow title="Change Password" href="/hub/settings" />
          <SettingsRow title="Notifications" href="/hub/settings" />
          <SettingsRow title="Appearance" value={themeLabel} onPress={cycleTheme} />
        </View>

        {/* Admin section */}
        {isAdmin && (
          <>
            <Text className="text-[10px] uppercase tracking-wider font-semibold text-error mb-2.5">
              Admin
            </Text>
            <View className="mb-6">
              <SettingsRow title="User Management" href="/hub/users" />
              <SettingsRow title="Server Info" href="/hub/settings" />
            </View>
          </>
        )}

        {/* Footer */}
        <View className="items-center py-6 border-t border-slate-100 dark:border-slate-800 mt-4">
          <Text className="text-caption text-slate-300">rstify mobile</Text>
          <AnimatedPressable onPress={logout} className="mt-3">
            <Text className="text-caption text-error">Logout</Text>
          </AnimatedPressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Create Hub drill-down screens**

These screens adapt the existing code from the old tab screens. For each, read the corresponding `_ref_*.tsx` file and port the functionality using NativeWind classes. The key screens:

Create `client/app/hub/apps.tsx` — Port from `_ref_apps.tsx`. Keep full CRUD: list apps, create modal, edit modal, icon upload, copy token. Replace StyleSheet with NativeWind className props.

Create `client/app/hub/webhooks.tsx` — Port from `_ref_webhooks.tsx`. Keep full CRUD: incoming/outgoing webhooks, create/edit/test, delivery logs. This is the largest screen (~16K lines). Replace StyleSheet with NativeWind.

Create `client/app/hub/settings.tsx` — Port account-related settings from `_ref_settings.tsx`: password change, server URL, notification preferences.

Create `client/app/hub/users.tsx` — Port admin sections from `_ref_settings.tsx`: user management, permissions.

Create `client/app/hub/mqtt.tsx` — Port MQTT sections from `_ref_settings.tsx`: bridge config, broker status.

Create `client/app/hub/clients.tsx` — Port client token management from `_ref_settings.tsx`: create/delete client tokens, FCM registration.

Each screen should:
- Use `SafeAreaView` with back button header
- Use NativeWind classes throughout
- Import shared components (AnimatedPressable, EmptyState, etc.)
- Keep the same API calls via `rstifyClient`

**Implementation note for agents:** These are straight ports — the logic and API calls are identical to the reference files. The only change is styling (StyleSheet → NativeWind className). Read the reference file first, then create the new file with the same logic but NativeWind styling. For the webhooks screen (16K lines), consider splitting into sub-components for incoming vs outgoing webhooks.

- [ ] **Step 4: Commit each drill-down screen separately**

```bash
git add client/app/hub/apps.tsx && git commit -m "feat(mobile): port Apps management to Hub drill-down"
git add client/app/hub/webhooks.tsx && git commit -m "feat(mobile): port Webhooks builder to Hub drill-down"
git add client/app/hub/settings.tsx && git commit -m "feat(mobile): port account settings to Hub drill-down"
git add client/app/hub/users.tsx && git commit -m "feat(mobile): port admin user management to Hub drill-down"
git add client/app/hub/mqtt.tsx && git commit -m "feat(mobile): add MQTT config screen in Hub"
git add client/app/hub/clients.tsx && git commit -m "feat(mobile): port client token management to Hub drill-down"
```

---

## Phase 4: Polish + Feature Parity + Cleanup

### Task 13: Login Screen Rewrite

**Files:**
- Rewrite: `client/app/login.tsx`

- [ ] **Step 1: Read current login screen**

Read `client/app/login.tsx`.

- [ ] **Step 2: Rewrite with NativeWind**

Port the login screen to NativeWind. Keep: username/password inputs, server URL toggle, validation, haptic feedback. Add: entrance animation (fade in + slide up).

- [ ] **Step 3: Commit**

```bash
git add client/app/login.tsx && git commit -m "feat(mobile): rewrite login screen with NativeWind + entrance animation"
```

---

### Task 14: Delete Old Files + Cleanup

**Files:**
- Delete: `client/app/(tabs)/_ref_apps.tsx`
- Delete: `client/app/(tabs)/_ref_topics.tsx`
- Delete: `client/app/(tabs)/_ref_webhooks.tsx`
- Delete: `client/app/(tabs)/_ref_settings.tsx`
- Delete: `client/src/theme/colors.ts`
- Verify: No imports reference deleted files

- [ ] **Step 1: Remove old reference files**

```bash
cd /home/jsprague/dev/rstify/client
rm -f app/\(tabs\)/_ref_apps.tsx
rm -f app/\(tabs\)/_ref_topics.tsx
rm -f app/\(tabs\)/_ref_webhooks.tsx
rm -f app/\(tabs\)/_ref_settings.tsx
rm -f src/theme/colors.ts
```

- [ ] **Step 2: Grep for stale imports**

Search for any remaining imports of deleted files or old patterns:
```bash
grep -r "colors.ts\|_ref_\|Colors\.\|StyleSheet\.create\|from.*theme/colors" client/src/ client/app/ --include="*.ts" --include="*.tsx"
```

Fix any found references.

- [ ] **Step 3: Remove old dependencies**

```bash
cd /home/jsprague/dev/rstify/client
npx expo install --check
npm uninstall @react-native-async-storage/async-storage react-native-markdown-display
```

**Note:** Keep `expo-secure-store` for one more release (migration reads from it). Remove in a follow-up after users have had time to upgrade.

- [ ] **Step 4: Full build verification**

```bash
cd /home/jsprague/dev/rstify/client && npx expo start --clear
```

Test all flows:
- Login → Inbox loads with grouped messages
- Toggle Stream view → flat chronological list
- Tap source group → thread drill-down
- Back → returns to Inbox
- Channels tab → folders with MQTT collapsed
- Pin/unpin a topic
- Hub tab → integration tiles, settings
- Hub → Apps → create/edit/delete app
- Hub → Webhooks → create/test webhook
- Hub → Settings → change theme
- Logout → login screen

- [ ] **Step 5: Commit cleanup**

```bash
git add -A && git commit -m "chore(mobile): remove old screens, colors.ts, and stale dependencies"
```

---

### Task 15: Final Polish Pass

**Files:**
- Various animation and accessibility improvements across all screens

- [ ] **Step 1: Add staggered list entrance animations**

In `InboxScreen` and `ChannelsScreen`, wrap list items with Reanimated entering animation:

```typescript
import Animated, { FadeInDown } from 'react-native-reanimated';

// Wrap each list item:
<Animated.View entering={FadeInDown.delay(index * 50).springify()}>
  <SourceGroupCard source={item} />
</Animated.View>
```

- [ ] **Step 2: Add FAB for quick actions**

In Channels screen, add a floating action button for creating topics:

```typescript
<AnimatedPressable
  className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-primary items-center justify-center shadow-lg"
  onPress={handleCreateTopic}
>
  <Ionicons name="add" size={28} color="white" />
</AnimatedPressable>
```

Add spring entrance animation on mount.

- [ ] **Step 3: Accessibility labels**

Add `accessibilityLabel` and `accessibilityRole` to key interactive elements:
- Tab bar items
- Source group cards (`accessibilityRole="button"`, label with source name + unread count)
- Swipeable rows (hint about swipe gestures)
- Action buttons
- Settings rows

- [ ] **Step 4: Verify all animations and gestures**

Manual test:
- Skeleton shimmer on load
- Staggered fade-in on list appear
- Swipe left to delete (red background, item slides out)
- Swipe right to mark read (blue background)
- Button press scale + haptic
- Segmented control animation
- Connection status pulse
- FAB spring entrance
- Thread shared element feel (icon + name in header)

- [ ] **Step 5: Final commit**

```bash
git add -A && git commit -m "feat(mobile): add entrance animations, FAB, accessibility labels, final polish"
```

---

## Verification Checklist

After all tasks complete, verify:

- [ ] App launches without crash
- [ ] MMKV migration works (existing tokens preserved)
- [ ] 3-tab navigation (Inbox, Channels, Hub)
- [ ] Inbox grouped view shows messages by source
- [ ] Inbox stream view shows chronological messages
- [ ] Thread drill-down renders full messages with markdown, actions, attachments
- [ ] Channels shows pinned, user folders, MQTT (collapsed), other
- [ ] Hub shows integration grid, account settings, admin (if applicable)
- [ ] All Hub drill-downs work (Apps, Webhooks, MQTT, Clients, Settings, Users)
- [ ] WebSocket real-time messages arrive and group correctly
- [ ] Swipe gestures work (delete, mark read)
- [ ] Zeego context menus appear on long press
- [ ] Dark mode works throughout
- [ ] Skeleton loading on first load
- [ ] Pull-to-refresh on all lists
- [ ] Search filters in Inbox and Channels
- [ ] Offline: cached messages show on launch before fetch completes
- [ ] Login/logout flow works
- [ ] No TypeScript errors: `npx tsc --noEmit`
- [ ] No stale imports to deleted files
