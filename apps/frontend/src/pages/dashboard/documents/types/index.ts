/**
 * Document Types for Frontend
 * Matches backend API response structure
 */

export type DocumentStatus = 'PENDING' | 'QUEUED' | 'PROCESSING' | 'READY' | 'FAILED';

export type DocumentSourceType = 'FILE' | 'YOUTUBE' | 'VIMEO' | 'LOOM' | 'URL' | 'GOOGLE_DRIVE';

export interface Document {
  id: string;
  name: string;
  sourceType: string;
  fileType: string;
  mimeType: string;
  sizeInBytes: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  folder: { id: string; name: string } | null;
  tags: string[];
  processing: {
    chunks: number;
    embeddings: number;
    tokens: number;
    processedAt: string | null;
  };
  cost: {
    totalUsd: number;
    credits: number;
    breakdown: {
      extraction: number;
      embedding: number;
      vision: number;
    };
  } | null;
  failureReason: string | null;
}
export interface PaginatedDocumentsResponse {
  data: Document[];
  pagination: {
    totalItems: number;
    totalPages: number;
    currentPage: number;
    pageSize: number;
  };
}

export interface UploadDocumentResponse {
  documentId: string;
  status: string;
}

export interface UploadProgress {
  file: File;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  documentId?: string;
  error?: string;
}

export interface ListDocumentsParams {
  page?: number;
  limit?: number;
  folderId?: string;
  status?: DocumentStatus;
  search?: string;
}
