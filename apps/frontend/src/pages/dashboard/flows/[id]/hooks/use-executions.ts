// File: apps/frontend/src/pages/dashboard/flows/[id]/hooks/use-executions.ts
import { useQuery } from '@tanstack/react-query';
import { axiosInstance } from '@/lib/axios-instance';
import { useWorkspaces } from '@/hooks/use-workspaces';

// Matches backend ExecutionHistoryItemDto exactly
export interface ExecutionHistoryItem {
  id: string;
  podId: string;
  status: string;
  provider: string;
  modelId: string;
  modelName: string | null;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  costInUsd: string | null;
  startedAt: string;
  finishedAt: string | null;
  runtimeInMs: number | null;
  errorMessage: string | null;
  errorCode: string | null;
}

// Matches backend ExecutionDetailDto exactly
export interface ExecutionDetail {
  id: string;
  podId: string;
  flowId: string;
  workspaceId: string;
  status: string;
  provider: string;
  modelId: string;
  modelName: string | null;

  // Token usage
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;

  // Cost and timing
  costInUsd: string | null;
  runtimeInMs: number | null;

  // Timestamps
  startedAt: string;
  finishedAt: string | null;

  // Metadata
  requestMetadata: any;
  responseMetadata: any;

  // Error info
  errorMessage: string | null;
  errorCode: string | null;

  // Additional fields
  apiKeyId: string | null;
  createdAt: string;
  updatedAt: string;

  // Pod relationship
  pod: {
    id: string;
    type: string;
    flowId: string;
  };
}

/**
 * Fetch execution history for a specific pod
 * Returns last 50 executions by default
 */
export function usePodExecutions(flowId: string, podId: string | null | undefined) {
  const { currentWorkspaceId } = useWorkspaces();

  return useQuery({
    queryKey: ['pod-executions', currentWorkspaceId, flowId, podId],
    queryFn: async () => {
      const response = await axiosInstance.get(
        `/workspaces/${currentWorkspaceId}/flows/${flowId}/executions/pods/${podId}`,
        {
          params: { limit: 50 },
        }
      );
      return (response.data.data || []) as ExecutionHistoryItem[];
    },
    enabled: !!currentWorkspaceId && !!flowId && !!podId,
    refetchInterval: 5000, // Poll every 5 seconds for live updates
  });
}

/**
 * Fetch detailed execution information
 */
export function useExecutionDetail(executionId: string | null) {
  const { currentWorkspaceId } = useWorkspaces();

  return useQuery({
    queryKey: ['execution-detail', currentWorkspaceId, executionId],
    queryFn: async () => {
      const response = await axiosInstance.get(
        `/workspaces/${currentWorkspaceId}/executions/${executionId}`
      );
      return response.data.data as ExecutionDetail;
    },
    enabled: !!currentWorkspaceId && !!executionId,
  });
}
