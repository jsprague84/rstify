/**
 * Normalize an unknown thrown value into a user-facing error string.
 * Centralizes the `err instanceof Error ? err.message : String(err)` pattern
 * duplicated across every page handler.
 */
export function normalizeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'An unexpected error occurred';
}
