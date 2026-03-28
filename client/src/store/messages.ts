import { create } from "zustand";
import { getApiClient } from "../api";
import type { MessageResponse } from "../api";
import { storage } from "../storage/mmkv";
import { useApplicationsStore } from "./applications";

const CACHE_KEY = "msg_cache_groups";
const MAX_MESSAGES_PER_SOURCE = 100;
const PAGE_SIZE = 50;
const SAVE_DEBOUNCE_MS = 2000;

// --- Types ---

export interface SourceMeta {
  sourceId: string;
  name: string;
  iconUrl: string | null;
  sourceType: "app" | "topic";
  unreadCount: number;
  latestTimestamp: string;
  latestPreview: string;
  priority: number;
}

interface MessagesState {
  groupedMessages: Map<string, MessageResponse[]>;
  sourceMeta: Map<string, SourceMeta>;
  viewMode: "grouped" | "stream";
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;

  fetchMessages: () => Promise<void>;
  fetchOlderMessages: () => Promise<void>;
  addMessage: (msg: MessageResponse) => void;
  deleteMessage: (id: number) => Promise<void>;
  deleteGroup: (sourceId: string) => Promise<void>;
  deleteAllMessages: () => Promise<void>;
  markGroupRead: (sourceId: string) => void;
  setViewMode: (mode: "grouped" | "stream") => void;
  getStreamMessages: () => MessageResponse[];
  getGroupedSources: () => SourceMeta[];
  getMessagesForSource: (sourceId: string) => MessageResponse[];
  loadFromCache: () => void;
  saveToCache: () => void;
  clear: () => void;
}

// --- Helpers ---

function getSourceId(msg: MessageResponse): string {
  if (msg.topic) {
    return `topic:${msg.topic}`;
  }
  return `app:${msg.appid ?? 0}`;
}

function buildSourceMeta(
  sourceId: string,
  messages: MessageResponse[],
): SourceMeta {
  const isTopic = sourceId.startsWith("topic:");
  const latest = messages[0]; // messages are sorted newest-first

  let name: string;
  let iconUrl: string | null = null;

  if (isTopic) {
    name = sourceId.slice("topic:".length);
  } else {
    const appId = parseInt(sourceId.slice("app:".length), 10);
    const app = useApplicationsStore.getState().getApp(appId);
    name = app?.name ?? `App ${appId}`;
    iconUrl = useApplicationsStore.getState().getIconUrl(appId);
  }

  // Highest priority in the group
  const priority = messages.reduce(
    (max, m) => Math.max(max, m.priority),
    0,
  );

  return {
    sourceId,
    name,
    iconUrl,
    sourceType: isTopic ? "topic" : "app",
    unreadCount: messages.length,
    latestTimestamp: latest?.date ?? "",
    latestPreview: latest?.title ?? latest?.message?.slice(0, 80) ?? "",
    priority,
  };
}

function groupMessages(
  messages: MessageResponse[],
): Map<string, MessageResponse[]> {
  const groups = new Map<string, MessageResponse[]>();
  for (const msg of messages) {
    const sourceId = getSourceId(msg);
    const group = groups.get(sourceId);
    if (group) {
      group.push(msg);
    } else {
      groups.set(sourceId, [msg]);
    }
  }
  // Sort each group newest-first and cap at MAX_MESSAGES_PER_SOURCE
  for (const [key, group] of groups) {
    group.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    if (group.length > MAX_MESSAGES_PER_SOURCE) {
      groups.set(key, group.slice(0, MAX_MESSAGES_PER_SOURCE));
    }
  }
  return groups;
}

function rebuildAllMeta(
  groups: Map<string, MessageResponse[]>,
): Map<string, SourceMeta> {
  const meta = new Map<string, SourceMeta>();
  for (const [sourceId, messages] of groups) {
    if (messages.length > 0) {
      meta.set(sourceId, buildSourceMeta(sourceId, messages));
    }
  }
  return meta;
}

// Debounce timer handle
let saveCacheTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedSaveToCache(state: MessagesState) {
  if (saveCacheTimer) {
    clearTimeout(saveCacheTimer);
  }
  saveCacheTimer = setTimeout(() => {
    state.saveToCache();
    saveCacheTimer = null;
  }, SAVE_DEBOUNCE_MS);
}

// --- Store ---

