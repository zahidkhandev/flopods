import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useMemo } from 'react';
import { useWorkspaces } from '@/hooks/use-workspaces';
import { toast } from '@/lib/toast-utils';
import * as documentsApi from '@/services/api/documents';

export interface DocumentFolder {
  id: string;
  workspaceId: string;
  name: string;
  parentId: string | null;
  icon?: string;
  color?: string;
  sortOrder: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  children?: DocumentFolder[];
  _count?: {
    documents: number;
    children: number;
  };
}

export function useFolders() {
  const { currentWorkspaceId } = useWorkspaces();
  const queryClient = useQueryClient();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  const queryKey = useMemo(() => ['folders', currentWorkspaceId], [currentWorkspaceId]);

  // Get tree structure directly from API
  const { data: folderTree = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!currentWorkspaceId) throw new Error('No workspace selected');
      return await documentsApi.listFolders(currentWorkspaceId);
    },
    enabled: !!currentWorkspaceId,
    refetchInterval: 5000,
    staleTime: 1000 * 30,
  });

  // Flatten tree for other operations (breadcrumb, navigation, etc.)
  const folders = useMemo(() => {
    const flattenTree = (
      nodes: DocumentFolder[],
      result: DocumentFolder[] = []
    ): DocumentFolder[] => {
      nodes.forEach((node) => {
        const { children, ...folder } = node;
        result.push(folder as DocumentFolder);
        if (children?.length) flattenTree(children, result);
      });
      return result;
    };
    return flattenTree(folderTree);
  }, [folderTree]);

  const breadcrumb = useMemo(() => {
    if (!currentFolderId) return [];
    const path: DocumentFolder[] = [];
    let folderId: string | null = currentFolderId;

    while (folderId) {
      const folder = folders.find((f) => f.id === folderId);
      if (!folder) break;
      path.unshift(folder);
      folderId = folder.parentId;
    }

    return path;
  }, [currentFolderId, folders]);

  const createFolderMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      parentId?: string;
      icon?: string;
      color?: string;
    }) => {
      if (!currentWorkspaceId) throw new Error('No workspace selected');
      return documentsApi.createFolder(currentWorkspaceId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Folder created');
    },
    onError: (error: any) => {
      toast.error('Failed to create folder', {
        description: error.response?.data?.message,
      });
    },
  });

  const updateFolderMutation = useMutation({
    mutationFn: async ({
      folderId,
      data,
    }: {
      folderId: string;
      data: {
        name?: string;
        icon?: string;
        color?: string;
        parentId?: string | null;
      };
    }) => {
      if (!currentWorkspaceId) throw new Error('No workspace selected');
      return documentsApi.updateFolder(currentWorkspaceId, folderId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Folder updated');
    },
    onError: (error: any) => {
      toast.error('Failed to update folder', {
        description: error.response?.data?.message,
      });
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (folderId: string) => {
      if (!currentWorkspaceId) throw new Error('No workspace selected');
      return documentsApi.deleteFolder(currentWorkspaceId, folderId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Folder deleted');
    },
    onError: (error: any) => {
      toast.error('Failed to delete folder', {
        description: error.response?.data?.message,
      });
    },
  });

  const moveFolderMutation = useMutation({
    mutationFn: async ({
      folderId,
      newParentId,
    }: {
      folderId: string;
      newParentId: string | null;
    }) => {
      if (!currentWorkspaceId) throw new Error('No workspace selected');
      return documentsApi.moveFolder(currentWorkspaceId, folderId, newParentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Folder moved');
    },
    onError: (error: any) => {
      toast.error('Failed to move folder', {
        description: error.response?.data?.message,
      });
    },
  });

  const navigateToFolder = useCallback((folderId: string | null) => {
    setCurrentFolderId(folderId);
  }, []);

  const navigateUp = useCallback(() => {
    if (!currentFolderId) return;
    const currentFolder = folders.find((f) => f.id === currentFolderId);
    setCurrentFolderId(currentFolder?.parentId || null);
  }, [currentFolderId, folders]);

  const deleteWithConfirm = async (folderId: string, folderName: string) => {
    const confirmed = window.confirm(
      `Delete folder "${folderName}"? This will also delete all contents.`
    );
    if (confirmed) {
      return deleteFolderMutation.mutateAsync(folderId);
    }
  };

  const refreshFolders = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  return {
    folders, // Flat list for navigation/breadcrumb
    folderTree, // Tree structure for display
    currentFolderId,
    currentFolder: folders.find((f) => f.id === currentFolderId) || null,
    breadcrumb,
    isLoading,
    createFolder: createFolderMutation.mutateAsync,
    updateFolder: updateFolderMutation.mutateAsync,
    deleteFolder: deleteFolderMutation.mutateAsync,
    deleteWithConfirm,
    moveFolder: moveFolderMutation.mutateAsync,
    refreshFolders,
    isCreatingFolder: createFolderMutation.isPending,
    isUpdatingFolder: updateFolderMutation.isPending,
    isDeletingFolder: deleteFolderMutation.isPending,
    isMovingFolder: moveFolderMutation.isPending,
    navigateToFolder,
    navigateUp,
    canNavigateUp: currentFolderId !== null,
  };
}
