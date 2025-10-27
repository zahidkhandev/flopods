// File: apps/frontend/src/pages/dashboard/flows/[id]/hooks/use-pods.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { axiosInstance } from '@/lib/axios-instance';
import { toast } from '@/lib/toast-utils';
import { useWorkspaces } from '@/hooks/use-workspaces';

interface PodConfig {
  [key: string]: any;
}

interface Pod {
  id: string;
  flowId: string;
  type: string;
  label: string;
  position: { x: number; y: number };
  config: PodConfig;
  lockedBy: string | null;
  lockedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface CreatePodPayload {
  flowId: string;
  type: string;
  label: string;
  position: { x: number; y: number };
  config: PodConfig;
}

interface UpdatePodPayload {
  label?: string;
  description?: string;
  position?: { x: number; y: number };
  config?: PodConfig;
}

export function usePods(flowId: string) {
  const { currentWorkspaceId } = useWorkspaces();

  return useQuery({
    queryKey: ['pods', currentWorkspaceId, flowId],
    queryFn: async () => {
      const response = await axiosInstance.get(
        `/workspaces/${currentWorkspaceId}/flows/${flowId}/canvas/pods`
      );
      return response.data.data as Pod[];
    },
    enabled: !!currentWorkspaceId && !!flowId,
  });
}

export function useCreatePod() {
  const { currentWorkspaceId } = useWorkspaces();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ flowId, ...payload }: CreatePodPayload) => {
      const response = await axiosInstance.post(
        `/workspaces/${currentWorkspaceId}/flows/${flowId}/canvas/pods`,
        payload
      );
      return response.data.data as Pod;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pods', currentWorkspaceId, variables.flowId] });
      toast.success('Pod created');
    },
    onError: (error: any) => {
      console.error('Failed to create pod:', error);
      toast.error('Failed to create pod', {
        description: error.response?.data?.message || 'Please try again',
      });
    },
  });
}

export function useUpdatePod() {
  const { currentWorkspaceId } = useWorkspaces();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      flowId,
      podId,
      ...payload
    }: { flowId: string; podId: string } & UpdatePodPayload) => {
      const response = await axiosInstance.patch(
        `/workspaces/${currentWorkspaceId}/flows/${flowId}/canvas/pods/${podId}`,
        payload
      );
      return response.data.data as Pod;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pods', currentWorkspaceId, variables.flowId] });
    },
    onError: (error: any) => {
      console.error('Failed to update pod:', error);
      toast.error('Failed to update pod');
    },
  });
}

export function useDeletePod() {
  const { currentWorkspaceId } = useWorkspaces();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ flowId, podId }: { flowId: string; podId: string }) => {
      await axiosInstance.delete(
        `/workspaces/${currentWorkspaceId}/flows/${flowId}/canvas/pods/${podId}`
      );
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pods', currentWorkspaceId, variables.flowId] });
      toast.success('Pod deleted');
    },
    onError: (error: any) => {
      console.error('Failed to delete pod:', error);
      toast.error('Failed to delete pod');
    },
  });
}
