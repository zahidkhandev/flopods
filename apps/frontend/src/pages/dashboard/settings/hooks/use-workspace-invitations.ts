import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from '@/lib/toast-utils';
import { axiosInstance } from '@/lib/axios-instance';
import { WorkspaceInvitation, SendInvitationDto } from '../types/settings.types';

interface UseWorkspaceInvitationsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function useWorkspaceInvitations(
  workspaceId: string,
  options: UseWorkspaceInvitationsOptions = {}
) {
  const { autoRefresh = false, refreshInterval = 30000 } = options;

  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInvitations = useCallback(
    async (showLoading: boolean = true) => {
      if (!workspaceId) return;

      try {
        if (showLoading) {
          setIsLoading(true);
        } else {
          setIsRefreshing(true);
        }
        setError(null);

        const response = await axiosInstance.get(`/workspaces/${workspaceId}/invitations`);

        // ✅ FIXED: Handle both wrapped and direct responses
        const data = response.data?.data || response.data;
        setInvitations(Array.isArray(data) ? data : []);
      } catch (error: any) {
        const errorMessage = error.response?.data?.message || 'Failed to load invitations';
        setError(errorMessage);
        toast.error('Failed to load invitations', {
          description: errorMessage,
        });
        setInvitations([]);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [workspaceId]
  );

  const sendInvitation = useCallback(
    async (data: SendInvitationDto) => {
      try {
        const response = await axiosInstance.post(`/workspaces/${workspaceId}/invitations`, data);

        toast.success('Invitation sent', {
          description: `Invite sent to ${data.email}`,
        });

        await fetchInvitations(false);
        return response.data;
      } catch (error: any) {
        toast.error('Failed to send invitation', {
          description: error.response?.data?.message || 'Please try again',
        });
        throw error;
      }
    },
    [workspaceId, fetchInvitations]
  );

  const revokeInvitation = useCallback(
    async (invitationId: string) => {
      try {
        await axiosInstance.delete(`/workspaces/${workspaceId}/invitations/${invitationId}`);

        toast.success('Invitation revoked');

        // Optimistic update
        setInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));
      } catch (error: any) {
        toast.error('Failed to revoke invitation', {
          description: error.response?.data?.message || 'Please try again',
        });
        // Refetch on error
        fetchInvitations(false);
        throw error;
      }
    },
    [workspaceId, fetchInvitations]
  );

  const pendingInvitations = useMemo(
    () => invitations.filter((inv) => inv.status === 'PENDING'),
    [invitations]
  );

  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      const interval = setInterval(() => {
        fetchInvitations(false);
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, fetchInvitations]);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  return {
    invitations,
    pendingInvitations,
    isLoading,
    isRefreshing,
    error,
    totalInvitations: invitations.length,
    pendingCount: pendingInvitations.length,
    sendInvitation,
    revokeInvitation,
    refetch: fetchInvitations,
  };
}