export const useMessagesStore = create<MessagesState>((set, get) => ({
  groupedMessages: new Map(),
  sourceMeta: new Map(),
  viewMode: "grouped",
  isLoading: false,
  isLoadingMore: false,
  hasMore: true,

  fetchMessages: async () => {
    set({ isLoading: true });
    try {
      const api = getApiClient();
      const result = await api.listMessages(PAGE_SIZE, 0);
      const groups = groupMessages(result.messages);
      const meta = rebuildAllMeta(groups);
      set({
        groupedMessages: groups,
        sourceMeta: meta,
        isLoading: false,
        hasMore: result.messages.length >= PAGE_SIZE,
      });
      debouncedSaveToCache(get());
    } catch {
      set({ isLoading: false });
    }
  },

  fetchOlderMessages: async () => {
    const { isLoadingMore, hasMore } = get();
    if (isLoadingMore || !hasMore) return;

    // Find the overall oldest message ID across all groups
    const allMessages = get().getStreamMessages();
    if (allMessages.length === 0) return;

    const oldestId = allMessages[allMessages.length - 1].id;

    set({ isLoadingMore: true });
    try {
      const api = getApiClient();
      const result = await api.listMessages(PAGE_SIZE, oldestId);

      if (result.messages.length === 0) {
        set({ isLoadingMore: false, hasMore: false });
        return;
      }

      // Merge older messages into existing groups
      const groups = new Map(get().groupedMessages);
      for (const msg of result.messages) {
        const sourceId = getSourceId(msg);
        const existing = groups.get(sourceId) ?? [];
        // Deduplicate
        if (!existing.some((m) => m.id === msg.id)) {
          existing.push(msg);
        }
        groups.set(sourceId, existing);
      }

      // Re-sort and cap each group
      for (const [key, group] of groups) {
        group.sort(
          (a, b) =>
            new Date(b.date).getTime() - new Date(a.date).getTime(),
        );
        if (group.length > MAX_MESSAGES_PER_SOURCE) {
          groups.set(key, group.slice(0, MAX_MESSAGES_PER_SOURCE));
        }
      }

      const meta = rebuildAllMeta(groups);
      set({
        groupedMessages: groups,
        sourceMeta: meta,
        isLoadingMore: false,
        hasMore: result.messages.length >= PAGE_SIZE,
      });
      debouncedSaveToCache(get());
    } catch {
      set({ isLoadingMore: false });
    }
  },

  addMessage: (msg: MessageResponse) => {
    set((state) => {
      const sourceId = getSourceId(msg);
      const groups = new Map(state.groupedMessages);
      const existing = groups.get(sourceId) ?? [];

      // Deduplicate
      if (existing.some((m) => m.id === msg.id)) {
        return state;
      }

      const updated = [msg, ...existing];
      // Cap at limit
      groups.set(
        sourceId,
        updated.length > MAX_MESSAGES_PER_SOURCE
          ? updated.slice(0, MAX_MESSAGES_PER_SOURCE)
          : updated,
      );

      const meta = new Map(state.sourceMeta);
      meta.set(sourceId, buildSourceMeta(sourceId, groups.get(sourceId)!));

      return { groupedMessages: groups, sourceMeta: meta };
    });
    debouncedSaveToCache(get());
  },

  deleteMessage: async (id: number) => {
    const api = getApiClient();
    await api.deleteMessage(id);

    set((state) => {
      const groups = new Map(state.groupedMessages);
      const meta = new Map(state.sourceMeta);

      for (const [sourceId, messages] of groups) {
        const filtered = messages.filter((m) => m.id !== id);
        if (filtered.length !== messages.length) {
          if (filtered.length === 0) {
            groups.delete(sourceId);
            meta.delete(sourceId);
          } else {
            groups.set(sourceId, filtered);
            meta.set(sourceId, buildSourceMeta(sourceId, filtered));
          }
          break;
        }
      }

      return { groupedMessages: groups, sourceMeta: meta };
    });
    debouncedSaveToCache(get());
  },

  deleteGroup: async (sourceId: string) => {
    const state = get();
    const messages = state.groupedMessages.get(sourceId);
    if (!messages || messages.length === 0) return;

    // Optimistically remove from UI immediately
    set((prev) => {
      const groups = new Map(prev.groupedMessages);
      const meta = new Map(prev.sourceMeta);
      groups.delete(sourceId);
      meta.delete(sourceId);
      return { groupedMessages: groups, sourceMeta: meta };
    });
    debouncedSaveToCache(get());

    // Fire server deletes in the background; failures are ignored
    const api = getApiClient();
    await Promise.allSettled(messages.map((m) => api.deleteMessage(m.id)));
  },

  deleteAllMessages: async () => {
    const api = getApiClient();
    await api.deleteAllMessages();
    set({
      groupedMessages: new Map(),
      sourceMeta: new Map(),
      hasMore: false,
    });
    storage.remove(CACHE_KEY);
  },

  markGroupRead: (sourceId: string) => {
    set((state) => {
      const meta = new Map(state.sourceMeta);
      const existing = meta.get(sourceId);
      if (existing) {
        meta.set(sourceId, { ...existing, unreadCount: 0 });
      }
      return { sourceMeta: meta };
    });
  },

  setViewMode: (mode: "grouped" | "stream") => {
    set({ viewMode: mode });
  },

  getStreamMessages: () => {
    const { groupedMessages } = get();
    const all: MessageResponse[] = [];
    for (const messages of groupedMessages.values()) {
      all.push(...messages);
    }
    all.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    return all;
  },

  getGroupedSources: () => {
    const { sourceMeta } = get();
    const sources = Array.from(sourceMeta.values());
    // Sort by latest timestamp descending (most recent first)
    sources.sort(
      (a, b) =>
        new Date(b.latestTimestamp).getTime() -
        new Date(a.latestTimestamp).getTime(),
    );
    return sources;
  },

  getMessagesForSource: (sourceId: string) => {
    return get().groupedMessages.get(sourceId) ?? [];
  },

  loadFromCache: () => {
    try {
      const cached = storage.getString(CACHE_KEY);
      if (!cached) return;
      const entries: [string, MessageResponse[]][] = JSON.parse(cached);
      const groups = new Map<string, MessageResponse[]>(entries);
      const meta = rebuildAllMeta(groups);
      set({ groupedMessages: groups, sourceMeta: meta });
    } catch {
      // Cache load failure is non-critical
    }
  },

  saveToCache: () => {
    try {
      const { groupedMessages } = get();
      const entries = Array.from(groupedMessages.entries());
      storage.set(CACHE_KEY, JSON.stringify(entries));
    } catch {
      // Cache save failure is non-critical
    }
  },

  clear: () => {
    if (saveCacheTimer) {
      clearTimeout(saveCacheTimer);
      saveCacheTimer = null;
    }
    storage.remove(CACHE_KEY);
    set({
      groupedMessages: new Map(),
      sourceMeta: new Map(),
      hasMore: true,
    });
  },
}));
