import { create } from "zustand";
import { getApiClient } from "../api";
import type { Topic } from "../api";
import { storage } from "../storage/mmkv";

const FOLDERS_KEY = "channel_folders";
const PINNED_KEY = "channel_pinned";

// --- Types ---

export interface Folder {
  id: string;
  name: string;
  topicNames: string[];
  collapsed: boolean;
}

interface FolderedTopics {
  pinned: Topic[];
  folders: (Folder & { topics: Topic[] })[];
  mqtt: Topic[];
  other: Topic[];
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
  getFolderedTopics: () => FolderedTopics;
}

// --- Persistence helpers ---

function loadFolders(): Folder[] {
  try {
    const raw = storage.getString(FOLDERS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveFolders(folders: Folder[]) {
  storage.set(FOLDERS_KEY, JSON.stringify(folders));
}

function loadPinned(): string[] {
  try {
    const raw = storage.getString(PINNED_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function savePinned(pinned: string[]) {
  storage.set(PINNED_KEY, JSON.stringify(pinned));
}

function isMqtt(topic: Topic): boolean {
  const name = topic.name.toLowerCase();
  // Slash paths (standard MQTT), contains "mqtt", or dot-hierarchical (2+ dots = bridged MQTT)
  return name.includes("/") || name.includes("mqtt") || (name.split(".").length > 2);
}

// --- Store ---

export const useChannelsStore = create<ChannelsState>((set, get) => ({
  topics: [],
  folders: loadFolders(),
  pinnedTopics: loadPinned(),
  isLoading: false,

  fetchTopics: async () => {
    set({ isLoading: true });
    try {
      const api = getApiClient();
      const topics = await api.listTopics();
      set({ topics, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  createFolder: (name: string) => {
    const id = `folder_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    set((state) => {
      const folders = [
        ...state.folders,
        { id, name, topicNames: [], collapsed: false },
      ];
      saveFolders(folders);
      return { folders };
    });
  },

  deleteFolder: (id: string) => {
    set((state) => {
      const folders = state.folders.filter((f) => f.id !== id);
      saveFolders(folders);
      return { folders };
    });
  },

  moveToFolder: (topicName: string, folderId: string | null) => {
    set((state) => {
      // Remove from all folders first
      const folders = state.folders.map((f) => ({
        ...f,
        topicNames: f.topicNames.filter((n) => n !== topicName),
      }));

      // Add to target folder if specified
      if (folderId) {
        const target = folders.find((f) => f.id === folderId);
        if (target) {
          target.topicNames.push(topicName);
        }
      }

      saveFolders(folders);
      return { folders };
    });
  },

  toggleFolderCollapsed: (folderId: string) => {
    set((state) => {
      const folders = state.folders.map((f) =>
        f.id === folderId ? { ...f, collapsed: !f.collapsed } : f,
      );
      saveFolders(folders);
      return { folders };
    });
  },

  pinTopic: (topicName: string) => {
    set((state) => {
      if (state.pinnedTopics.includes(topicName)) return state;
      const pinnedTopics = [...state.pinnedTopics, topicName];
      savePinned(pinnedTopics);
      return { pinnedTopics };
    });
  },

  unpinTopic: (topicName: string) => {
    set((state) => {
      const pinnedTopics = state.pinnedTopics.filter((n) => n !== topicName);
      savePinned(pinnedTopics);
      return { pinnedTopics };
    });
  },

  isPinned: (topicName: string) => {
    return get().pinnedTopics.includes(topicName);
  },

  isMqttTopic: (topic: Topic) => {
    return isMqtt(topic);
  },

  getFolderedTopics: () => {
    const { topics, folders, pinnedTopics } = get();
    const topicByName = new Map(topics.map((t) => [t.name, t]));

    // Collect topics assigned to folders
    const inFolder = new Set<string>();
    for (const folder of folders) {
      for (const name of folder.topicNames) {
        inFolder.add(name);
      }
    }

    // Pinned topics (resolved to Topic objects)
    const pinned = pinnedTopics
      .map((name) => topicByName.get(name))
      .filter((t): t is Topic => t !== undefined);

    // Folders with resolved topics
    const foldersWithTopics = folders.map((f) => ({
      ...f,
      topics: f.topicNames
        .map((name) => topicByName.get(name))
        .filter((t): t is Topic => t !== undefined),
    }));

    // Remaining topics not in any folder
    const remaining = topics.filter((t) => !inFolder.has(t.name));
    const mqtt = remaining.filter((t) => isMqtt(t));
    const other = remaining.filter((t) => !isMqtt(t));

    return { pinned, folders: foldersWithTopics, mqtt, other };
  },
}));
