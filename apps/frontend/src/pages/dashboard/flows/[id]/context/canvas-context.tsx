/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useCallback,
  useState,
  useRef,
  useEffect,
  ReactNode,
} from 'react';
import {
  Node,
  Edge,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
  useReactFlow,
} from 'reactflow';
import { useParams } from 'react-router-dom';
import { useWorkspaces } from '@/hooks/use-workspaces';
import { axiosInstance } from '@/lib/axios-instance';
import { toast } from '@/lib/toast-utils';
import { PodExecutionStatus } from '../types';
import dagre from 'dagre';

interface CanvasState {
  nodes: Node[];
  edges: Edge[];
}

interface CanvasContextValue {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  addNode: (node: Partial<Node>) => Promise<string | undefined>;
  deleteNode: (nodeId: string) => Promise<void>;
  addEdge: (edge: Partial<Edge>) => Promise<void>;
  deleteEdge: (edgeId: string) => Promise<void>;
  updateNodeData: (nodeId: string, data: any) => void;
  setNodeStatus: (nodeId: string, status: PodExecutionStatus) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  save: () => Promise<void>;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  isInitializing: boolean;
  autoArrange: () => Promise<void>;
  isArranging: boolean;
}

const CanvasContext = createContext<CanvasContextValue | null>(null);

const MAX_HISTORY = 50;
const AUTO_SAVE_DELAY = 60000;

// Constants for Layout
const NODE_WIDTH = 800;
const DEFAULT_LLM_HEIGHT = 1200;
const DEFAULT_SOURCE_HEIGHT = 600;

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

