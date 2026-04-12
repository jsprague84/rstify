import { useState, useCallback } from 'react';
import { normalizeError } from '../utils/normalizeError';

interface AsyncAction<T> {
  /** Run the given async function, tracking loading/error state. Returns the result or undefined on failure. */
  execute: (fn: () => Promise<T>) => Promise<T | undefined>;
  loading: boolean;
  error: string | null;
  clearError: () => void;
}

/**
 * Lightweight hook for one-off async operations (password change, webhook test, publish).
 * Manages loading + error state for a single action without the full CRUD lifecycle.
 *
 * Usage:
 *   const action = useAsyncAction<TestResult>();
 *   const result = await action.execute(() => api.testWebhook(id));
 */
export function useAsyncAction<T = void>(): AsyncAction<T> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (fn: () => Promise<T>): Promise<T | undefined> => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn();
      return result;
    } catch (e) {
      setError(normalizeError(e));
      return undefined;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { execute, loading, error, clearError };
}
