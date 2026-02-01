import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { getApiClient, initApiClient } from "../api";
import type { UserResponse } from "../api";

const TOKEN_KEY = "rstify_token";
const SERVER_URL_KEY = "rstify_server_url";
const DEFAULT_SERVER_URL = "http://localhost:8080";

interface AuthState {
  token: string | null;
  user: UserResponse | null;
  serverUrl: string;
  isLoading: boolean;
  isAuthenticated: boolean;

  initialize: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setServerUrl: (url: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  serverUrl: DEFAULT_SERVER_URL,
  isLoading: true,
  isAuthenticated: false,

  initialize: async () => {
    try {
      const serverUrl =
        (await SecureStore.getItemAsync(SERVER_URL_KEY)) ?? DEFAULT_SERVER_URL;
      const token = await SecureStore.getItemAsync(TOKEN_KEY);

      const api = initApiClient(serverUrl);

      if (token) {
        api.setToken(token);
        try {
          const user = await api.currentUser();
          set({
            token,
            user,
            serverUrl,
            isLoading: false,
            isAuthenticated: true,
          });
          return;
        } catch {
          // Token expired or invalid
          await SecureStore.deleteItemAsync(TOKEN_KEY);
        }
      }

      set({ serverUrl, isLoading: false, isAuthenticated: false });
    } catch {
      set({ isLoading: false, isAuthenticated: false });
    }
  },

  login: async (username: string, password: string) => {
    const api = getApiClient();
    const res = await api.login({ username, password });
    api.setToken(res.token);

    await SecureStore.setItemAsync(TOKEN_KEY, res.token);

    const user = await api.currentUser();

    set({
      token: res.token,
      user,
      isAuthenticated: true,
    });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    getApiClient().setToken(null);
    set({
      token: null,
      user: null,
      isAuthenticated: false,
    });
  },

  setServerUrl: async (url: string) => {
    const cleaned = url.replace(/\/$/, "");
    await SecureStore.setItemAsync(SERVER_URL_KEY, cleaned);
    initApiClient(cleaned);

    // If authenticated, need to re-login
    const { token } = get();
    if (token) {
      await get().logout();
    }

    set({ serverUrl: cleaned });
  },
}));
