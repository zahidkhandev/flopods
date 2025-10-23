// pages/dashboard/flows/[id]/index.tsx
import { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Connection,
  addEdge,
  useNodesState,
  useEdgesState,
  NodeChange,
  EdgeChange,
  Edge,
  Node,
  Panel,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Loader2, Plus, Square, Circle, Diamond } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useFlowSocket } from './hooks/use-flow-socket';
import { useSetBreadcrumbs } from '@/hooks/use-set-breadcrumbs';
import { axiosInstance } from '@/lib/axios-instance';
import { useWorkspaces } from '@/hooks/use-workspaces';

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

function debounce<T extends (...args: any[]) => void>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

function FlowEditor() {
  const { id: flowId } = useParams<{ id: string }>();
  const { currentWorkspaceId } = useWorkspaces();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [flowDetails, setFlowDetails] = useState<FlowDetails | null>(null);
  const [isLoadingFlow, setIsLoadingFlow] = useState(true);

  const emitNodesUpdateRef = useRef<((nodes: Node[]) => void) | null>(null);
  const emitEdgesUpdateRef = useRef<((edges: Edge[]) => void) | null>(null);
  const nodeIdCounter = useRef(0);

  // ✅ Fetch flow details
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

  const handleNodesUpdate = useCallback(
    (updatedNodes: Node[]) => {
      setNodes(updatedNodes);
    },
    [setNodes]
  );

  const handleEdgesUpdate = useCallback(
    (updatedEdges: Edge[]) => {
      setEdges(updatedEdges);
    },
    [setEdges]
  );

  const handleNodeAdded = useCallback(
    (node: Node) => {
      setNodes((nds) => {
        if (nds.some((n) => n.id === node.id)) return nds;
        return [...nds, node];
      });
    },
    [setNodes]
  );

  const handleNodeDeleted = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    },
    [setNodes]
  );

  const handleEdgeAdded = useCallback(
    (edge: Edge) => {
      setEdges((eds) => {
        if (eds.some((e) => e.id === edge.id)) return eds;
        return [...eds, edge];
      });
    },
    [setEdges]
  );

  const handleEdgeDeleted = useCallback(
    (edgeId: string) => {
      setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    },
    [setEdges]
  );

  const { emitNodesUpdate, emitEdgesUpdate, emitNodeAdd, emitEdgeAdd } = useFlowSocket(
    flowId!,
    handleNodesUpdate,
    handleEdgesUpdate,
    handleNodeAdded,
    handleNodeDeleted,
    handleEdgeAdded,
    handleEdgeDeleted
  );

  useEffect(() => {
    emitNodesUpdateRef.current = debounce(emitNodesUpdate, 300);
    emitEdgesUpdateRef.current = debounce(emitEdgesUpdate, 300);
  }, [emitNodesUpdate, emitEdgesUpdate]);

  const handleNodesChangeLocal = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);

      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          if (emitNodesUpdateRef.current) {
            setNodes((currentNodes) => {
              emitNodesUpdateRef.current!(currentNodes);
              return currentNodes;
            });
          }
        });
      } else {
        setTimeout(() => {
          if (emitNodesUpdateRef.current) {
            setNodes((currentNodes) => {
              emitNodesUpdateRef.current!(currentNodes);
              return currentNodes;
            });
          }
        }, 0);
      }
    },
    [onNodesChange, setNodes]
  );

  const handleEdgesChangeLocal = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes);

      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          if (emitEdgesUpdateRef.current) {
            setEdges((currentEdges) => {
              emitEdgesUpdateRef.current!(currentEdges);
              return currentEdges;
            });
          }
        });
      } else {
        setTimeout(() => {
          if (emitEdgesUpdateRef.current) {
            setEdges((currentEdges) => {
              emitEdgesUpdateRef.current!(currentEdges);
              return currentEdges;
            });
          }
        }, 0);
      }
    },
    [onEdgesChange, setEdges]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) {
        console.warn('[FlowEditor] Invalid connection');
        return;
      }

      const newEdge: Edge = {
        id: `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
      };

      setEdges((eds) => addEdge(newEdge, eds));
      emitEdgeAdd(newEdge);
    },
    [setEdges, emitEdgeAdd]
  );

  // ✅ Add node function
  const addNode = useCallback(
    (type: 'default' | 'input' | 'output') => {
      const id = `node-${++nodeIdCounter.current}`;
      const newNode: Node = {
        id,
        type,
        position: {
          x: Math.random() * 400 + 100,
          y: Math.random() * 400 + 100,
        },
        data: { label: `${type.charAt(0).toUpperCase() + type.slice(1)} Node` },
      };

      setNodes((nds) => [...nds, newNode]);
      emitNodeAdd(newNode);
    },
    [setNodes, emitNodeAdd]
  );

  if (!flowId || isLoadingFlow || !currentWorkspaceId) {
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
    <div className="absolute inset-0">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChangeLocal}
        onEdgesChange={handleEdgesChangeLocal}
        onConnect={onConnect}
        fitView
        attributionPosition="bottom-left"
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            switch (node.type) {
              case 'input':
                return '#22c55e';
              case 'output':
                return '#ef4444';
              default:
                return '#3b82f6';
            }
          }}
        />

        {/* ✅ Add Node Toolbar */}
        <Panel position="top-left" className="space-y-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Node
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Node Types</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => addNode('default')}>
                <Square className="mr-2 h-4 w-4" />
                Default Node
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => addNode('input')}>
                <Circle className="mr-2 h-4 w-4" />
                Input Node
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => addNode('output')}>
                <Diamond className="mr-2 h-4 w-4" />
                Output Node
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Panel>

        {/* ✅ Stats Panel */}
        <Panel position="top-right" className="bg-background rounded-lg border p-2 shadow-sm">
          <div className="text-muted-foreground text-xs">
            <div>Nodes: {nodes.length}</div>
            <div>Edges: {edges.length}</div>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}

export default function FlowIdPage() {
  return (
    <ReactFlowProvider>
      <FlowEditor />
    </ReactFlowProvider>
  );
}
