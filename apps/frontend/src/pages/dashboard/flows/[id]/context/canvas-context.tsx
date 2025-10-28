/* eslint-disable react-refresh/only-export-components */
// File: apps/frontend/src/pages/dashboard/flows/[id]/context/canvas-context.tsx
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
  updateNodeData: (nodeId: string, data: any) => Promise<void>;
  setNodeStatus: (nodeId: string, status: PodExecutionStatus) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  save: () => Promise<void>;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  isInitializing: boolean;
}

const CanvasContext = createContext<CanvasContextValue | null>(null);

const MAX_HISTORY = 50;
const AUTO_SAVE_DELAY = 60000;

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

// ✅ NEW: Inner component that has access to ReactFlow instance
function CanvasProviderInner({ children }: { children: ReactNode }) {
  const { id: flowId } = useParams<{ id: string }>();
  const { currentWorkspaceId } = useWorkspaces();
  const reactFlowInstance = useReactFlow(); // ✅ Access to viewport

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [history, setHistory] = useState<CanvasState[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

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
          position: pod.position || { x: 0, y: 0 }, // ✅ Use top-level position only!
          data: {
            label: pod.content?.label || pod.type,
            config: pod.content?.config || {},
            executionStatus: pod.executionStatus || 'IDLE',
            backendType: pod.type,
            ...pod.content,
            position: undefined, // ✅ Remove nested position from content
          },
        }));

        const loadedEdges: Edge[] = (canvas.edges || []).map((edge: any) => ({
          id: edge.id,
          source: edge.sourcePodId,
          target: edge.targetPodId,
          sourceHandle: edge.sourceHandle || null,
          targetHandle: edge.targetHandle || null,
          type: 'animated',
          animated: true,
        }));

        setNodes(loadedNodes);
        setEdges(loadedEdges);
        const initialState = { nodes: loadedNodes, edges: loadedEdges };
        setHistory([initialState]);
        setCurrentIndex(0);
      } catch (error) {
        console.error('❌ Failed to load canvas:', error);
        toast.error('Failed to load canvas');
      } finally {
        setIsInitializing(false);
      }
    };

    loadCanvas();
  }, [flowId, currentWorkspaceId]);

  // ✅ FIXED: Save without moving nodes
  const save = useCallback(async () => {
    if (!flowId || !currentWorkspaceId) return;

    let changesToSave = false;
    setHasUnsavedChanges((current) => {
      changesToSave = current;
      return current;
    });

    if (!changesToSave) return;

    const currentNodes = nodesRef.current;

    // ✅ Capture current viewport BEFORE save
    const viewport = reactFlowInstance.getViewport();

    setIsSaving(true);
    try {
      // Save all nodes with their current positions
      await Promise.all(
        currentNodes.map(async (node) => {
          if (!node.id.startsWith('temp-')) {
            await axiosInstance.patch(
              `/workspaces/${currentWorkspaceId}/flows/${flowId}/canvas/pods/${node.id}`,
              {
                position: node.position, // ✅ Save exact position
                config: node.data.config,
                label: node.data.label,
              }
            );
          }
        })
      );

      // ✅ Restore viewport immediately after save (prevents jumping)
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
    },
    [currentIndex, save]
  );

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

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => {
        const newNodes = applyNodeChanges(changes, nds);

        if (changes.some((c) => c.type !== 'select')) {
          saveToHistory(newNodes, edgesRef.current);
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
          saveToHistory(nodesRef.current, newEdges);
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

      const tempEdge: Edge = {
        id: edge.id || `edge-temp-${Date.now()}`,
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
          const newEdges = prev.map((e) =>
            e.id === tempEdge.id
              ? {
                  id: backendEdge.id,
                  source: backendEdge.sourcePodId,
                  target: backendEdge.targetPodId,
                  sourceHandle: backendEdge.sourceHandle,
                  targetHandle: backendEdge.targetHandle,
                  type: 'animated',
                  animated: true,
                }
              : e
          );
          saveToHistory(nodesRef.current, newEdges);
          return newEdges;
        });
      } catch (error) {
        console.error('❌ Failed to create edge:', error);
        setEdges((prev) => prev.filter((e) => e.id !== tempEdge.id));
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

  const updateNodeData = useCallback(
    async (nodeId: string, data: any) => {
      const originalNodes = nodesRef.current;

      try {
        const newNodes = originalNodes.map((node) =>
          node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
        );
        setNodes(newNodes);
        saveToHistory(newNodes, edgesRef.current);
      } catch (error) {
        console.error('Failed to update pod data locally:', error);
        setNodes(originalNodes);
      }
    },
    [saveToHistory]
  );

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
  };

  return <CanvasContext.Provider value={value}>{children}</CanvasContext.Provider>;
}

// ✅ Wrapper that provides ReactFlow context first
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
