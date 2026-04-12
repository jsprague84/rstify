import { useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';

function normalizeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'An unexpected error occurred';
}

interface HubData<T> {
  /** The current list of items. */
  items: T[];
  /** True during load/reload. */
  isLoading: boolean;
  /** Re-fetch from API. Alerts on error unless silent=true. */
  refresh: (silent?: boolean) => Promise<void>;
  /** Wrap a mutation: runs fn, refreshes on success, shows Alert on failure. Returns true on success. */
  mutate: (fn: () => Promise<unknown>) => Promise<boolean>;
}

/**
 * Shared fetch/error/loading lifecycle for mobile hub screens.
 * Replaces the duplicated useState + useCallback + try-catch + Alert.alert pattern.
 *
 * Initial load is silent (no Alert popup on app open).
 * Pull-to-refresh and mutations show Alerts on failure.
 *
 * Usage:
 *   const { items, isLoading, refresh, mutate } = useHubData(() => api.listClients());
 */
export function useHubData<T>(fetchFn: () => Promise<T[]>): HubData<T> {
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async (silent = false) => {
    setIsLoading(true);
    try {
      const data = await fetchFn();
      setItems(data);
    } catch (e) {
      if (!silent) {
        Alert.alert('Error', normalizeError(e));
      }
    } finally {
      setIsLoading(false);
    }
  }, [fetchFn]);

  // Initial load is silent — no Alert popup if server is unreachable at startup
  useEffect(() => {
    refresh(true);
  }, [refresh]);

  const mutate = useCallback(
    async (fn: () => Promise<unknown>): Promise<boolean> => {
      try {
        await fn();
        await refresh();
        return true;
      } catch (e) {
        Alert.alert('Error', normalizeError(e));
        return false;
      }
    },
    [refresh],
  );

  return { items, isLoading, refresh, mutate };
}
