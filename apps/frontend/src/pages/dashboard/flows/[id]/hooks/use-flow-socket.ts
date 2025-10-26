import { useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Node, Edge, NodeChange, EdgeChange } from 'reactflow';
import { getAuthTokens } from '@/utils/token-utils';
import { toast } from '@/lib/toast-utils';

const SOCKET_URL = import.meta.env.VITE_WS_URL || 'http://localhost:8000/';
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECTION_DELAY = 1000;
const CONNECTION_TIMEOUT = 10000;

const mapBackendTypeToFrontend = (backendType: string): string => {
  switch (backendType) {
    case 'TEXT_INPUT':
    case 'DOCUMENT_INPUT':
    case 'URL_INPUT':
    case 'IMAGE_INPUT':
    case 'VIDEO_INPUT':
    case 'AUDIO_INPUT':
      return 'SOURCE';
    case 'LLM_PROMPT':
    case 'EMBEDDING_POD':
    case 'TOOL_POD':
    case 'CODE_EXECUTION':
      return 'LLM';
    case 'TEXT_OUTPUT':
    case 'IMAGE_OUTPUT':
    case 'VIDEO_OUTPUT':
    case 'AUDIO_OUTPUT':
      return 'OUTPUT';
    default:
      return 'LLM';
  }
};

const mapPodToNode = (pod: any): Node => {
  return {
    id: pod.id,
    type: mapBackendTypeToFrontend(pod.type),
    position: pod.content?.position || pod.position || { x: 0, y: 0 },
    data: {
      label: pod.content?.label || pod.type,
      config: pod.content?.config || {},
      executionStatus: pod.executionStatus || 'IDLE',
      backendType: pod.type,
      ...pod.content,
    },
  };
};

