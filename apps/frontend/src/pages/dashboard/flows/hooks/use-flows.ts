import { useState, useEffect, useCallback } from 'react';
import { axiosInstance } from '@/lib/axios-instance';
import { toast } from '@/lib/toast-utils';
import { useWorkspaces } from '@/hooks/use-workspaces';
import { Flow, FlowVisibility } from '../types';

interface UseFlowsOptions {
  page?: number;
  limit?: number;
  search?: string;
  visibility?: FlowVisibility;
  spaceId?: string;
}

// ✅ Match your backend's interceptor structure
interface BackendResponse<T> {
  statusCode: number;
  message: string;
  data: T;
  errors?: string[];
  timestamp: string;
  pagination?: {
    totalItems: number;
    totalPages: number;
    currentPage: number;
    pageSize: number;
  };
}

export function useFlows(options: UseFlowsOptions = {}) {
  const { currentWorkspace } = useWorkspaces();
  const [flows, setFlows] = useState<Flow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pagination, setPagination] = useState({
    totalItems: 0,
    totalPages: 0,
    currentPage: 1,
    pageSize: 0,
  });

  const fetchFlows = useCallback(async () => {
    if (!currentWorkspace?.id) return;

    try {
      setIsLoading(true);
      const response = await axiosInstance.get<BackendResponse<Flow[]>>(
        `/workspaces/${currentWorkspace.id}/flows`,
        {
          params: {
            page: options.page || 1,
            limit: options.limit || 20,
            search: options.search,
            visibility: options.visibility,
            spaceId: options.spaceId,
          },
        }
      );

      // ✅ Your interceptor returns: { statusCode, message, data: [], pagination: {}, errors, timestamp }
      setFlows(response.data.data || []);
      setPagination(
        response.data.pagination || {
          totalItems: 0,
          totalPages: 0,
          currentPage: 1,
          pageSize: 0,
        }
      );
    } catch (error) {
      console.error('Failed to fetch flows:', error);
      toast.error('Failed to load flows');
      setFlows([]);
    } finally {
      setIsLoading(false);
    }
  }, [
    currentWorkspace?.id,
    options.page,
    options.limit,
    options.search,
    options.visibility,
    options.spaceId,
  ]);

  useEffect(() => {
    fetchFlows();
  }, [fetchFlows]);

  const createFlow = useCallback(
    async (data: {
      name: string;
      description?: string;
      visibility?: FlowVisibility;
      spaceId?: string;
    }) => {
      if (!currentWorkspace?.id) return null;

      try {
        const response = await axiosInstance.post<BackendResponse<Flow>>(
          `/workspaces/${currentWorkspace.id}/flows`,
          data
        );

        const newFlow = response.data.data;
        setFlows((prev) => [newFlow, ...prev]);
        toast.success('Flow created successfully');
        return newFlow;
      } catch (error) {
        console.error('Failed to create flow:', error);
        toast.error('Failed to create flow');
        return null;
      }
    },
    [currentWorkspace?.id]
  );

  const updateFlow = useCallback(
    async (
      flowId: string,
      data: { name?: string; description?: string; visibility?: FlowVisibility; spaceId?: string }
    ) => {
      if (!currentWorkspace?.id) return null;

      try {
        const response = await axiosInstance.patch<BackendResponse<Flow>>(
          `/workspaces/${currentWorkspace.id}/flows/${flowId}`,
          data
        );

        const updatedFlow = response.data.data;
        setFlows((prev) => prev.map((f) => (f.id === flowId ? updatedFlow : f)));
        toast.success('Flow updated successfully');
        return updatedFlow;
      } catch (error) {
        console.error('Failed to update flow:', error);
        toast.error('Failed to update flow');
        return null;
      }
    },
    [currentWorkspace?.id]
  );

  const deleteFlow = useCallback(
    async (flowId: string) => {
      if (!currentWorkspace?.id) return false;

      try {
        await axiosInstance.delete(`/workspaces/${currentWorkspace.id}/flows/${flowId}`);
        setFlows((prev) => prev.filter((f) => f.id !== flowId));
        toast.success('Flow deleted successfully');
        return true;
      } catch (error) {
        console.error('Failed to delete flow:', error);
        toast.error('Failed to delete flow');
        return false;
      }
    },
    [currentWorkspace?.id]
  );

  return {
    flows,
    isLoading,
    pagination,
    fetchFlows,
    createFlow,
    updateFlow,
    deleteFlow,
  };
}
