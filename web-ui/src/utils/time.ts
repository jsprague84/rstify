/**
 * Normalize a UTC date string from the backend to valid ISO 8601.
 * SQLite datetime('now') produces "2026-03-29 04:31:12" (space, no Z).
 * This normalizes to "2026-03-29T04:31:12Z" for correct UTC parsing.
 */
function normalizeUtcDate(dateStr: string): string {
  if (!dateStr) return dateStr;
  // Already has timezone info — pass through
  if (dateStr.includes('Z') || dateStr.includes('+')) return dateStr;
  // Replace space with T and append Z for UTC
  return dateStr.replace(' ', 'T') + 'Z';
}

/**
 * Format a UTC date string to the user's local time.
 * Handles "2026-03-29 04:31:12", "2026-03-29 04:31:12Z",
 * "2026-03-29T04:31:12Z", and "+00:00" offset formats.
 */
export function formatLocalTime(dateStr: string): string {
  const d = new Date(normalizeUtcDate(dateStr));
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleString();
}

/**
 * Format a UTC date string as a relative time (e.g., "5m ago", "2h ago").
 */
export function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(normalizeUtcDate(dateStr)).getTime();
  if (isNaN(then)) return dateStr;
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(normalizeUtcDate(dateStr)).toLocaleDateString();
}
