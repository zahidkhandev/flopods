import { useState, useEffect, useCallback } from 'react';
import { axiosInstance } from '@/lib/axios-instance';
import { toast } from '@/lib/toast-utils';
import { useWorkspaces } from '@/hooks/use-workspaces';
import { Flow, ApiResponse } from '../types';

export function useFlow(flowId: string | undefined) {
  const { currentWorkspace } = useWorkspaces();
  const [flow, setFlow] = useState<Flow | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchFlow = useCallback(async () => {
    if (!currentWorkspace?.id || !flowId) return;

    try {
      setIsLoading(true);
      const response = await axiosInstance.get<ApiResponse<Flow>>(
        `/workspaces/${currentWorkspace.id}/flows/${flowId}`
      );

      setFlow(response.data.data);
    } catch (error) {
      console.error('Failed to fetch flow:', error);
      toast.error('Failed to load flow');
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspace?.id, flowId]);

  useEffect(() => {
    fetchFlow();
  }, [fetchFlow]);

  return {
    flow,
    isLoading,
    refetch: fetchFlow,
  };
}
