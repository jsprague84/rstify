import { create } from "zustand";
import { getApiClient } from "../api";
import type { MessageResponse } from "../api";

interface MessagesState {
  messages: MessageResponse[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;

  fetchMessages: (limit?: number, since?: number) => Promise<void>;
  fetchOlderMessages: () => Promise<void>;
  addMessage: (msg: MessageResponse) => void;
  deleteMessage: (id: number) => Promise<void>;
  deleteAllMessages: () => Promise<void>;
  clear: () => void;
}

const PAGE_SIZE = 50;

export const useMessagesStore = create<MessagesState>((set, get) => ({
  messages: [],
  isLoading: false,
  isLoadingMore: false,
  hasMore: true,
  error: null,

  fetchMessages: async (limit = PAGE_SIZE, since = 0) => {
    set({ isLoading: true, error: null });
    try {
      const api = getApiClient();
      const result = await api.listMessages(limit, since);
      set({
        messages: result.messages,
        isLoading: false,
        hasMore: result.messages.length >= limit,
      });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Failed to fetch messages",
        isLoading: false,
      });
    }
  },

  fetchOlderMessages: async () => {
    const { messages, isLoadingMore, hasMore } = get();
    if (isLoadingMore || !hasMore || messages.length === 0) return;

    set({ isLoadingMore: true });
    try {
      const api = getApiClient();
      const lastId = messages[messages.length - 1].id;
      const result = await api.listMessages(PAGE_SIZE, 0);
      // Filter to only messages older than our oldest
      const older = result.messages.filter((m) => m.id < lastId);
      set((state) => ({
        messages: [...state.messages, ...older],
        isLoadingMore: false,
        hasMore: older.length >= PAGE_SIZE,
      }));
    } catch {
      set({ isLoadingMore: false });
    }
  },

  addMessage: (msg: MessageResponse) => {
    set((state) => {
      // Deduplicate: WebSocket may deliver messages already in the list
      if (state.messages.some((m) => m.id === msg.id)) {
        return state;
      }
      return { messages: [msg, ...state.messages] };
    });
  },

  deleteMessage: async (id: number) => {
    const api = getApiClient();
    await api.deleteMessage(id);
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== id),
    }));
  },

  deleteAllMessages: async () => {
    const api = getApiClient();
    await api.deleteAllMessages();
    set({ messages: [], hasMore: false });
  },

  clear: () => set({ messages: [], error: null, hasMore: true }),
}));
