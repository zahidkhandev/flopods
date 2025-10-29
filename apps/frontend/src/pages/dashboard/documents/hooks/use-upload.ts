/**
 * React Query Hook for Document Upload - COMPLETE
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { useWorkspaces } from '@/hooks/use-workspaces';
import { toast } from '@/lib/toast-utils';
import type { UploadProgress } from '../types';
import { uploadDocument } from '@/services/api/documents';

interface UseUploadOptions {
  onSuccess?: () => void;
  onError?: (error: any) => void;
  folderId?: string;
}

export function useUpload(options: UseUploadOptions = {}) {
  const { currentWorkspaceId } = useWorkspaces();
  const queryClient = useQueryClient();
  const [uploadQueue, setUploadQueue] = useState<UploadProgress[]>([]);

  const updateProgress = useCallback((fileId: string, updates: Partial<UploadProgress>) => {
    setUploadQueue((prev) =>
      prev.map((item) => (item.file.name === fileId ? { ...item, ...updates } : item))
    );
  }, []);

  const removeFromQueue = useCallback((fileName: string) => {
    setUploadQueue((prev) => prev.filter((item) => item.file.name !== fileName));
  }, []);

  const clearCompleted = useCallback(() => {
    setUploadQueue((prev) => prev.filter((item) => item.status === 'uploading'));
  }, []);

  const clearAll = useCallback(() => {
    setUploadQueue([]);
  }, []);

  const mutation = useMutation({
    mutationFn: async ({ file, folderId }: { file: File; folderId?: string }) => {
      if (!currentWorkspaceId) throw new Error('No workspace selected');

      setUploadQueue((prev) => [
        ...prev,
        {
          file,
          progress: 0,
          status: 'uploading',
        },
      ]);

      return uploadDocument(
        currentWorkspaceId,
        file,
        folderId || options.folderId,
        (progressEvent: any) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          updateProgress(file.name, { progress });
        }
      );
    },
    onSuccess: (data, variables) => {
      const { file } = variables;
      updateProgress(file.name, {
        status: 'success',
        progress: 100,
        documentId: data.documentId,
      });

      // Invalidate documents list
      queryClient.invalidateQueries({ queryKey: ['documents', currentWorkspaceId] });

      toast.success('Upload complete', {
        description: `${file.name} uploaded successfully`,
      });

      options.onSuccess?.();
    },
    onError: (error: any, variables) => {
      const { file } = variables;
      const message = error.response?.data?.message || 'Upload failed';

      updateProgress(file.name, {
        status: 'error',
        progress: 0,
        error: message,
      });

      toast.error('Upload failed', {
        description: `${file.name}: ${message}`,
      });

      options.onError?.(error);
    },
  });

  const uploadFile = useCallback(
    async (file: File, folderId?: string) => {
      return mutation.mutateAsync({ file, folderId });
    },
    [mutation]
  );

  const uploadFiles = useCallback(
    async (files: File[], folderId?: string) => {
      const promises = files.map((file) => uploadFile(file, folderId));
      return Promise.allSettled(promises);
    },
    [uploadFile]
  );

  // Retry failed upload
  const retryUpload = useCallback(
    async (fileName: string, folderId?: string) => {
      const item = uploadQueue.find((i) => i.file.name === fileName);
      if (!item) return;

      removeFromQueue(fileName);
      return uploadFile(item.file, folderId);
    },
    [uploadQueue, removeFromQueue, uploadFile]
  );

  return {
    // Upload functions
    uploadFile,
    uploadFiles,
    retryUpload,

    // Upload queue
    uploadQueue,
    removeFromQueue,
    clearCompleted,
    clearAll,

    // State
    isUploading: mutation.isPending,

    // Stats
    activeUploads: uploadQueue.filter((item) => item.status === 'uploading').length,
    successfulUploads: uploadQueue.filter((item) => item.status === 'success').length,
    failedUploads: uploadQueue.filter((item) => item.status === 'error').length,
    totalUploads: uploadQueue.length,
  };
}
