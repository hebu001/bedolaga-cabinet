import { useEffect, useRef, useState, useCallback } from 'react';
import { apiClient } from '../api/client';
import { useAuthStore } from '../store/auth';
import { cabinetSocketEndpoints, connectCabinetSocket } from '../utils/cabinetWebSocket';
import { WebSocketContext, type MessageHandler, type WSMessage } from './WebSocketContext';
import { WS } from '../config/constants';

export type { WSMessage } from './WebSocketContext';

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const userId = useAuthStore((state) => state.user?.id);
  const [isConnected, setIsConnected] = useState(false);
  const handlersRef = useRef<Set<MessageHandler>>(new Set());

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      setIsConnected(false);
      return;
    }
    const apiBase = String(import.meta.env.VITE_API_URL || '/api');
    return connectCabinetSocket({
      getTicket: async (signal) => {
        const { ticketPath } = cabinetSocketEndpoints(apiBase, window.location.href, '');
        // apiClient obtains the latest token from storage and refreshes it when
        // needed. The browser supplies Origin; the JWT never enters the WS URL.
        const { data } = await apiClient.post<{ ticket: string }>(ticketPath, null, { signal });
        return data.ticket;
      },
      createSocket: (ticket) =>
        new WebSocket(cabinetSocketEndpoints(apiBase, window.location.href, ticket).socketUrl),
      onConnected: setIsConnected,
      onMessage: (message) => {
        handlersRef.current.forEach((handler) => {
          try {
            handler(message as WSMessage);
          } catch {
            if (import.meta.env.DEV) console.warn('[WS] Subscriber failed');
          }
        });
      },
      maxReconnectAttempts: WS.MAX_RECONNECT_ATTEMPTS,
      maxReconnectDelayMs: WS.MAX_RECONNECT_DELAY_MS,
      pingIntervalMs: WS.PING_INTERVAL_MS,
    });
  }, [isAuthenticated, accessToken, userId]);

  const subscribe = useCallback((handler: MessageHandler) => {
    handlersRef.current.add(handler);
    return () => {
      handlersRef.current.delete(handler);
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{ isConnected, subscribe }}>
      {children}
    </WebSocketContext.Provider>
  );
}
