import { useState, useCallback, useEffect } from 'react';
import { normalizeError } from '../utils/normalizeError';

interface CrudResource<T> {
  /** The current list of items. */
  items: T[];
  /** True during initial load or reload. */
  loading: boolean;
  /** Page-level error message (from load or mutation failures). */
  error: string | null;
  /** Re-fetch the list from the API. */
  reload: () => Promise<void>;
  /** Wrap a mutation (create/update/delete): runs fn, reloads on success, sets error on failure. Returns true on success. */
  mutate: (fn: () => Promise<void>) => Promise<boolean>;
  /** Clear the current error. */
  clearError: () => void;
}

/**
 * Manages CRUD resource lifecycle: load list, expose loading/error/reload,
 * and wrap mutations with consistent error handling and reload semantics.
 *
 * Does NOT manage: modal state, selection state, filtering/sorting UI, form shape.
 *
 * IMPORTANT: fetchAll must be stable (wrapped in useCallback or defined outside render)
 * to prevent infinite reload loops.
 *
 * Usage:
 *   const fetchClients = useCallback(() => api.listClients(), []);
 *   const crud = useCrudResource(fetchClients);
 *   // crud.items, crud.loading, crud.error, crud.reload
 *   // const ok = await crud.mutate(() => api.deleteClient(id));
 */
export function useCrudResource<T>(fetchAll: () => Promise<T[]>): CrudResource<T> {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAll();
      setItems(data);
    } catch (e) {
      setError(normalizeError(e));
    } finally {
      setLoading(false);
    }
  }, [fetchAll]);

  useEffect(() => {
    reload();
  }, [reload]);

  const mutate = useCallback(
    async (fn: () => Promise<void>): Promise<boolean> => {
      try {
        await fn();
        await reload();
        return true;
      } catch (e) {
        setError(normalizeError(e));
        return false;
      }
    },
    [reload],
  );

  const clearError = useCallback(() => setError(null), []);

  return { items, loading, error, reload, mutate, clearError };
}
