// hooks/use-flow-socket.ts
import { useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Node, Edge } from 'reactflow';
import { getAuthTokens } from '@/utils/token-utils';
import { toast } from '@/lib/toast-utils';

const SOCKET_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECTION_DELAY = 1000;
const CONNECTION_TIMEOUT = 10000;

export function useFlowSocket(
  flowId: string,
  onNodesUpdate: (nodes: Node[]) => void,
  onEdgesUpdate: (edges: Edge[]) => void,
  onNodeAdded: (node: Node) => void,
  onNodeDeleted: (nodeId: string) => void,
  onEdgeAdded: (edge: Edge) => void,
  onEdgeDeleted: (edgeId: string) => void
) {
  const socketRef = useRef<Socket | null>(null);
  const reconnectAttempts = useRef(0);
  const isConnecting = useRef(false);
  const hasShownMaxReconnectError = useRef(false);

  const connect = useCallback(() => {
    const tokens = getAuthTokens();

    if (!tokens?.accessToken) {
      console.warn('[FlowSocket] No access token available');
      return;
    }

    if (socketRef.current?.connected || isConnecting.current) {
      return;
    }

    isConnecting.current = true;
    hasShownMaxReconnectError.current = false;

    try {
      socketRef.current = io(`${SOCKET_URL}/flows`, {
        auth: { token: tokens.accessToken },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: RECONNECTION_DELAY,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
        timeout: CONNECTION_TIMEOUT,
      });

      const socket = socketRef.current;

      socket.on('connect', () => {
        reconnectAttempts.current = 0;
        isConnecting.current = false;
        hasShownMaxReconnectError.current = false;
      });

      socket.on('connected', () => {
        socket.emit('flow:join', { flowId });
      });

      socket.on('disconnect', (reason: string) => {
        console.warn(`[FlowSocket] Disconnected: ${reason}`);
        isConnecting.current = false;

        if (reason === 'io server disconnect') {
          toast.error('Disconnected from server', {
            description: 'Please refresh the page',
          });
        }
      });

      socket.on('connect_error', (error: Error) => {
        console.error('[FlowSocket] Connection error:', error.message);
        isConnecting.current = false;
        reconnectAttempts.current += 1;

        if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
          if (!hasShownMaxReconnectError.current) {
            console.error('[FlowSocket] Max reconnection attempts reached');
            toast.error('Connection failed', {
              description: 'Unable to connect to flow editor. Please refresh the page.',
            });
            hasShownMaxReconnectError.current = true;
          }
          socket.disconnect();
        }
      });

      socket.on('error', (error: any) => {
        console.error('[FlowSocket] Socket error:', error);

        if (error.message?.includes('Authentication')) {
          toast.error('Authentication failed', {
            description: 'Please log in again',
          });
          socket.disconnect();
        }
      });

      socket.on('nodes:updated', ({ nodes, socketId }: { nodes: Node[]; socketId: string }) => {
        try {
          if (socketId !== socket.id) {
            onNodesUpdate(nodes);
          }
        } catch (error) {
          console.error('[FlowSocket] Error handling nodes update:', error);
        }
      });

      socket.on('edges:updated', ({ edges, socketId }: { edges: Edge[]; socketId: string }) => {
        try {
          if (socketId !== socket.id) {
            onEdgesUpdate(edges);
          }
        } catch (error) {
          console.error('[FlowSocket] Error handling edges update:', error);
        }
      });

      socket.on('node:added', ({ node }: { node: Node }) => {
        try {
          onNodeAdded(node);
        } catch (error) {
          console.error('[FlowSocket] Error handling node added:', error);
        }
      });

      socket.on('node:deleted', ({ nodeId }: { nodeId: string }) => {
        try {
          onNodeDeleted(nodeId);
        } catch (error) {
          console.error('[FlowSocket] Error handling node deleted:', error);
        }
      });

      socket.on('edge:added', ({ edge }: { edge: Edge }) => {
        try {
          onEdgeAdded(edge);
        } catch (error) {
          console.error('[FlowSocket] Error handling edge added:', error);
        }
      });

      socket.on('edge:deleted', ({ edgeId }: { edgeId: string }) => {
        try {
          onEdgeDeleted(edgeId);
        } catch (error) {
          console.error('[FlowSocket] Error handling edge deleted:', error);
        }
      });

      socket.io.on('reconnect', (attempt: number) => {
        reconnectAttempts.current = 0;
        toast.success('Reconnected', {
          description: `Connection restored after ${attempt} attempt${attempt !== 1 ? 's' : ''}`,
        });
      });

      socket.io.on('reconnect_failed', () => {
        console.error('[FlowSocket] Reconnection failed');
        if (!hasShownMaxReconnectError.current) {
          toast.error('Connection lost', {
            description: 'Unable to reconnect. Please refresh the page.',
          });
          hasShownMaxReconnectError.current = true;
        }
      });
    } catch (error) {
      console.error('[FlowSocket] Failed to initialize socket:', error);
      isConnecting.current = false;
      toast.error('Connection error', {
        description: 'Failed to initialize connection',
      });
    }
  }, [
    flowId,
    onNodesUpdate,
    onEdgesUpdate,
    onNodeAdded,
    onNodeDeleted,
    onEdgeAdded,
    onEdgeDeleted,
  ]);

  useEffect(() => {
    connect();

    return () => {
      if (socketRef.current) {
        isConnecting.current = false;
        socketRef.current.emit('flow:leave');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [connect]);

  const emitNodesUpdate = useCallback((nodes: Node[]) => {
    try {
      if (!socketRef.current?.connected) {
        console.warn('[FlowSocket] Cannot emit nodes update: not connected');
        return;
      }
      socketRef.current.emit('nodes:update', { nodes });
    } catch (error) {
      console.error('[FlowSocket] Error emitting nodes update:', error);
    }
  }, []);

  const emitEdgesUpdate = useCallback((edges: Edge[]) => {
    try {
      if (!socketRef.current?.connected) {
        console.warn('[FlowSocket] Cannot emit edges update: not connected');
        return;
      }
      socketRef.current.emit('edges:update', { edges });
    } catch (error) {
      console.error('[FlowSocket] Error emitting edges update:', error);
    }
  }, []);

  const emitNodeAdd = useCallback((node: Node) => {
    try {
      if (!socketRef.current?.connected) {
        console.warn('[FlowSocket] Cannot emit node add: not connected');
        return;
      }
      socketRef.current.emit('node:add', { node });
    } catch (error) {
      console.error('[FlowSocket] Error emitting node add:', error);
    }
  }, []);

  const emitNodeDelete = useCallback((nodeId: string) => {
    try {
      if (!socketRef.current?.connected) {
        console.warn('[FlowSocket] Cannot emit node delete: not connected');
        return;
      }
      socketRef.current.emit('node:delete', { nodeId });
    } catch (error) {
      console.error('[FlowSocket] Error emitting node delete:', error);
    }
  }, []);

  const emitEdgeAdd = useCallback((edge: Edge) => {
    try {
      if (!socketRef.current?.connected) {
        console.warn('[FlowSocket] Cannot emit edge add: not connected');
        return;
      }
      socketRef.current.emit('edge:add', { edge });
    } catch (error) {
      console.error('[FlowSocket] Error emitting edge add:', error);
    }
  }, []);

  const emitEdgeDelete = useCallback((edgeId: string) => {
    try {
      if (!socketRef.current?.connected) {
        console.warn('[FlowSocket] Cannot emit edge delete: not connected');
        return;
      }
      socketRef.current.emit('edge:delete', { edgeId });
    } catch (error) {
      console.error('[FlowSocket] Error emitting edge delete:', error);
    }
  }, []);

  return {
    emitNodesUpdate,
    emitEdgesUpdate,
    emitNodeAdd,
    emitNodeDelete,
    emitEdgeAdd,
    emitEdgeDelete,
  };
}
