/**
 * Document Types for Frontend
 * Matches backend API response structure
 */

export type DocumentStatus = 'PENDING' | 'QUEUED' | 'PROCESSING' | 'READY' | 'FAILED';

export type DocumentSourceType = 'FILE' | 'YOUTUBE' | 'VIMEO' | 'LOOM' | 'URL' | 'GOOGLE_DRIVE';

export interface Document {
  id: string;
  workspaceId: string;
  name: string;
  sourceType: DocumentSourceType;
  status: DocumentStatus;

  // File metadata
  fileSize?: number;
  mimeType?: string;
  s3Key?: string;
  s3Bucket?: string;

  // External source
  externalUrl?: string;

  // Processing metadata
  chunkCount: number;
  embeddingCount: number;
  totalTokens: number;

  // Organization
  folderId?: string | null;
  tags?: string[];

  // Timestamps
  createdAt: string;
  updatedAt: string;
  processedAt?: string | null;

  // Creator
  createdBy: string;

  // Failure info
  failureReason?: string | null;

  // Relations (optional, based on API query)
  folder?: {
    id: string;
    name: string;
  } | null;
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
