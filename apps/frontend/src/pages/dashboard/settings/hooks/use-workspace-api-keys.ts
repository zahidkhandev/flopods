// hooks/useWorkspaceApiKeys.ts

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import axiosInstance from '@/lib/axios-instance';
import {
  WorkspaceApiKey,
  AddApiKeyDto,
  UpdateApiKeyDto,
  ApiKeyUsageStats,
  UsageMetric,
} from '../types/settings.types';

interface UseWorkspaceApiKeysOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  enableOptimisticUpdates?: boolean;
}

export function useWorkspaceApiKeys(workspaceId: string, options: UseWorkspaceApiKeysOptions = {}) {
  const { autoRefresh = false, refreshInterval = 30000, enableOptimisticUpdates = true } = options;

  const [apiKeys, setApiKeys] = useState<WorkspaceApiKey[]>([]);
  const [stats, setStats] = useState<ApiKeyUsageStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchApiKeys = useCallback(
    async (showLoading: boolean = true) => {
      if (!workspaceId) return;

      try {
        if (showLoading) {
          setIsLoading(true);
        } else {
          setIsRefreshing(true);
        }
        setError(null);

        const response = await axiosInstance.get(`/workspaces/${workspaceId}/api-keys`);

        // ✅ HANDLE WRAPPED RESPONSE (response.data.data) OR DIRECT RESPONSE
        const apiKeysData = response.data?.data || response.data;
        setApiKeys(Array.isArray(apiKeysData) ? apiKeysData : []);
      } catch (error: any) {
        const errorMessage = error.response?.data?.message || 'Failed to load API keys';
        setError(errorMessage);
        toast.error('Failed to load API keys', {
          description: errorMessage,
        });
        setApiKeys([]);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [workspaceId]
  );

  const fetchStats = useCallback(async () => {
    if (!workspaceId) return;

    try {
      const response = await axiosInstance.get(`/workspaces/${workspaceId}/api-keys/stats`);

      // ✅ HANDLE WRAPPED RESPONSE
      const statsData = response.data?.data || response.data;
      setStats(statsData);
    } catch (error: any) {
      console.error('Failed to fetch API key stats:', error);
    }
  }, [workspaceId]);

  const fetchUsageMetrics = useCallback(
    async (keyId: string, startDate?: string, endDate?: string): Promise<UsageMetric[]> => {
      try {
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);

        const response = await axiosInstance.get(
          `/workspaces/${workspaceId}/api-keys/${keyId}/metrics?${params.toString()}`
        );

        // ✅ HANDLE WRAPPED RESPONSE
        const metricsData = response.data?.data || response.data;
        return Array.isArray(metricsData) ? metricsData : [];
      } catch (error: any) {
        toast.error('Failed to fetch usage metrics', {
          description: error.response?.data?.message || 'Please try again',
        });
        return [];
      }
    },
    [workspaceId]
  );

  const addApiKey = useCallback(
    async (data: AddApiKeyDto) => {
      try {
        const response = await axiosInstance.post(`/workspaces/${workspaceId}/api-keys`, data);

        // ✅ HANDLE WRAPPED RESPONSE
        const newApiKey = response.data?.data || response.data;

        toast.success('API key added successfully', {
          description: `${data.displayName} is ready to use`,
        });

        if (enableOptimisticUpdates) {
          setApiKeys((prev) => [newApiKey, ...prev]);
        } else {
          await fetchApiKeys(false);
        }

        fetchStats();
        return newApiKey;
      } catch (error: any) {
        toast.error('Failed to add API key', {
          description: error.response?.data?.message || 'Please try again',
        });
        throw error;
      }
    },
    [workspaceId, enableOptimisticUpdates, fetchApiKeys, fetchStats]
  );

  const updateApiKey = useCallback(
    async (keyId: string, data: UpdateApiKeyDto) => {
      try {
        if (enableOptimisticUpdates) {
          setApiKeys((prev) => prev.map((key) => (key.id === keyId ? { ...key, ...data } : key)));
        }

        const response = await axiosInstance.patch(
          `/workspaces/${workspaceId}/api-keys/${keyId}`,
          data
        );

        // ✅ HANDLE WRAPPED RESPONSE
        const updatedKey = response.data?.data || response.data;

        toast.success('API key updated successfully');

        if (!enableOptimisticUpdates) {
          await fetchApiKeys(false);
        }

        return updatedKey;
      } catch (error: any) {
        if (enableOptimisticUpdates) {
          await fetchApiKeys(false);
        }

        toast.error('Failed to update API key', {
          description: error.response?.data?.message || 'Please try again',
        });
        throw error;
      }
    },
    [workspaceId, enableOptimisticUpdates, fetchApiKeys]
  );

  const toggleApiKeyStatus = useCallback(
    async (keyId: string, isActive: boolean) => {
      return updateApiKey(keyId, { isActive });
    },
    [updateApiKey]
  );

  const deleteApiKey = useCallback(
    async (keyId: string) => {
      try {
        if (enableOptimisticUpdates) {
          setApiKeys((prev) => prev.filter((key) => key.id !== keyId));
        }

        await axiosInstance.delete(`/workspaces/${workspaceId}/api-keys/${keyId}`);

        toast.success('API key deleted successfully');

        if (!enableOptimisticUpdates) {
          await fetchApiKeys(false);
        }

        fetchStats();
      } catch (error: any) {
        if (enableOptimisticUpdates) {
          await fetchApiKeys(false);
        }

        toast.error('Failed to delete API key', {
          description: error.response?.data?.message || 'Please try again',
        });
        throw error;
      }
    },
    [workspaceId, enableOptimisticUpdates, fetchApiKeys, fetchStats]
  );

  const groupedByProvider = useMemo(() => {
    return apiKeys.reduce(
      (acc, key) => {
        if (!acc[key.provider]) {
          acc[key.provider] = [];
        }
        acc[key.provider].push(key);
        return acc;
      },
      {} as Record<string, WorkspaceApiKey[]>
    );
  }, [apiKeys]);

  const activeKeysCount = useMemo(() => apiKeys.filter((key) => key.isActive).length, [apiKeys]);

  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      const interval = setInterval(() => {
        fetchApiKeys(false);
        fetchStats();
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, fetchApiKeys, fetchStats]);

  useEffect(() => {
    fetchApiKeys();
    fetchStats();
  }, [fetchApiKeys, fetchStats]);

  return {
    apiKeys,
    groupedByProvider,
    stats,
    isLoading,
    isRefreshing,
    error,
    totalCount: apiKeys.length,
    activeKeysCount,
    addApiKey,
    updateApiKey,
    deleteApiKey,
    toggleApiKeyStatus,
    fetchUsageMetrics,
    refetch: fetchApiKeys,
    refetchStats: fetchStats,
  };
}
