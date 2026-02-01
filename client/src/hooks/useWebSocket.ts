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

  const connect = useCallback(() => {
    if (!clientToken || !enabled) return;

    const api = getApiClient();
    const ws = api.connectUserStream(
      clientToken,
      onMessage,
      () => {
        // On error, attempt reconnect
        scheduleReconnect();
      },
      () => {
        // On close, attempt reconnect
        scheduleReconnect();
      },
    );

    wsRef.current = ws;
  }, [clientToken, enabled, onMessage]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimerRef.current) return;
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      connect();
    }, reconnectIntervalMs);
  }, [connect, reconnectIntervalMs]);

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
    connect();
    return disconnect;
  }, [connect, disconnect]);

  return { disconnect };
}
