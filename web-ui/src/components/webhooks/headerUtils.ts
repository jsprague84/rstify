/**
 * Structured header model for the outgoing-webhook editor.
 *
 * The rows array is the single source of truth: the Content-Type picker, the
 * Auth section, and the raw key/value grid all read from and write to the
 * same rows, so no affordance can silently clobber another.
 */

export interface HeaderRow {
  key: string;
  value: string;
}

export function headersJsonToRows(headers: string | null | undefined): HeaderRow[] {
  if (!headers) return [];
  try {
    const obj = JSON.parse(headers) as Record<string, string>;
    return Object.entries(obj).map(([key, value]) => ({ key, value: String(value) }));
  } catch {
    return [];
  }
}

export function rowsToHeadersObject(rows: HeaderRow[]): Record<string, string> | null {
  const obj: Record<string, string> = {};
  for (const r of rows) {
    if (r.key.trim()) obj[r.key.trim()] = r.value;
  }
  return Object.keys(obj).length > 0 ? obj : null;
}

export function getHeader(rows: HeaderRow[], key: string): string | undefined {
  return rows.find((r) => r.key.trim().toLowerCase() === key.toLowerCase())?.value;
}

/** Set (replace case-insensitively, or append) a header. Returns new rows. */
export function setHeader(rows: HeaderRow[], key: string, value: string): HeaderRow[] {
  const idx = rows.findIndex((r) => r.key.trim().toLowerCase() === key.toLowerCase());
  if (idx >= 0) {
    const next = rows.slice();
    next[idx] = { key: rows[idx].key, value };
    return next;
  }
  return [...rows, { key, value }];
}

export function removeHeader(rows: HeaderRow[], key: string): HeaderRow[] {
  return rows.filter((r) => r.key.trim().toLowerCase() !== key.toLowerCase());
}

export type AuthType = 'none' | 'bearer' | 'basic' | 'apikey';

export interface DetectedAuth {
  type: AuthType;
  token?: string;
  username?: string;
  password?: string;
  keyName?: string;
  keyValue?: string;
}

export function detectAuth(rows: HeaderRow[]): DetectedAuth {
  const auth = getHeader(rows, 'Authorization');
  if (!auth) return { type: 'none' };
  if (auth.startsWith('Bearer ')) return { type: 'bearer', token: auth.slice(7) };
  if (auth.startsWith('Basic ')) {
    try {
      const [username, ...rest] = atob(auth.slice(6)).split(':');
      return { type: 'basic', username, password: rest.join(':') };
    } catch {
      return { type: 'basic' };
    }
  }
  return { type: 'none' };
}

/** Apply an auth choice to the rows (removing any previous Authorization). */
export function applyAuth(rows: HeaderRow[], auth: DetectedAuth): HeaderRow[] {
  let next = removeHeader(rows, 'Authorization');
  if (auth.type === 'bearer' && auth.token) {
    next = setHeader(next, 'Authorization', `Bearer ${auth.token}`);
  } else if (auth.type === 'basic' && auth.username) {
    next = setHeader(next, 'Authorization', `Basic ${btoa(`${auth.username}:${auth.password || ''}`)}`);
  } else if (auth.type === 'apikey' && auth.keyName && auth.keyValue) {
    next = setHeader(next, auth.keyName, auth.keyValue);
  }
  return next;
}

/**
 * Translate backend delivery/validation errors into plain language. The SSRF
 * guard's raw message ("blocked by SSRF guard: …") is correct but opaque to
 * anyone who didn't write it.
 */
export function friendlyWebhookError(message: string): string {
  if (/ssrf|private|loopback|link-local|resolved to/i.test(message)) {
    return (
      `${message}\n\nrstify blocks webhook deliveries to private or internal network addresses so a ` +
      `webhook can't be used to probe your LAN. If this target is intentional (e.g. a homelab ` +
      `service), start the server with WEBHOOK_ALLOW_PRIVATE_TARGETS=true to allow private targets.`
    );
  }
  return message;
}
