import { useEffect, useRef, useCallback, useState } from "react";
import { getApiClient } from "../api";
import type { MessageResponse } from "../api";

export type ConnectionStatus = "connected" | "reconnecting" | "disconnected";

interface UseWebSocketOptions {
  clientToken: string | null;
  onMessage: (msg: MessageResponse) => void;
  /** Fired when the socket reopens after a drop, so the caller can refetch
   *  messages that arrived while disconnected (the stream only pushes live ones). */
  onReconnect?: () => void;
  enabled?: boolean;
}

const MAX_BACKOFF_MS = 30000;

export function useUserWebSocket({
  clientToken,
  onMessage,
  onReconnect,
  enabled = true,
}: UseWebSocketOptions) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMessageRef = useRef(onMessage);
  const onReconnectRef = useRef(onReconnect);
  const enabledRef = useRef(enabled);
  const backoffRef = useRef(1000);
  const hasConnectedRef = useRef(false);

  // Keep refs in sync without triggering reconnects
  onMessageRef.current = onMessage;
  onReconnectRef.current = onReconnect;
  enabledRef.current = enabled;

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnectionStatus("disconnected");
  }, []);

  useEffect(() => {
    if (!clientToken || !enabled) {
      disconnect();
      return;
    }

    const scheduleReconnect = () => {
      if (reconnectTimerRef.current) return;
      // Retry indefinitely with capped backoff — a long outage (sleep, no network)
      // must still recover when connectivity returns, not give up permanently.
      setConnectionStatus("reconnecting");
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);
        connect();
      }, backoffRef.current);
    };

    const connect = () => {
      if (!enabledRef.current) return;
      setConnectionStatus("reconnecting");

      const api = getApiClient();
      const ws = api.connectUserStream(
        clientToken,
        (msg) => onMessageRef.current(msg),
        () => scheduleReconnect(),
        () => scheduleReconnect(),
      );

      const originalOnOpen = ws.onopen;
      ws.onopen = (ev) => {
        backoffRef.current = 1000;
        setConnectionStatus("connected");
        // Catch up on anything published while disconnected (skip the first open).
        if (hasConnectedRef.current) {
          onReconnectRef.current?.();
        }
        hasConnectedRef.current = true;
        if (originalOnOpen) (originalOnOpen as (ev: Event) => void)(ev);
      };

      wsRef.current = ws;
    };

    connect();

    return disconnect;
  }, [clientToken, enabled, disconnect]);

  return { disconnect, connectionStatus };
}
