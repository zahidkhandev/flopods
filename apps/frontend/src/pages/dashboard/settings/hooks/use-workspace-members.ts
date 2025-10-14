import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import axiosInstance from '@/lib/axios-instance';

export interface WorkspaceMember {
  id: string;
  userId: string;
  workspaceId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  canCreateCanvas: boolean;
  canDeleteCanvas: boolean;
  canManageBilling: boolean;
  canInviteMembers: boolean;
  canManageMembers: boolean;
  canManageApiKeys: boolean;
  joinedAt: string;
  invitedBy: string | null;
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
  };
}

export interface AddMemberDto {
  email: string;
  role?: 'ADMIN' | 'MEMBER';
  canCreateCanvas?: boolean;
  canDeleteCanvas?: boolean;
  canManageBilling?: boolean;
  canInviteMembers?: boolean;
  canManageMembers?: boolean;
  canManageApiKeys?: boolean;
}

export function useWorkspaceMembers(workspaceId: string) {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMembers = useCallback(async () => {
    if (!workspaceId) return;

    setIsLoading(true);
    try {
      const response = await axiosInstance.get(`/workspaces/${workspaceId}/members`);
      // ✅ FIX: Extract data from response.data.data
      setMembers(response.data.data || []);
    } catch (error: any) {
      toast.error('Failed to load members', {
        description: error.response?.data?.message || 'Please try again',
      });
      setMembers([]);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  const addMember = async (data: AddMemberDto) => {
    try {
      const response = await axiosInstance.post(`/workspaces/${workspaceId}/members`, data);
      toast.success('Member added successfully');
      await fetchMembers();
      return response.data.data;
    } catch (error: any) {
      toast.error('Failed to add member', {
        description: error.response?.data?.message || 'Please try again',
      });
      throw error;
    }
  };

  const updateMember = async (userId: string, data: Partial<AddMemberDto>) => {
    try {
      const response = await axiosInstance.patch(
        `/workspaces/${workspaceId}/members/${userId}`,
        data
      );
      await fetchMembers(); // Refresh list
      return response.data.data;
    } catch (error: any) {
      toast.error('Failed to update member', {
        description: error.response?.data?.message || 'Please try again',
      });
      throw error;
    }
  };

  const removeMember = async (userId: string) => {
    try {
      await axiosInstance.delete(`/workspaces/${workspaceId}/members/${userId}`);
      await fetchMembers(); // Refresh list
    } catch (error: any) {
      toast.error('Failed to remove member', {
        description: error.response?.data?.message || 'Please try again',
      });
      throw error;
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  return {
    members,
    isLoading,
    addMember,
    updateMember,
    removeMember,
    refetch: fetchMembers,
  };
}
