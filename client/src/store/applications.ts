import { create } from "zustand";
import { getApiClient } from "../api";
import type { Application } from "../api";

interface ApplicationsState {
  apps: Map<number, Application>;
  isLoaded: boolean;

  fetchApplications: () => Promise<void>;
  getApp: (id: number) => Application | undefined;
  getIconUrl: (appId: number) => string | null;
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

  clear: () => set({ apps: new Map(), isLoaded: false }),
}));
