import { create } from "zustand";
import { getApiClient } from "../api";
import type { MessageResponse } from "../api";

interface MessagesState {
  messages: MessageResponse[];
  isLoading: boolean;
  error: string | null;

  fetchMessages: (limit?: number, since?: number) => Promise<void>;
  addMessage: (msg: MessageResponse) => void;
  deleteMessage: (id: number) => Promise<void>;
  deleteAllMessages: () => Promise<void>;
  clear: () => void;
}

export const useMessagesStore = create<MessagesState>((set, get) => ({
  messages: [],
  isLoading: false,
  error: null,

  fetchMessages: async (limit = 100, since = 0) => {
    set({ isLoading: true, error: null });
    try {
      const api = getApiClient();
      const result = await api.listMessages(limit, since);
      set({ messages: result.messages, isLoading: false });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Failed to fetch messages",
        isLoading: false,
      });
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
    set({ messages: [] });
  },

  clear: () => set({ messages: [], error: null }),
}));
