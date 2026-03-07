import { useEffect, useRef, useCallback, useState } from "react";
import { getApiClient } from "../api";
import type { MessageResponse } from "../api";

export type ConnectionStatus = "connected" | "reconnecting" | "disconnected";

interface UseWebSocketOptions {
  clientToken: string | null;
  onMessage: (msg: MessageResponse) => void;
  enabled?: boolean;
}

const MAX_RETRIES = 50;
const MAX_BACKOFF_MS = 30000;

export function useUserWebSocket({
  clientToken,
  onMessage,
  enabled = true,
}: UseWebSocketOptions) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMessageRef = useRef(onMessage);
  const enabledRef = useRef(enabled);
  const backoffRef = useRef(1000);
  const retriesRef = useRef(0);

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
    setConnectionStatus("disconnected");
  }, []);

  useEffect(() => {
    if (!clientToken || !enabled) {
      disconnect();
      return;
    }

    const scheduleReconnect = () => {
      if (reconnectTimerRef.current) return;
      if (retriesRef.current >= MAX_RETRIES) {
        setConnectionStatus("disconnected");
        return;
      }
      setConnectionStatus("reconnecting");
      retriesRef.current++;
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
        retriesRef.current = 0;
        setConnectionStatus("connected");
        if (originalOnOpen) (originalOnOpen as (ev: Event) => void)(ev);
      };

      wsRef.current = ws;
    };

    connect();

    return disconnect;
  }, [clientToken, enabled, disconnect]);

  return { disconnect, connectionStatus };
}
