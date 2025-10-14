// src/hooks/use-workspaces.ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWorkspaceStore } from '@/store/workspace-store';
import { useEffect } from 'react';
import axiosInstance from '@/lib/axios-instance';

interface Workspace {
  id: string;
  name: string;
  type: 'PERSONAL' | 'TEAM';
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  permissions: {
    canCreateCanvas: boolean;
    canDeleteCanvas: boolean;
    canManageBilling: boolean;
    canInviteMembers: boolean;
    canManageMembers: boolean;
    canManageApiKeys: boolean;
  };
  memberCount: number;
  canvasCount: number;
  joinedAt: string;
  createdAt: string;
  updatedAt: string;
}

export const useWorkspaces = () => {
  const queryClient = useQueryClient();
  const { currentWorkspaceId, setCurrentWorkspaceId } = useWorkspaceStore();

  const {
    data: workspaces,
    isLoading,
    error,
  } = useQuery<Workspace[]>({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const response = await axiosInstance.get('/workspaces');
      return response.data.data || response.data;
    },
  });

  // Auto-select first workspace if none selected
  useEffect(() => {
    if (workspaces && workspaces.length > 0 && !currentWorkspaceId) {
      setCurrentWorkspaceId(workspaces[0].id);
    }
  }, [workspaces, currentWorkspaceId, setCurrentWorkspaceId]);

  const currentWorkspace = workspaces?.find((ws) => ws.id === currentWorkspaceId);

  const switchWorkspace = (workspaceId: string) => {
    setCurrentWorkspaceId(workspaceId);
    // Invalidate relevant queries when switching workspace
    queryClient.invalidateQueries({ queryKey: ['workspace', workspaceId] });
  };

  return {
    workspaces: workspaces || [],
    currentWorkspace,
    currentWorkspaceId,
    switchWorkspace,
    isLoading,
    error,
  };
};
