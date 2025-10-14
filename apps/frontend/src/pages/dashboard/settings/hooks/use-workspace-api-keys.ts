import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import axiosInstance from '@/lib/axios-instance';
import { WorkspaceApiKey, AddApiKeyDto, UpdateApiKeyDto } from '../types/settings.types';

export function useWorkspaceApiKeys(workspaceId: string) {
  const [apiKeys, setApiKeys] = useState<WorkspaceApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchApiKeys = useCallback(async () => {
    if (!workspaceId) return;

    setIsLoading(true);
    try {
      const response = await axiosInstance.get(`/workspaces/${workspaceId}/api-keys`);
      setApiKeys(response.data);
    } catch (error: any) {
      toast.error('Failed to load API keys', {
        description: error.response?.data?.message || 'Please try again',
      });
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  const addApiKey = async (data: AddApiKeyDto) => {
    try {
      const response = await axiosInstance.post(`/workspaces/${workspaceId}/api-keys`, data);
      toast.success('API key added successfully', {
        description: `${data.displayName} configured`,
      });
      await fetchApiKeys();
      return response.data;
    } catch (error: any) {
      toast.error('Failed to add API key', {
        description: error.response?.data?.message || 'Please try again',
      });
      throw error;
    }
  };

  const updateApiKey = async (keyId: string, data: UpdateApiKeyDto) => {
    try {
      const response = await axiosInstance.patch(
        `/workspaces/${workspaceId}/api-keys/${keyId}`,
        data
      );
      toast.success('API key updated successfully');
      await fetchApiKeys();
      return response.data;
    } catch (error: any) {
      toast.error('Failed to update API key', {
        description: error.response?.data?.message || 'Please try again',
      });
      throw error;
    }
  };

  const deleteApiKey = async (keyId: string) => {
    try {
      await axiosInstance.delete(`/workspaces/${workspaceId}/api-keys/${keyId}`);
      toast.success('API key deleted successfully');
      await fetchApiKeys();
    } catch (error: any) {
      toast.error('Failed to delete API key', {
        description: error.response?.data?.message || 'Please try again',
      });
      throw error;
    }
  };

  useEffect(() => {
    fetchApiKeys();
  }, [fetchApiKeys]);

  return {
    apiKeys,
    isLoading,
    addApiKey,
    updateApiKey,
    deleteApiKey,
    refetch: fetchApiKeys,
  };
}
