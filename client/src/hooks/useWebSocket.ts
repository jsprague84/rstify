import { useEffect, useRef, useCallback } from "react";
import { getApiClient } from "../api";
import type { MessageResponse } from "../api";

interface UseWebSocketOptions {
  clientToken: string | null;
  onMessage: (msg: MessageResponse) => void;
  enabled?: boolean;
  reconnectIntervalMs?: number;
}

export function useUserWebSocket({
  clientToken,
  onMessage,
  enabled = true,
  reconnectIntervalMs = 5000,
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMessageRef = useRef(onMessage);
  const enabledRef = useRef(enabled);

  // Keep refs in sync without triggering reconnects
  onMessageRef.current = onMessage;
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
  }, []);

  useEffect(() => {
    if (!clientToken || !enabled) {
      disconnect();
      return;
    }

    const scheduleReconnect = () => {
      if (reconnectTimerRef.current) return;
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        connect();
      }, reconnectIntervalMs);
    };

    const connect = () => {
      if (!enabledRef.current) return;

      const api = getApiClient();
      const ws = api.connectUserStream(
        clientToken,
        (msg) => onMessageRef.current(msg),
        () => scheduleReconnect(),
        () => scheduleReconnect(),
      );

      wsRef.current = ws;
    };

    connect();

    return disconnect;
  }, [clientToken, enabled, reconnectIntervalMs, disconnect]);

  return { disconnect };
}
