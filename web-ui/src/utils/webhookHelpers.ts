export function parseWebhookHeaders(headers: string | undefined | null): Record<string, string> {
  if (!headers) return {};
  try { return JSON.parse(headers); } catch { return {}; }
}

export function parseJsonArray(json: string | undefined | null): string[] {
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}
