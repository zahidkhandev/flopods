import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from '@/lib/toast-utils';
import { axiosInstance } from '@/lib/axios-instance';
import { WorkspaceMember } from '../types/settings.types';

interface UseWorkspaceMembersOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  enableOptimisticUpdates?: boolean;
}

export function useWorkspaceMembers(workspaceId: string, options: UseWorkspaceMembersOptions = {}) {
  const { autoRefresh = false, refreshInterval = 30000, enableOptimisticUpdates = true } = options;

  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(
    async (showLoading: boolean = true) => {
      if (!workspaceId) return;

      try {
        if (showLoading) {
          setIsLoading(true);
        } else {
          setIsRefreshing(true);
        }

        setError(null);
        const response = await axiosInstance.get(`/workspaces/${workspaceId}/members`);

        // Handle both wrapped and direct responses
        const membersData = response.data?.data || response.data;
        setMembers(Array.isArray(membersData) ? membersData : []);
      } catch (error: any) {
        const errorMessage = error.response?.data?.message || 'Failed to load members';
        setError(errorMessage);
        toast.error('Failed to load members', {
          description: errorMessage,
        });
        setMembers([]);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [workspaceId]
  );

  // ❌ REMOVED: addMember function - Use invitations instead

  const updateMember = useCallback(
    async (userId: string, data: Partial<any>) => {
      try {
        if (enableOptimisticUpdates) {
          setMembers((prev) =>
            prev.map((member) => (member.userId === userId ? { ...member, ...data } : member))
          );
        }

        const response = await axiosInstance.patch(
          `/workspaces/${workspaceId}/members/${userId}`,
          data
        );

        toast.success('Member updated successfully');

        if (!enableOptimisticUpdates) {
          await fetchMembers(false);
        }

        return response.data;
      } catch (error: any) {
        if (enableOptimisticUpdates) {
          await fetchMembers(false);
        }

        toast.error('Failed to update member', {
          description: error.response?.data?.message || 'Please try again',
        });
        throw error;
      }
    },
    [workspaceId, enableOptimisticUpdates, fetchMembers]
  );

  const removeMember = useCallback(
    async (userId: string) => {
      try {
        if (enableOptimisticUpdates) {
          setMembers((prev) => prev.filter((member) => member.userId !== userId));
        }

        await axiosInstance.delete(`/workspaces/${workspaceId}/members/${userId}`);

        toast.success('Member removed successfully');

        if (!enableOptimisticUpdates) {
          await fetchMembers(false);
        }
      } catch (error: any) {
        if (enableOptimisticUpdates) {
          await fetchMembers(false);
        }

        toast.error('Failed to remove member', {
          description: error.response?.data?.message || 'Please try again',
        });
        throw error;
      }
    },
    [workspaceId, enableOptimisticUpdates, fetchMembers]
  );

  const membersByRole = useMemo(() => {
    return members.reduce(
      (acc, member) => {
        if (!acc[member.role]) {
          acc[member.role] = [];
        }
        acc[member.role].push(member);
        return acc;
      },
      {} as Record<string, WorkspaceMember[]>
    );
  }, [members]);

  const ownerCount = useMemo(() => members.filter((m) => m.role === 'OWNER').length, [members]);
  const adminCount = useMemo(() => members.filter((m) => m.role === 'ADMIN').length, [members]);
  const memberCount = useMemo(() => members.filter((m) => m.role === 'MEMBER').length, [members]);

  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      const interval = setInterval(() => {
        fetchMembers(false);
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, fetchMembers]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  return {
    members,
    membersByRole,
    isLoading,
    isRefreshing,
    error,
    totalMembers: members.length,
    ownerCount,
    adminCount,
    memberCount,
    // ❌ REMOVED: addMember
    updateMember,
    removeMember,
    refetch: fetchMembers,
  };
}