export function useFlowSocket(
  flowId: string,
  onNodesChange: (changes: NodeChange[]) => void,
  onEdgesChange: (changes: EdgeChange[]) => void,
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>,
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>,
  onNodeAdded: (node: Node) => void,
  onNodeDeleted: (nodeId: string) => void,
  onEdgeAdded: (edge: Edge) => void,
  onEdgeDeleted: (edgeId: string) => void,
  onExecutionStarted: (podId: string) => void,
  onExecutionCompleted: (podId: string) => void,
  onExecutionError: (podId: string) => void
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
      console.log('[FlowSocket] Connection already active or attempting.');
      return;
    }

    isConnecting.current = true;
    hasShownMaxReconnectError.current = false;

    try {
      socketRef.current = io(`${SOCKET_URL}flows`, {
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
        console.log('[FlowSocket] Connected:', socket.id);
        reconnectAttempts.current = 0;
        isConnecting.current = false;
        hasShownMaxReconnectError.current = false;
      });

      socket.on('connected', () => {
        console.log('[FlowSocket] Authenticated & Joined');
        socket.emit('flow:join', {
          flowId,
          userName: 'User',
          userColor: '#' + Math.floor(Math.random() * 16777215).toString(16),
        });
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
        if (error.message?.includes('Authentication') || error.code === 'AUTH_ERROR') {
          toast.error('Authentication failed', {
            description: 'Please log in again',
          });
          socket.disconnect();
        }
      });

      socket.on('pod:created', (data: { pod: any; userId: string; timestamp: string }) => {
        try {
          if (data.userId !== socket.id) {
            console.log('[FlowSocket] Received pod:created', data.pod);
            const newNode = mapPodToNode(data.pod);
            onNodeAdded(newNode);
          }
        } catch (error) {
          console.error('[FlowSocket] Error handling pod:created:', error);
        }
      });

      socket.on(
        'pod:updated',
        (data: { podId: string; updates: any; userId: string; timestamp: string }) => {
          try {
            if (data.userId !== socket.id) {
              console.log('[FlowSocket] Received pod:updated', data.podId);
              const updatedNode = mapPodToNode(data.updates);
              setNodes((nds) => nds.map((n) => (n.id === data.podId ? updatedNode : n)));
            }
          } catch (error) {
            console.error('[FlowSocket] Error handling pod:updated:', error);
          }
        }
      );

      socket.on('pod:deleted', (data: { podId: string; userId: string; timestamp: string }) => {
        try {
          if (data.userId !== socket.id) {
            onNodeDeleted(data.podId);
          }
        } catch (error) {
          console.error('[FlowSocket] Error handling pod:deleted:', error);
        }
      });

      socket.on(
        'pod:moved',
        (data: { podId: string; position: { x: number; y: number }; userId: string }) => {
          try {
            if (data.userId !== socket.id) {
              onNodesChange([
                { id: data.podId, type: 'position', position: data.position, dragging: false },
              ]);
            }
          } catch (error) {
            console.error('[FlowSocket] Error handling pod:moved:', error);
          }
        }
      );

      socket.on('pod:locked', () => {});
      socket.on('pod:unlocked', () => {});

      socket.on('edge:created', (data: { edge: any; userId: string; timestamp: string }) => {
        try {
          if (data.userId !== socket.id) {
            const newEdge: Edge = {
              id: data.edge.id,
              source: data.edge.sourcePodId,
              target: data.edge.targetPodId,
              sourceHandle: data.edge.sourceHandle,
              targetHandle: data.edge.targetHandle,
              type: 'animated',
              animated: true,
            };
            onEdgeAdded(newEdge);
          }
        } catch (error) {
          console.error('[FlowSocket] Error handling edge:created:', error);
        }
      });

      socket.on('edge:deleted', (data: { edgeId: string; userId: string; timestamp: string }) => {
        try {
          if (data.userId !== socket.id) {
            onEdgeDeleted(data.edgeId);
          }
        } catch (error) {
          console.error('[FlowSocket] Error handling edge:deleted:', error);
        }
      });

      socket.on(
        'execution:started',
        (data: { executionId: string; podId: string; status: string; timestamp: string }) => {
          onExecutionStarted(data.podId);
        }
      );

      socket.on('execution:token', () => {});

      socket.on(
        'execution:completed',
        (data: {
          executionId: string;
          podId: string;
          status: string;
          result: any;
          timestamp: string;
        }) => {
          onExecutionCompleted(data.podId);
        }
      );

      socket.on(
        'execution:error',
        (data: {
          executionId: string;
          podId: string;
          status: string;
          error: string;
          timestamp: string;
        }) => {
          onExecutionError(data.podId);
        }
      );

      socket.on(
        'user:joined',
        (data: {
          userId: string;
          socketId: string;
          flowId: string;
          userName?: string;
          userColor?: string;
          joinedAt: Date;
        }) => {
          toast.info(`${data.userName || 'Someone'} joined`, { duration: 2000 });
        }
      );

      socket.on('user:left', () => {});
      socket.on('flow:users', () => {});

      socket.on('nodes:updated', ({ nodes, socketId }: { nodes: Node[]; socketId: string }) => {
        try {
          if (socketId !== socket.id) {
            setNodes(nodes);
          }
        } catch (error) {
          console.error('[FlowSocket] Error handling nodes update:', error);
        }
      });

      socket.on('edges:updated', ({ edges, socketId }: { edges: Edge[]; socketId: string }) => {
        try {
          if (socketId !== socket.id) {
            setEdges(edges);
          }
        } catch (error) {
          console.error('[FlowSocket] Error handling edges update:', error);
        }
      });

      socket.io.on('reconnect', (attempt: number) => {
        reconnectAttempts.current = 0;
        toast.success('Reconnected', {
          description: `Connection restored after ${attempt} attempt${attempt !== 1 ? 's' : ''}`,
        });
        socket.emit('flow:join', { flowId });
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
    onNodesChange,
    onEdgesChange,
    setNodes,
    setEdges,
    onNodeAdded,
    onNodeDeleted,
    onEdgeAdded,
    onEdgeDeleted,
    onExecutionStarted,
    onExecutionCompleted,
    onExecutionError,
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
      if (!socketRef.current?.connected) return;
      socketRef.current.emit('nodes:update', { nodes });
    } catch (error) {
      console.error('[FlowSocket] Error emitting nodes update:', error);
    }
  }, []);

  const emitEdgesUpdate = useCallback((edges: Edge[]) => {
    try {
      if (!socketRef.current?.connected) return;
      socketRef.current.emit('edges:update', { edges });
    } catch (error) {
      console.error('[FlowSocket] Error emitting edges update:', error);
    }
  }, []);

  const emitNodeAdd = useCallback((node: Node) => {
    try {
      if (!socketRef.current?.connected) return;
      socketRef.current.emit('pod:create', { pod: node });
    } catch (error) {
      console.error('[FlowSocket] Error emitting node add:', error);
    }
  }, []);

  const emitNodeDelete = useCallback((nodeId: string) => {
    try {
      if (!socketRef.current?.connected) return;
      socketRef.current.emit('pod:delete', { podId: nodeId });
    } catch (error) {
      console.error('[FlowSocket] Error emitting node delete:', error);
    }
  }, []);

  const emitEdgeAdd = useCallback((edge: Edge) => {
    try {
      if (!socketRef.current?.connected) return;
      socketRef.current.emit('edge:create', { edge });
    } catch (error) {
      console.error('[FlowSocket] Error emitting edge add:', error);
    }
  }, []);

  const emitEdgeDelete = useCallback((edgeId: string) => {
    try {
      if (!socketRef.current?.connected) return;
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
