import { useCallback, useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import ReactFlow, {
  Controls,
  MiniMap,
  Connection,
  Panel,
  ReactFlowProvider,
  NodeTypes,
  EdgeTypes,
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  useReactFlow,
  useNodesInitialized,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Loader2, Upload, Sparkles } from 'lucide-react';
import { useFlowSocket } from './hooks/use-flow-socket';
import { useSetBreadcrumbs } from '@/hooks/use-set-breadcrumbs';
import { axiosInstance } from '@/lib/axios-instance';
import { useWorkspaces } from '@/hooks/use-workspaces';
import { CanvasProvider, useCanvas } from './context/canvas-context';
import { ModelsProvider } from './context/models-context';
import SourcePodNode from './components/pods/source-pod-node';
import LLMPodNode from './components/pods/llm-pod-node';
import ConfigPanel from './components/panels/config-panel';
import AnimatedEdge from './components/edges/animated-edge';
import CanvasBackground from './components/canvas/canvas-background';
import SaveToolbar from './components/toolbar/save-toolbar';
import { PodExecutionStatus } from './types';
import { toast } from 'sonner';

interface FlowDetails {
  id: string;
  workspaceId: string;
  spaceId: string | null;
  name: string;
  description: string;
  version: number;
  visibility: 'PRIVATE' | 'PUBLIC';
  createdBy: string;
  thumbnailS3Key: string | null;
  thumbnailGeneratedAt: string | null;
  createdAt: string;
  updatedAt: string;
  podCount: number;
  collaboratorCount: number;
}

const nodeTypes: NodeTypes = {
  SOURCE: SourcePodNode,
  LLM: LLMPodNode,
};

const edgeTypes: EdgeTypes = {
  animated: AnimatedEdge,
};

function FlowEditor() {
  const { id: flowId } = useParams<{ id: string }>();
  const { currentWorkspaceId } = useWorkspaces();

  // FIX: Destructure zoomTo instead of zoomBy
  const { screenToFlowPosition, fitView, zoomTo, getZoom } = useReactFlow();

  const nodesInitialized = useNodesInitialized();

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    addNode,
    addEdge,
    deleteNode,
    deleteEdge,
    isInitializing,
    setNodeStatus,
    setNodes,
    setEdges,
    save,
    hasUnsavedChanges,
    isSaving,
  } = useCanvas();

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isCtrlOrCmd = isMac ? event.metaKey : event.ctrlKey;

      if (isCtrlOrCmd && event.key === 's') {
        event.preventDefault();
        if (hasUnsavedChanges && !isSaving) {
          save();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [save, hasUnsavedChanges, isSaving]);

  const [flowDetails, setFlowDetails] = useState<FlowDetails | null>(null);
  const [isLoadingFlow, setIsLoadingFlow] = useState(true);
  const [selectedPodId, setSelectedPodId] = useState<string | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(
    null
  );
  const [hasInitialFitView, setHasInitialFitView] = useState(false);

  const handleNodeDoubleClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedPodId(node.id);
  }, []);

  useEffect(() => {
    const selectedNode = nodes.find((n) => n.selected);
    if (selectedPodId && !selectedNode) {
      setSelectedPodId(null);
    }
  }, [nodes, selectedPodId]);

  useEffect(() => {
    if (nodesInitialized && nodes.length > 0 && !hasInitialFitView) {
      fitView({
        padding: 0.5,
        duration: 0,
        minZoom: 0.1,
        maxZoom: 0.5,
      });
      setHasInitialFitView(true);
    }
  }, [nodesInitialized, nodes.length, hasInitialFitView, fitView]);

  useEffect(() => {
    const fetchFlow = async () => {
      if (!currentWorkspaceId || !flowId) return;

      try {
        setIsLoadingFlow(true);
        const response = await axiosInstance.get(
          `/workspaces/${currentWorkspaceId}/flows/${flowId}`
        );
        const flowData = response.data.data || response.data;
        setFlowDetails(flowData);
      } catch (error) {
        console.error('[FlowEditor] Failed to fetch flow details:', error);
        setFlowDetails({
          id: flowId,
          workspaceId: currentWorkspaceId,
          spaceId: null,
          name: 'Untitled Flow',
          description: '',
          version: 1,
          visibility: 'PRIVATE',
          createdBy: '',
          thumbnailS3Key: null,
          thumbnailGeneratedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          podCount: 0,
          collaboratorCount: 0,
        });
      } finally {
        setIsLoadingFlow(false);
      }
    };

    fetchFlow();
  }, [currentWorkspaceId, flowId]);

  const breadcrumbs = useMemo(() => {
    if (!flowDetails) return null;
    return [
      { label: 'Dashboard', to: '/dashboard', isLast: false },
      { label: 'Flows', to: '/dashboard/flows', isLast: false },
      { label: flowDetails.name, to: `/dashboard/flows/${flowId}`, isLast: true },
    ];
  }, [flowDetails, flowId]);

  useSetBreadcrumbs(breadcrumbs);

  const handleExecutionStarted = useCallback(
    (podId: string) => {
      setNodeStatus(podId, PodExecutionStatus.RUNNING);
    },
    [setNodeStatus]
  );

  const handleExecutionCompleted = useCallback(
    (podId: string) => {
      setNodeStatus(podId, PodExecutionStatus.COMPLETED);
      toast.success('Execution completed');
    },
    [setNodeStatus]
  );

  const handleExecutionError = useCallback(
    (podId: string) => {
      setNodeStatus(podId, PodExecutionStatus.ERROR);
      toast.error('Execution failed');
    },
    [setNodeStatus]
  );

  const handleExternalNodeChanges = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
    },
    [onNodesChange]
  );

  const handleExternalEdgeChanges = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes);
    },
    [onEdgesChange]
  );

  const handleExternalNodeAdded = useCallback(
    (node: Node) => {
      setNodes((nds) => [...nds, node]);
    },
    [setNodes]
  );

  const handleExternalNodeDeleted = useCallback(
    (nodeId: string) => {
      deleteNode(nodeId);
    },
    [deleteNode]
  );

  const handleExternalEdgeAdded = useCallback(
    (edge: Edge) => {
      setEdges((eds) => [...eds, edge]);
    },
    [setEdges]
  );

  const handleExternalEdgeDeleted = useCallback(
    (edgeId: string) => {
      deleteEdge(edgeId);
    },
    [deleteEdge]
  );

  useFlowSocket(
    flowId!,
    handleExternalNodeChanges,
    handleExternalEdgeChanges,
    setNodes,
    setEdges,
    handleExternalNodeAdded,
    handleExternalNodeDeleted,
    handleExternalEdgeAdded,
    handleExternalEdgeDeleted,
    handleExecutionStarted,
    handleExecutionCompleted,
    handleExecutionError
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) {
        console.warn('[FlowEditor] Invalid connection');
        return;
      }
      addEdge({
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
        type: 'animated',
      });
    },
    [addEdge]
  );

  const handleAddSourcePod = useCallback(async () => {
    if (!contextMenuPosition) return;

    const position = screenToFlowPosition({
      x: contextMenuPosition.x,
      y: contextMenuPosition.y,
    });

    const newNodeData: Partial<Node> = {
      type: 'SOURCE',
      position,
      data: {
        label: 'Text Input',
        config: { sourceType: 'text', content: '' },
        executionStatus: PodExecutionStatus.IDLE,
        backendType: 'TEXT_INPUT',
      },
    };

    await addNode(newNodeData);
    setContextMenuPosition(null);
  }, [contextMenuPosition, screenToFlowPosition, addNode]);

  const handleAddLLMPod = useCallback(async () => {
    if (!contextMenuPosition) return;

    const position = screenToFlowPosition({
      x: contextMenuPosition.x,
      y: contextMenuPosition.y,
    });

    const newNodeData: Partial<Node> = {
      type: 'LLM',
      position,
      data: {
        label: 'LLM Prompt',
        config: {
          provider: 'OPENAI',
          model: 'gpt-4o',
          temperature: 0.7,
          maxTokens: 2000,
          systemPrompt: '',
        },
        executionStatus: PodExecutionStatus.IDLE,
        backendType: 'LLM_PROMPT',
      },
    };

    await addNode(newNodeData);
    setContextMenuPosition(null);
  }, [contextMenuPosition, screenToFlowPosition, addNode]);

  const onPaneContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenuPosition({
      x: event.clientX,
      y: event.clientY,
    });
  }, []);

  // === CUSTOM ZOOM HANDLER (FIXED) ===
  const handleWheel = useCallback(
    (event: React.WheelEvent) => {
      // If event propagates from a scrollable area inside a node (like textarea), stop zoom
      const target = event.target as HTMLElement;
      if (target.closest('.nodrag') || target.closest('.nowheel')) {
        return;
      }

      // Check current zoom level
      const currentZoom = getZoom();

      if (event.deltaY !== 0) {
        let zoomFactor = 0.0015; // Standard speed

        // Dynamic Speed Curve
        if (currentZoom < 0.5) {
          zoomFactor = 0.003; // Fast zoom when far out
        } else if (currentZoom > 1.2) {
          zoomFactor = 0.0005; // Precision zoom when close in
        }

        // Calculate smooth factor
        const smoothFactor = Math.exp(-event.deltaY * zoomFactor);

        // Calculate new absolute zoom
        const newZoom = currentZoom * smoothFactor;

        // Use zoomTo instead of zoomBy
        zoomTo(newZoom);
      }
    },
    [zoomTo, getZoom]
  );

  if (!flowId || isLoadingFlow || isInitializing || !currentWorkspaceId) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading flow...</span>
        </div>
      </div>
    );
  }

  if (!flowDetails) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold">Flow not found</p>
          <p className="text-muted-foreground text-sm">
            This flow may have been deleted or you don&apos;t have access to it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      <div className="relative flex-1 overflow-hidden" onWheel={handleWheel}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onPaneContextMenu={onPaneContextMenu}
          onNodeDoubleClick={handleNodeDoubleClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={{
            type: 'animated',
            animated: true,
          }}
          minZoom={0.01}
          maxZoom={3}
          fitViewOptions={{
            padding: 0.5,
            includeHiddenNodes: false,
            minZoom: 0.1,
            maxZoom: 0.5,
          }}
          proOptions={{ hideAttribution: true }}
          // Disable default zoom to use our custom logic
          zoomOnScroll={false}
          zoomOnPinch={true}
          panOnScroll={true}
          panOnDrag={true}
          preventScrolling={true}
          zoomActivationKeyCode={null}
          nodesDraggable={true}
          nodesConnectable={true}
          elementsSelectable={true}
        >
          <CanvasBackground />
          <Controls />
          <MiniMap
            nodeColor={(node) => {
              switch (node.type) {
                case 'SOURCE':
                  return '#3b82f6';
                case 'LLM':
                  return '#a855f7';
                default:
                  return '#6b7280';
              }
            }}
          />

          <Panel position="top-left">
            <SaveToolbar />
          </Panel>

          <Panel position="top-right" className="bg-background rounded-lg border p-2 shadow-sm">
            <div className="text-muted-foreground text-xs">
              <div>Pods: {nodes.length}</div>
              <div>Connections: {edges.length}</div>
            </div>
          </Panel>
        </ReactFlow>

        {contextMenuPosition && (
          <div
            className="bg-popover text-popover-foreground animate-in fade-in-80 fixed z-50 min-w-50 overflow-hidden rounded-md border p-1 shadow-md"
            style={{
              left: contextMenuPosition.x,
              top: contextMenuPosition.y,
            }}
            onMouseLeave={() => setContextMenuPosition(null)}
          >
            <div
              className="hover:bg-accent hover:text-accent-foreground relative flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm transition-colors outline-none select-none"
              onClick={handleAddSourcePod}
            >
              <Upload className="mr-2 h-4 w-4" />
              <span>Add Source Pod</span>
            </div>
            <div
              className="hover:bg-accent hover:text-accent-foreground relative flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm transition-colors outline-none select-none"
              onClick={handleAddLLMPod}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              <span>Add LLM Pod</span>
            </div>
          </div>
        )}
      </div>

      <ConfigPanel selectedPodId={selectedPodId} />
    </div>
  );
}

export default function FlowIdPage() {
  return (
    <ReactFlowProvider>
      <ModelsProvider>
        <CanvasProvider>
          <FlowEditor />
        </CanvasProvider>
      </ModelsProvider>
    </ReactFlowProvider>
  );
}
