import { getApiClient } from "../api";
import { createCache } from "../utils/cache";

// This device's own client (id + token), persisted so the WebSocket and FCM
// registration use a stable client we own — not an arbitrary clients[0] that
// may belong to the web UI or another device.
const mobileClientCache = createCache<{ id: number; token: string }>("mobile_client");

/**
 * Resolve this device's own client: reuse the persisted one if it still
 * exists server-side, otherwise create a fresh one and persist it.
 */
export async function ensureMobileClient(): Promise<{ id: number; token: string }> {
  const api = getApiClient();

  let client = mobileClientCache.load();
  if (client) {
    const clients = await api.listClients();
    if (!clients.some((c) => c.id === client!.id)) {
      client = null;
    }
  }
  if (!client) {
    const created = await api.createClient({ name: "rstify-mobile", scopes: null });
    client = { id: created.id, token: created.token };
    mobileClientCache.save(client);
  }
  return client;
}
