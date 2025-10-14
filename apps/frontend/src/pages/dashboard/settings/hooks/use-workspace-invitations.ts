import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import axiosInstance from '@/lib/axios-instance';

export interface WorkspaceInvitation {
  id: string;
  workspaceId: string;
  email: string;
  role: string;
  permissions: {
    canCreateCanvas: boolean;
    canDeleteCanvas: boolean;
    canInviteMembers: boolean;
    canManageApiKeys: boolean;
    canManageMembers: boolean;
  };
  invitedBy: string;
  invitedUserId: string | null;
  token: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
}

export interface SendInvitationDto {
  email: string;
  role?: string;
  permissions?: {
    canCreateCanvas?: boolean;
    canDeleteCanvas?: boolean;
    canInviteMembers?: boolean;
    canManageApiKeys?: boolean;
    canManageMembers?: boolean;
  };
}

export function useWorkspaceInvitations(workspaceId: string) {
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchInvitations = useCallback(async () => {
    if (!workspaceId) return;

    setIsLoading(true);
    try {
      const response = await axiosInstance.get(`/workspaces/${workspaceId}/invitations`);
      // ✅ FIX: Extract data from response.data.data
      setInvitations(response.data.data || []);
    } catch (error: any) {
      toast.error('Failed to load invitations', {
        description: error.response?.data?.message || 'Please try again',
      });
      setInvitations([]);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  const sendInvitation = async (data: SendInvitationDto) => {
    try {
      const response = await axiosInstance.post(`/workspaces/${workspaceId}/invitations`, data);
      toast.success('Invitation sent successfully', {
        description: `Invite sent to ${data.email}`,
      });
      await fetchInvitations();
      return response.data.data;
    } catch (error: any) {
      toast.error('Failed to send invitation', {
        description: error.response?.data?.message || 'Please try again',
      });
      throw error;
    }
  };

  const revokeInvitation = async (invitationId: string) => {
    try {
      await axiosInstance.delete(`/workspaces/${workspaceId}/invitations/${invitationId}`);
      await fetchInvitations(); // Refresh list after revoking
    } catch (error: any) {
      toast.error('Failed to revoke invitation', {
        description: error.response?.data?.message || 'Please try again',
      });
      throw error;
    }
  };

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  return {
    invitations,
    isLoading,
    sendInvitation,
    revokeInvitation,
    refetch: fetchInvitations,
  };
}
