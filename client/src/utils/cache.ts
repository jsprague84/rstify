import { storage } from '../storage/mmkv';

type MMKVStorage = typeof storage;

interface CacheHelpers<T> {
  /** Load cached data, or null if missing/corrupt. */
  load: () => T | null;
  /** Save data to cache. */
  save: (data: T) => void;
  /** Remove cached data. */
  clear: () => void;
}

/**
 * Create typed cache read/write helpers for a given MMKV key.
 * Replaces duplicated loadFromCache/saveToCache across Zustand stores.
 *
 * Usage:
 *   const appCache = createCache<Application[]>('app_cache');
 *   const cached = appCache.load();
 *   appCache.save(freshData);
 */
export function createCache<T>(key: string, mmkv: MMKVStorage = storage): CacheHelpers<T> {
  return {
    load: (): T | null => {
      const raw = mmkv.getString(key);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    },
    save: (data: T) => {
      mmkv.set(key, JSON.stringify(data));
    },
    clear: () => {
      mmkv.remove(key);
    },
  };
}
