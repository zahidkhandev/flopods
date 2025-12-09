import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useMemo } from 'react';
import { useWorkspaces } from '@/hooks/use-workspaces';
import { toast } from '@/lib/toast-utils';
import * as documentsApi from '@/services/api/documents';
import type { Document, ListDocumentsParams, DocumentStatus } from '../types';

interface UseDocumentsOptions {
  page?: number;
  limit?: number;
  folderId?: string;
  status?: DocumentStatus;
  search?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function useDocuments(options: UseDocumentsOptions = {}) {
  const { currentWorkspaceId } = useWorkspaces();
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(options.page || 1);

  // GLOBAL SEARCH support: Only send folderId to backend if no search query is active
  const isGlobalSearch = options.search && options.search.trim().length > 0;

  const queryParams: ListDocumentsParams = useMemo(
    () => ({
      page: currentPage,
      limit: options.limit || 20,
      // If global search is active, ignore folderId for backend API
      folderId: isGlobalSearch ? undefined : options.folderId,
      status: options.status,
      search: options.search,
    }),
    [currentPage, options.limit, options.folderId, options.status, options.search, isGlobalSearch]
  );

  const queryKey = useMemo(
    () => ['documents', currentWorkspaceId, queryParams],
    [currentWorkspaceId, queryParams]
  );

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!currentWorkspaceId) throw new Error('No workspace selected');
      return documentsApi.listDocuments(currentWorkspaceId, queryParams);
    },
    enabled: !!currentWorkspaceId,
    staleTime: 1000 * 30,
    refetchOnWindowFocus: true,
    refetchInterval: options.autoRefresh !== false ? options.refreshInterval || 5000 : false,
  });

  const documents = useMemo(() => data?.data || [], [data?.data]);
  const pagination = useMemo(
    () =>
      data?.pagination || {
        totalItems: 0,
        totalPages: 0,
        currentPage: 1,
        pageSize: 20,
      },
    [data?.pagination]
  );

  const updateDocumentMutation = useMutation({
    mutationFn: async ({
      documentId,
      data,
    }: {
      documentId: string;
      data: {
        name?: string;
        folderId?: string | null;
        tags?: string[];
      };
    }) => {
      if (!currentWorkspaceId) throw new Error('No workspace selected');
      return documentsApi.updateDocument(currentWorkspaceId, documentId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', currentWorkspaceId] });
      toast.success('Document updated');
    },
    onError: (error: any) => {
      toast.error('Update failed', {
        description: error.response?.data?.message,
      });
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async (documentId: string) => {
      if (!currentWorkspaceId) throw new Error('No workspace selected');
      return documentsApi.deleteDocument(currentWorkspaceId, documentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', currentWorkspaceId] });
      toast.success('Document deleted');
    },
    onError: (error: any) => {
      toast.error('Delete failed', {
        description: error.response?.data?.message,
      });
    },
  });

  const regenerateEmbeddingsMutation = useMutation({
    mutationFn: async (documentId: string) => {
      if (!currentWorkspaceId) throw new Error('No workspace selected');
      return documentsApi.regenerateEmbeddings(currentWorkspaceId, documentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', currentWorkspaceId] });
      toast.success('Regeneration started', {
        description: 'Document is being reprocessed',
      });
    },
    onError: (error: any) => {
      toast.error('Regeneration failed', {
        description: error.response?.data?.message,
      });
    },
  });

  const downloadDocumentMutation = useMutation({
    mutationFn: async (documentId: string) => {
      if (!currentWorkspaceId) throw new Error('No workspace selected');
      return documentsApi.downloadDocument(currentWorkspaceId, documentId);
    },
    onSuccess: (blob, documentId) => {
      const doc = documents.find((d) => d.id === documentId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc?.name || 'document';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Download started');
    },
    onError: (error: any) => {
      toast.error('Download failed', {
        description: error.response?.data?.message,
      });
    },
  });

  const goToPage = useCallback((page: number) => setCurrentPage(page), []);
  const nextPage = useCallback(() => {
    if (currentPage < pagination.totalPages) setCurrentPage((prev) => prev + 1);
  }, [currentPage, pagination.totalPages]);
  const prevPage = useCallback(() => {
    if (currentPage > 1) setCurrentPage((prev) => prev - 1);
  }, [currentPage]);

  const invalidateDocuments = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['documents', currentWorkspaceId] });
  }, [queryClient, currentWorkspaceId]);

  // TS 7053: Force status type
  const documentsByStatus = useMemo(() => {
    return documents.reduce(
      (acc, doc) => {
        const status = doc.status as DocumentStatus;
        if (!acc[status]) acc[status] = [];
        acc[status].push(doc);
        return acc;
      },
      {} as Record<DocumentStatus, Document[]>
    );
  }, [documents]);

  const statusCounts = useMemo(
    () => ({
      total: documents.length,
      ready: (documentsByStatus.READY || []).length,
      processing: (documentsByStatus.PROCESSING || []).length,
      queued: (documentsByStatus.QUEUED || []).length,
      failed: (documentsByStatus.FAILED || []).length,
    }),
    [documentsByStatus, documents.length]
  );

  const deleteWithConfirm = async (documentId: string, documentName: string) => {
    const confirmed = window.confirm(`Delete "${documentName}"? This action cannot be undone.`);
    if (confirmed) return deleteDocumentMutation.mutateAsync(documentId);
  };

  const regenerateWithConfirm = async (documentId: string, documentName: string) => {
    const confirmed = window.confirm(
      `Regenerate embeddings for "${documentName}"? This will reprocess the document.`
    );
    if (confirmed) return regenerateEmbeddingsMutation.mutateAsync(documentId);
  };

  return {
    documents,
    documentsByStatus,
    pagination,
    statusCounts,
    isLoading,
    error,
    currentPage,
    refetch,
    invalidateDocuments,
    updateDocument: updateDocumentMutation.mutateAsync,
    deleteDocument: deleteDocumentMutation.mutateAsync,
    deleteWithConfirm,
    regenerateEmbeddings: regenerateEmbeddingsMutation.mutateAsync,
    regenerateWithConfirm,
    downloadDocument: downloadDocumentMutation.mutateAsync,
    isUpdating: updateDocumentMutation.isPending,
    isDeleting: deleteDocumentMutation.isPending,
    isRegenerating: regenerateEmbeddingsMutation.isPending,
    isDownloading: downloadDocumentMutation.isPending,
    goToPage,
    nextPage,
    prevPage,
    hasNextPage: currentPage < pagination.totalPages,
    hasPrevPage: currentPage > 1,
  };
}
