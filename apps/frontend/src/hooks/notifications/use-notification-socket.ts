import { useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from '@/lib/toast-utils';
import { getAuthTokens } from '@/utils/token-utils';

const SOCKET_URL = import.meta.env.VITE_WS_URL || 'http://localhost:8000';

export function useNotificationSocket(
  onNewNotification: (notification: any) => void,
  onUnreadCountUpdate: (count: number) => void
) {
  const socketRef = useRef<Socket | null>(null);
  const reconnectAttempts = useRef(0);
  const isConnecting = useRef(false);
  const MAX_RECONNECT_ATTEMPTS = 5;

  const connect = useCallback(() => {
    const tokens = getAuthTokens();
    if (!tokens?.accessToken) {
      return;
    }

    // Prevent duplicate connections
    if (socketRef.current?.connected || isConnecting.current) {
      return;
    }

    isConnecting.current = true;

    socketRef.current = io(`${SOCKET_URL}/notifications`, {
      auth: { token: tokens.accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      // Timeout for connection attempt
      timeout: 10000,
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      reconnectAttempts.current = 0;
      isConnecting.current = false;
    });

    socket.on('connected', () => {
      // Successfully authenticated
    });

    socket.on('disconnect', (reason: string) => {
      isConnecting.current = false;
      if (reason === 'io server disconnect') {
        // Server disconnected us, could be auth failure
        console.warn('Disconnected by server');
      }
    });

    socket.on('connect_error', (error: Error) => {
      if (error) {
        //Empty
      }
      isConnecting.current = false;
      reconnectAttempts.current += 1;

      if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
        console.error('Max reconnection attempts reached');
        socket.disconnect();
      }
    });

    socket.on('error', (error: any) => {
      if (error.message?.includes('Authentication')) {
        socket.disconnect();
      }
    });

    socket.on('notification:new', (notification: any) => {
      onNewNotification(notification);

      toast.info(notification.title, {
        description: notification.body,
      });
    });

    socket.on('notification:unread_count', (count: number) => {
      onUnreadCountUpdate(count);
    });
  }, [onNewNotification, onUnreadCountUpdate]);

  useEffect(() => {
    connect();

    return () => {
      if (socketRef.current) {
        isConnecting.current = false;
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [connect]);
}
