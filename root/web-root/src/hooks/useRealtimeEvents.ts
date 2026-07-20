import { useEffect, useRef, useCallback, useState } from 'react';
import { useApolloClient, gql } from '@apollo/client';

/**
 * Real-time events via WebSocket.
 * 
 * Connects to the events WebSocket endpoint and receives:
 * - TASK_UPDATED: Updates task status in Apollo cache
 * - NOTIFICATION_NEW: Increments notification count, adds to notification list
 * - USER_STATUS_CHANGED: Updates user status in cache
 * - PAYROLL_STATUS_CHANGED: Updates payroll run status
 * - PROJECT_UPDATED: Updates project completion/status
 * 
 * Automatically reconnects on disconnect with exponential backoff.
 * Token-authenticated via query param.
 */

const WS_URL = import.meta.env.VITE_CHAT_WS_URL || 'ws://localhost:4003';
const MAX_RECONNECT_DELAY = 30000; // 30 seconds max
const INITIAL_RECONNECT_DELAY = 1000; // 1 second

export type RealtimeEvent = {
  type: 'TASK_UPDATED';
  payload: { taskId: string; projectId: string; status: string; updatedBy: string };
} | {
  type: 'NOTIFICATION_NEW';
  payload: { id: string; title: string; message: string; type: string };
} | {
  type: 'USER_STATUS_CHANGED';
  payload: { userId: string; status: string };
} | {
  type: 'PAYROLL_STATUS_CHANGED';
  payload: { runId: string; status: string; approvedBy?: string };
} | {
  type: 'PROJECT_UPDATED';
  payload: { projectId: string; completionPercentage: number; status: string };
};

export function useRealtimeEvents() {
  const client = useApolloClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [connected, setConnected] = useState(false);

  const handleEvent = useCallback((event: RealtimeEvent) => {
    switch (event.type) {
      case 'TASK_UPDATED': {
        // Update the task in Apollo cache
        const { taskId, status } = event.payload;
        client.cache.modify({
          id: client.cache.identify({ __typename: 'Task', id: taskId }),
          fields: {
            status: () => status,
          },
        });
        break;
      }

      case 'NOTIFICATION_NEW': {
        // Increment unread notification count
        try {
          const existing = client.readQuery({
            query: gql`query { getUnreadNotificationCount }`,
          });
          if (existing) {
            client.writeQuery({
              query: gql`query { getUnreadNotificationCount }`,
              data: { getUnreadNotificationCount: (existing.getUnreadNotificationCount || 0) + 1 },
            });
          }
        } catch {
          // Query not in cache yet, ignore
        }
        break;
      }

      case 'USER_STATUS_CHANGED': {
        const { userId, status } = event.payload;
        client.cache.modify({
          id: client.cache.identify({ __typename: 'User', id: userId }),
          fields: {
            status: () => status,
          },
        });
        break;
      }

      case 'PROJECT_UPDATED': {
        const { projectId, completionPercentage, status } = event.payload;
        client.cache.modify({
          id: client.cache.identify({ __typename: 'Project', id: projectId }),
          fields: {
            completionPercentage: () => completionPercentage,
            status: () => status,
          },
        });
        break;
      }

      case 'PAYROLL_STATUS_CHANGED': {
        // Evict payroll history to force refetch on next view
        client.cache.evict({ fieldName: 'getPayrollHistory' });
        client.cache.gc();
        break;
      }
    }
  }, [client]);

  const connect = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    try {
      // Auth via subprotocol header instead of URL query param (prevents token in logs/history)
      const ws = new WebSocket(`${WS_URL}/events`, [`auth-${token}`]);

      ws.onopen = () => {
        setConnected(true);
        reconnectAttempts.current = 0;
        console.log('[WS] Connected to real-time events');
      };

      ws.onmessage = (msg) => {
        try {
          const event = JSON.parse(msg.data) as RealtimeEvent;
          handleEvent(event);
        } catch {
          // Invalid message format, ignore
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;

        // Reconnect with exponential backoff
        const delay = Math.min(
          INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts.current),
          MAX_RECONNECT_DELAY
        );
        reconnectAttempts.current++;
        reconnectTimer.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close(); // Will trigger onclose → reconnect
      };

      wsRef.current = ws;
    } catch {
      // WebSocket construction failed (bad URL, etc.)
      setConnected(false);
    }
  }, [handleEvent]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  // Reconnect when token changes (login/logout)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'token') {
        if (e.newValue) {
          connect();
        } else {
          if (wsRef.current) wsRef.current.close();
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [connect]);

  return { connected };
}
