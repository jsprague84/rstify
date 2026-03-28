import { create } from "zustand";
import { getApiClient, initApiClient } from "../api";
import type { UserResponse } from "../api";
import { secureStorage } from "../storage/mmkv";
import { useApplicationsStore } from "./applications";

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
  logout: () => void;
  setServerUrl: (url: string) => void;
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
        secureStorage.getString(SERVER_URL_KEY) ?? DEFAULT_SERVER_URL;
      const token = secureStorage.getString(TOKEN_KEY) ?? null;

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
          // Fetch application list for icon display
          useApplicationsStore.getState().fetchApplications();
          return;
        } catch {
          // Token expired or invalid
          secureStorage.remove(TOKEN_KEY);
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

    secureStorage.set(TOKEN_KEY, res.token);

    const user = await api.currentUser();

    set({
      token: res.token,
      user,
      isAuthenticated: true,
    });
    // Fetch application list for icon display
    useApplicationsStore.getState().fetchApplications();
  },

  logout: () => {
    secureStorage.remove(TOKEN_KEY);
    getApiClient().setToken(null);
    useApplicationsStore.getState().clear();
    set({
      token: null,
      user: null,
      isAuthenticated: false,
    });
  },

  setServerUrl: (url: string) => {
    const cleaned = url.replace(/\/$/, "");
    secureStorage.set(SERVER_URL_KEY, cleaned);
    initApiClient(cleaned);

    // If authenticated, need to re-login
    const { token } = get();
    if (token) {
      get().logout();
    }

    set({ serverUrl: cleaned });
  },
}));
