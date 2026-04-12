import { useEffect, useRef, useCallback, useState } from 'react';
import type { MessageResponse } from 'shared';

export type WsStatus = 'connected' | 'reconnecting' | 'disconnected';

/**
 * Hook that connects to the Gotify-compatible /stream WebSocket endpoint.
 * Calls onMessage for each new message received.
 * Automatically reconnects with exponential backoff on disconnect.
 * Returns connection status.
 */
export function useMessageStream(onMessage: (msg: MessageResponse) => void): WsStatus {
  const [status, setStatus] = useState<WsStatus>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const backoff = useRef(1000);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    const token = localStorage.getItem('rstify_token');
    if (!token) return;

    setStatus('reconnecting');
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${location.host}/stream?token=${encodeURIComponent(token)}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      backoff.current = 1000;
      setStatus('connected');
    };

    ws.onmessage = (event) => {
      try {
        const msg: MessageResponse = JSON.parse(event.data);
        onMessageRef.current(msg);
      } catch {
        // ignore non-JSON frames (ping/pong)
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      setStatus('reconnecting');
      reconnectTimer.current = setTimeout(() => {
        backoff.current = Math.min(backoff.current * 2, 30000);
        connect();
      }, backoff.current);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
      setStatus('disconnected');
    };
  }, [connect]);

  return status;
}
