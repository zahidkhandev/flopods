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
    // ✅ Ensure workspace is selected immediately
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  // ✅ CRITICAL FIX: Auto-select first workspace IMMEDIATELY when data loads
  useEffect(() => {
    if (!isLoading && workspaces && workspaces.length > 0) {
      // If no workspace is selected OR selected workspace doesn't exist
      const workspaceExists = workspaces.some((ws) => ws.id === currentWorkspaceId);

      if (!currentWorkspaceId || !workspaceExists) {
        // ✅ Prioritize PERSONAL workspace, fallback to first
        const defaultWorkspace = workspaces.find((ws) => ws.type === 'PERSONAL') || workspaces[0];

        setCurrentWorkspaceId(defaultWorkspace.id);
      }
    }
  }, [workspaces, currentWorkspaceId, setCurrentWorkspaceId, isLoading]);

  const currentWorkspace = workspaces?.find((ws) => ws.id === currentWorkspaceId);

  const switchWorkspace = (workspaceId: string) => {
    setCurrentWorkspaceId(workspaceId);
    // Invalidate relevant queries when switching workspace
    queryClient.invalidateQueries({ queryKey: ['workspace', workspaceId] });
    queryClient.invalidateQueries({ queryKey: ['flows'] });
  };

  return {
    workspaces: workspaces || [],
    currentWorkspace,
    currentWorkspaceId: currentWorkspaceId || workspaces?.[0]?.id || null, // ✅ Fallback
    switchWorkspace,
    isLoading,
    error,
    // ✅ Helper to check if workspace is ready
    isReady: !isLoading && !!currentWorkspaceId,
  };
};
