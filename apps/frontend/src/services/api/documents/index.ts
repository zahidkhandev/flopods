/**
 * Documents API Service
 */

import { axiosInstance } from '@/lib/axios-instance';
import { DocumentFolder } from '@/pages/dashboard/documents/hooks/use-folders';
import type {
  Document,
  PaginatedDocumentsResponse,
  UploadDocumentResponse,
  ListDocumentsParams,
} from '@/pages/dashboard/documents/types';

const DOCUMENTS_BASE = '/documents';

// ==========================================
// DOCUMENT OPERATIONS
// ==========================================

export const uploadDocument = async (
  workspaceId: string,
  file: File,
  folderId?: string,
  onUploadProgress?: (progressEvent: any) => void
): Promise<UploadDocumentResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  if (folderId) {
    formData.append('folderId', folderId);
  }

  const response = await axiosInstance.post(
    `${DOCUMENTS_BASE}/workspaces/${workspaceId}/upload`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress,
    }
  );

  return response.data?.data || response.data;
};

export const listDocuments = async (
  workspaceId: string,
  params: ListDocumentsParams = {}
): Promise<PaginatedDocumentsResponse> => {
  const queryParams = new URLSearchParams();

  if (params.page) queryParams.append('page', params.page.toString());
  if (params.limit) queryParams.append('limit', params.limit.toString());
  if (params.folderId) queryParams.append('folderId', params.folderId);
  if (params.status) queryParams.append('status', params.status);
  if (params.search) queryParams.append('search', params.search);

  const response = await axiosInstance.get(
    `${DOCUMENTS_BASE}/workspaces/${workspaceId}?${queryParams.toString()}`
  );

  const data = response.data?.data || response.data;
  const pagination = response.data?.pagination;

  return {
    data: Array.isArray(data) ? data : [],
    pagination: pagination || {
      totalItems: 0,
      totalPages: 0,
      currentPage: 1,
      pageSize: 20,
    },
  };
};

export const getDocument = async (workspaceId: string, documentId: string): Promise<Document> => {
  const response = await axiosInstance.get(
    `${DOCUMENTS_BASE}/workspaces/${workspaceId}/documents/${documentId}`
  );
  return response.data?.data || response.data;
};

export const deleteDocument = async (workspaceId: string, documentId: string): Promise<void> => {
  await axiosInstance.delete(`${DOCUMENTS_BASE}/workspaces/${workspaceId}/documents/${documentId}`);
};

export const updateDocument = async (
  workspaceId: string,
  documentId: string,
  data: {
    name?: string;
    folderId?: string | null;
    tags?: string[];
  }
): Promise<Document> => {
  const response = await axiosInstance.patch(
    `${DOCUMENTS_BASE}/workspaces/${workspaceId}/documents/${documentId}`,
    data
  );
  return response.data?.data || response.data;
};

export const regenerateEmbeddings = async (
  workspaceId: string,
  documentId: string
): Promise<void> => {
  await axiosInstance.post(
    `${DOCUMENTS_BASE}/embeddings/workspaces/${workspaceId}/documents/${documentId}/regenerate`
  );
};

export const downloadDocument = async (workspaceId: string, documentId: string): Promise<Blob> => {
  const response = await axiosInstance.get(
    `${DOCUMENTS_BASE}/workspaces/${workspaceId}/documents/${documentId}/download`,
    { responseType: 'blob' }
  );
  return response.data;
};

// ==========================================
// FOLDER OPERATIONS
// ==========================================

export const listFolders = async (workspaceId: string): Promise<DocumentFolder[]> => {
  const response = await axiosInstance.get(`${DOCUMENTS_BASE}/folders/workspaces/${workspaceId}`);
  return response.data?.data || response.data || [];
};

export const createFolder = async (
  workspaceId: string,
  data: {
    name: string;
    parentId?: string;
    icon?: string;
    color?: string;
  }
): Promise<DocumentFolder> => {
  const response = await axiosInstance.post(
    `${DOCUMENTS_BASE}/folders/workspaces/${workspaceId}`,
    data
  );
  return response.data?.data || response.data;
};

export const updateFolder = async (
  workspaceId: string,
  folderId: string,
  data: {
    name?: string;
    icon?: string;
    color?: string;
    parentId?: string | null;
  }
): Promise<DocumentFolder> => {
  const response = await axiosInstance.patch(
    `${DOCUMENTS_BASE}/folders/workspaces/${workspaceId}/folders/${folderId}`,
    data
  );
  return response.data?.data || response.data;
};

export const deleteFolder = async (workspaceId: string, folderId: string): Promise<void> => {
  await axiosInstance.delete(
    `${DOCUMENTS_BASE}/folders/workspaces/${workspaceId}/folders/${folderId}`
  );
};

export const moveFolder = async (
  workspaceId: string,
  folderId: string,
  newParentId: string | null
): Promise<DocumentFolder> => {
  const response = await axiosInstance.patch(
    `${DOCUMENTS_BASE}/folders/workspaces/${workspaceId}/folders/${folderId}/move`,
    { newParentId }
  );
  return response.data?.data || response.data;
};