function CanvasProviderInner({ children }: { children: ReactNode }) {
  const { id: flowId } = useParams<{ id: string }>();
  const { currentWorkspaceId } = useWorkspaces();
  const reactFlowInstance = useReactFlow();

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [history, setHistory] = useState<CanvasState[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isArranging, setIsArranging] = useState(false);

  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const isUndoRedoRef = useRef(false);
  const updateBatchRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const loadCanvas = async () => {
      if (!flowId || !currentWorkspaceId) return;

      try {
        setIsInitializing(true);
        const response = await axiosInstance.get(
          `/workspaces/${currentWorkspaceId}/flows/${flowId}/canvas`
        );

        const canvas = response.data.data || response.data;

        const loadedNodes: Node[] = (canvas.pods || []).map((pod: any) => ({
          id: pod.id,
          type: mapBackendTypeToFrontend(pod.type),
          position: pod.position || { x: 0, y: 0 },
          data: {
            label: pod.content?.label || pod.type,
            config: pod.content?.config || {},
            executionStatus: pod.executionStatus || 'IDLE',
            backendType: pod.type,
            ...pod.content,
            position: undefined,
          },
        }));

        const loadedEdges: Edge[] = (canvas.edges || [])
          .map((edge: any) => ({
            id: edge.id,
            source: edge.sourcePodId,
            target: edge.targetPodId,
            sourceHandle: edge.sourceHandle || null,
            targetHandle: edge.targetHandle || null,
            type: 'animated',
            animated: true,
          }))
          .filter((edge: Edge, index: number, self: Edge[]) => {
            return (
              index ===
              self.findIndex(
                (e: Edge) =>
                  e.source === edge.source &&
                  e.target === edge.target &&
                  e.sourceHandle === edge.sourceHandle &&
                  e.targetHandle === edge.targetHandle
              )
            );
          });

        console.log('Loaded edges count:', loadedEdges.length);

        setNodes(loadedNodes);
        setEdges(loadedEdges);
        const initialState = { nodes: loadedNodes, edges: loadedEdges };
        setHistory([initialState]);
        setCurrentIndex(0);
      } catch (error) {
        console.error('Failed to load canvas:', error);
        toast.error('Failed to load canvas');
      } finally {
        setIsInitializing(false);
      }
    };

    loadCanvas();
  }, [flowId, currentWorkspaceId]);

  const save = useCallback(async () => {
    if (!flowId || !currentWorkspaceId) return;

    let changesToSave = false;
    setHasUnsavedChanges((current) => {
      changesToSave = current;
      return current;
    });

    if (!changesToSave) return;

    const currentNodes = nodesRef.current;
    const viewport = reactFlowInstance.getViewport();

    setIsSaving(true);
    try {
      await Promise.all(
        currentNodes.map(async (node) => {
          if (!node.id.startsWith('temp-')) {
            await axiosInstance.patch(
              `/workspaces/${currentWorkspaceId}/flows/${flowId}/canvas/pods/${node.id}`,
              {
                position: node.position,
                config: node.data.config,
                label: node.data.label,
              }
            );
          }
        })
      );

      const response = await axiosInstance.get(
        `/workspaces/${currentWorkspaceId}/flows/${flowId}/canvas`
      );
      const canvas = response.data.data || response.data;

      const syncedEdges: Edge[] = (canvas.edges || []).map((edge: any) => ({
        id: edge.id,
        source: edge.sourcePodId,
        target: edge.targetPodId,
        sourceHandle: edge.sourceHandle || null,
        targetHandle: edge.targetHandle || null,
        type: 'animated',
        animated: true,
      }));

      setEdges(syncedEdges);

      setTimeout(() => {
        reactFlowInstance.setViewport(viewport, { duration: 0 });
      }, 0);

      setHasUnsavedChanges(false);
      toast.success('Canvas saved');
    } catch (error) {
      console.error('Failed to save canvas:', error);
      toast.error('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  }, [flowId, currentWorkspaceId, reactFlowInstance]);

  const saveToHistory = useCallback(
    (newNodes: Node[], newEdges: Edge[]) => {
      if (isUndoRedoRef.current) return;

      // Debounce history updates
      if (updateBatchRef.current) {
        clearTimeout(updateBatchRef.current);
      }

      updateBatchRef.current = setTimeout(() => {
        setHistory((prevHistory) => {
          const currentIdx = currentIndex;
          const newHistory = prevHistory.slice(0, currentIdx + 1);
          newHistory.push({ nodes: newNodes, edges: newEdges });
          return newHistory.slice(-MAX_HISTORY);
        });
        setCurrentIndex((prevIndex) => Math.min(prevIndex + 1, MAX_HISTORY - 1));
        setHasUnsavedChanges(true);

        if (autoSaveTimeoutRef.current) {
          clearTimeout(autoSaveTimeoutRef.current);
        }
        autoSaveTimeoutRef.current = setTimeout(() => {
          save();
        }, AUTO_SAVE_DELAY);
      }, 100); // Batch rapid changes
    },
    [currentIndex, save]
  );

  const autoArrange = useCallback(async () => {
    if (nodes.length === 0) return;

    setIsArranging(true);

    try {
      const g = new dagre.graphlib.Graph();

      g.setGraph({
        rankdir: 'LR',
        nodesep: 500,
        ranksep: 1500,
        align: 'UL',
        marginx: 200,
        marginy: 200,
      });

      g.setDefaultEdgeLabel(() => ({}));

      nodes.forEach((node) => {
        const nodeElement = document.querySelector(`[data-id="${node.id}"]`);

        let width = NODE_WIDTH;
        let height =
          node.data?.backendType === 'LLM_PROMPT' ? DEFAULT_LLM_HEIGHT : DEFAULT_SOURCE_HEIGHT;

        if (nodeElement) {
          const rect = nodeElement.getBoundingClientRect();
          if (rect.width > 0) width = rect.width + 100;
          if (rect.height > 0) height = rect.height + 300;
        }

        g.setNode(node.id, { width, height });
      });

      edges.forEach((edge) => {
        g.setEdge(edge.source, edge.target);
      });

      dagre.layout(g);

      const layoutedNodes = nodes.map((node) => {
        const nodeWithPosition = g.node(node.id);

        if (!nodeWithPosition) return node;

        return {
          ...node,
          position: {
            x: nodeWithPosition.x - nodeWithPosition.width / 2,
            y: nodeWithPosition.y - nodeWithPosition.height / 2,
          },
        };
      });

      setNodes(layoutedNodes);
      saveToHistory(layoutedNodes, edges);

      setTimeout(() => {
        reactFlowInstance.fitView({
          padding: 0.5,
          duration: 1000,
          minZoom: 0.01,
          maxZoom: 1,
        });
      }, 100);

      toast.success('Flow auto-arranged with spacious layout');
    } catch (error) {
      console.error('Failed to auto-arrange:', error);
      toast.error('Failed to arrange nodes');
    } finally {
      setIsArranging(false);
    }
  }, [nodes, edges, reactFlowInstance, saveToHistory]);

  const undo = useCallback(() => {
    if (currentIndex > 0) {
      isUndoRedoRef.current = true;
      const prevState = history[currentIndex - 1];
      setNodes(prevState.nodes);
      setEdges(prevState.edges);
      setCurrentIndex((prev) => prev - 1);
      setHasUnsavedChanges(true);
      setTimeout(() => {
        isUndoRedoRef.current = false;
      }, 100);
    }
  }, [currentIndex, history]);

  const redo = useCallback(() => {
    if (currentIndex < history.length - 1) {
      isUndoRedoRef.current = true;
      const nextState = history[currentIndex + 1];
      setNodes(nextState.nodes);
      setEdges(nextState.edges);
      setCurrentIndex((prev) => prev + 1);
      setHasUnsavedChanges(true);
      setTimeout(() => {
        isUndoRedoRef.current = false;
      }, 100);
    }
  }, [currentIndex, history]);

  // **FIX: Only save history for meaningful changes**
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => {
        const newNodes = applyNodeChanges(changes, nds);

        // Only save history for position, add, remove - NOT select or drag
        const hasSignificantChange = changes.some(
          (c) => c.type === 'position' || c.type === 'add' || c.type === 'remove'
        );

        if (hasSignificantChange) {
          // Use setTimeout to break out of render cycle
          setTimeout(() => {
            saveToHistory(newNodes, edgesRef.current);
          }, 0);
        }

        return newNodes;
      });
    },
    [saveToHistory]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((eds) => {
        const newEdges = applyEdgeChanges(changes, eds);

        if (changes.some((c) => c.type !== 'select')) {
          setTimeout(() => {
            saveToHistory(nodesRef.current, newEdges);
          }, 0);
        }

        return newEdges;
      });
    },
    [saveToHistory]
  );

  const setNodeStatus = useCallback((nodeId: string, status: PodExecutionStatus) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, executionStatus: status } } : n))
    );
  }, []);

  const addNode = useCallback(
    async (node: Partial<Node>) => {
      if (!flowId || !currentWorkspaceId) return;

      try {
        const backendType = node.data?.backendType || 'TEXT_INPUT';
        const response = await axiosInstance.post(
          `/workspaces/${currentWorkspaceId}/flows/${flowId}/canvas/pods`,
          {
            flowId,
            type: backendType,
            label: node.data?.label || 'Untitled',
            position: node.position || { x: 0, y: 0 },
            config: node.data?.config || {},
          }
        );

        const createdPod = response.data.data || response.data;
        const newNode: Node = {
          id: createdPod.id,
          type: node.type!,
          position: createdPod.content?.position || node.position!,
          data: {
            ...node.data,
            label: createdPod.content?.label || node.data?.label,
            config: createdPod.content?.config || node.data?.config,
            executionStatus: 'IDLE',
            backendType: createdPod.type,
            ...(createdPod.content || {}),
          },
        };

        setNodes((nds) => {
          const newNodes = [...nds, newNode];
          saveToHistory(newNodes, edgesRef.current);
          return newNodes;
        });
        toast.success('Pod created');
        return createdPod.id;
      } catch (error) {
        console.error('Failed to create pod:', error);
        toast.error('Failed to create pod');
        return undefined;
      }
    },
    [flowId, currentWorkspaceId, saveToHistory]
  );

  const deleteNode = useCallback(
    async (nodeId: string) => {
      if (!flowId || !currentWorkspaceId) return;
      const originalNodes = nodesRef.current;
      const originalEdges = edgesRef.current;

      try {
        const newNodes = originalNodes.filter((n) => n.id !== nodeId);
        const newEdges = originalEdges.filter((e) => e.source !== nodeId && e.target !== nodeId);
        setNodes(newNodes);
        setEdges(newEdges);
        saveToHistory(newNodes, newEdges);
        await axiosInstance.delete(
          `/workspaces/${currentWorkspaceId}/flows/${flowId}/canvas/pods/${nodeId}`
        );
        toast.success('Pod deleted');
      } catch (error) {
        console.error('Failed to delete pod:', error);
        toast.error('Failed to delete pod');
        setNodes(originalNodes);
        setEdges(originalEdges);
      }
    },
    [flowId, currentWorkspaceId, saveToHistory]
  );

  const addEdge = useCallback(
    async (edge: Partial<Edge>) => {
      if (!flowId || !currentWorkspaceId || !edge.source || !edge.target) return;

      const connectionExists = edgesRef.current.some(
        (e) =>
          e.source === edge.source &&
          e.target === edge.target &&
          (e.sourceHandle || null) === (edge.sourceHandle || null) &&
          (e.targetHandle || null) === (edge.targetHandle || null)
      );

      if (connectionExists) {
        console.log('Edge connection already exists, skipping creation');
        return;
      }

      const tempId = `temp-${Date.now()}-${Math.random()}`;
      const tempEdge: Edge = {
        id: tempId,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle || null,
        targetHandle: edge.targetHandle || null,
        type: 'animated',
        animated: true,
      };

      setEdges((prev) => [...prev, tempEdge]);

      try {
        const response = await axiosInstance.post(
          `/workspaces/${currentWorkspaceId}/flows/${flowId}/canvas/edges`,
          {
            flowId,
            sourcePodId: edge.source,
            targetPodId: edge.target,
            sourceHandle: edge.sourceHandle || null,
            targetHandle: edge.targetHandle || null,
            animated: true,
          }
        );

        const backendEdge = response.data.data || response.data;

        setEdges((prev) => {
          const cleanEdges = prev.filter((e) => {
            const isTempId = e.id === tempId;
            const isSameConnection =
              e.source === backendEdge.sourcePodId &&
              e.target === backendEdge.targetPodId &&
              (e.sourceHandle || null) === (backendEdge.sourceHandle || null) &&
              (e.targetHandle || null) === (backendEdge.targetHandle || null);
            return !isTempId && !isSameConnection;
          });

          const realEdge: Edge = {
            id: backendEdge.id,
            source: backendEdge.sourcePodId,
            target: backendEdge.targetPodId,
            sourceHandle: backendEdge.sourceHandle || null,
            targetHandle: backendEdge.targetHandle || null,
            type: 'animated',
            animated: true,
          };

          const newEdges = [...cleanEdges, realEdge];
          saveToHistory(nodesRef.current, newEdges);
          return newEdges;
        });
      } catch (error) {
        console.error('Failed to create edge:', error);
        setEdges((prev) => prev.filter((e) => e.id !== tempId));
        toast.error('Failed to create connection');
      }
    },
    [flowId, currentWorkspaceId, saveToHistory]
  );

  const deleteEdge = useCallback(
    async (edgeId: string) => {
      if (!flowId || !currentWorkspaceId) return;
      const originalEdges = edgesRef.current;
      try {
        const newEdges = originalEdges.filter((e) => e.id !== edgeId);
        setEdges(newEdges);
        saveToHistory(nodesRef.current, newEdges);
        await axiosInstance.delete(
          `/workspaces/${currentWorkspaceId}/flows/${flowId}/canvas/edges/${edgeId}`
        );
      } catch (error) {
        console.error('Failed to delete edge:', error);
        toast.error('Failed to delete connection');
        setEdges(originalEdges);
      }
    },
    [flowId, currentWorkspaceId, saveToHistory]
  );

  // **CRITICAL FIX: updateNodeData should NOT trigger saveToHistory**
  // This was causing infinite loops when child components updated
  const updateNodeData = useCallback((nodeId: string, data: any) => {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
      )
    );
    // Don't call saveToHistory here - let onNodesChange handle it
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, save]);

  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      if (updateBatchRef.current) {
        clearTimeout(updateBatchRef.current);
      }
    };
  }, []);

  const value: CanvasContextValue = {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    setNodes,
    setEdges,
    addNode,
    deleteNode,
    addEdge,
    deleteEdge,
    updateNodeData,
    setNodeStatus,
    undo,
    redo,
    canUndo: currentIndex > 0,
    canRedo: currentIndex < history.length - 1,
    save,
    isSaving,
    hasUnsavedChanges,
    isInitializing,
    autoArrange,
    isArranging,
  };

  return <CanvasContext.Provider value={value}>{children}</CanvasContext.Provider>;
}

export function CanvasProvider({ children }: { children: ReactNode }) {
  return <CanvasProviderInner>{children}</CanvasProviderInner>;
}

export function useCanvas() {
  const context = useContext(CanvasContext);
  if (!context) {
    throw new Error('useCanvas must be used within CanvasProvider');
  }
  return context;
}
