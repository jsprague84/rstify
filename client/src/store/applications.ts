import { create } from "zustand";
import { getApiClient } from "../api";
import type { Application } from "../api";
import { createCache } from "../utils/cache";

const appCache = createCache<[number, Application][]>("app_cache");

interface ApplicationsState {
  apps: Map<number, Application>;
  isLoaded: boolean;

  fetchApplications: () => Promise<void>;
  getApp: (id: number) => Application | undefined;
  getIconUrl: (appId: number) => string | null;
  loadFromCache: () => void;
  clear: () => void;
}

export const useApplicationsStore = create<ApplicationsState>((set, get) => ({
  apps: new Map(),
  isLoaded: false,

  fetchApplications: async () => {
    try {
      const api = getApiClient();
      const list = await api.listApplications();
      const map = new Map<number, Application>();
      for (const app of list) {
        map.set(app.id, app);
      }
      set({ apps: map, isLoaded: true });

      // Save to cache
      try {
        const serializable = list.map((app) => [app.id, app] as [number, Application]);
        appCache.save(serializable);
      } catch {
        // Cache save failure is non-critical
      }
    } catch {
      // Silently fail — icons are a nice-to-have, not critical
    }
  },

  getApp: (id: number) => get().apps.get(id),

  getIconUrl: (appId: number) => {
    const app = get().apps.get(appId);
    if (!app?.image) return null;
    const api = getApiClient();
    return api.applicationIconUrl(appId);
  },

  loadFromCache: () => {
    const entries = appCache.load();
    if (!entries) return;
    const map = new Map<number, Application>(entries);
    set({ apps: map, isLoaded: true });
  },

  clear: () => {
    appCache.clear();
    set({ apps: new Map(), isLoaded: false });
  },
}));
