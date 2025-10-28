/**
 * Document Type Definitions
 *
 * @description Core type definitions for document processing system.
 * Re-exports Prisma enums and adds application-specific types.
 *
 * @module v1/documents/types/document
 */

import { DocumentSourceType, DocumentStatus, DocumentProcessingType } from '@flopods/schema';

/**
 * Re-export Prisma enums for document processing
 */
export { DocumentSourceType, DocumentStatus, DocumentProcessingType };

/**
 * Document processing actions for queue messages
 */
export enum DocumentProcessingAction {
  /** Initial document processing with text extraction and embedding generation */
  PROCESS = 'PROCESS',

  /** Regenerate embeddings for existing document (e.g., after model upgrade) */
  REPROCESS = 'REPROCESS',

  /** Generate thumbnail for document (PDF first page, video frame) */
  THUMBNAIL = 'THUMBNAIL',
}

/**
 * Document queue message priority levels
 */
export enum DocumentMessagePriority {
  /** User-initiated uploads, immediate processing required */
  HIGH = 'HIGH',

  /** Bulk uploads, reprocessing, scheduled jobs */
  NORMAL = 'NORMAL',

  /** Thumbnail generation, cleanup, maintenance tasks */
  LOW = 'LOW',
}

/**
 * Document metadata structure for various source types
 */
export interface DocumentMetadata {
  /** MIME type of the file (e.g., 'application/pdf', 'image/jpeg') */
  fileType?: string;

  /** Source type of the document */
  sourceType?: DocumentSourceType;

  /** Estimated token count before processing */
  estimatedTokens?: number;

  /** Number of retry attempts for failed processing */
  retryCount?: number;

  /** Number of pages (PDFs) */
  pageCount?: number;

  /** Video duration in seconds (YouTube) */
  duration?: number;

  /** Thumbnail URL */
  thumbnail?: string;

  /** Document author/creator */
  author?: string;

  /** YouTube channel name */
  channelName?: string;

  /** Original URL (for external sources) */
  url?: string;
}

/**
 * Result of document processing operation
 */
export interface DocumentProcessingResult {
  /** Whether processing completed successfully */
  success: boolean;

  /** Document ID that was processed */
  documentId: string;

  /** Number of text chunks generated */
  chunkCount?: number;

  /** Total tokens processed */
  tokensProcessed?: number;

  /** Processing time in milliseconds */
  processingTimeMs?: number;

  /** Error message if processing failed */
  error?: string;
}

/**
 * Vector search result with document context
 */
export interface DocumentVectorSearchResult {
  /** Embedding ID */
  embeddingId: string;

  /** Document ID */
  documentId: string;

  /** Document name */
  documentName: string;

  /** Chunk index in document */
  chunkIndex: number;

  /** Chunk text content */
  chunkText: string;

  /** Similarity score (0-1, higher is more similar) */
  similarity: number;

  /** Document metadata */
  documentMetadata: Record<string, any>;
}

/**
 * Cost summary for a time period
 */
export interface DocumentCostSummary {
  /** Total USD cost */
  totalCost: number;

  /** Total credits consumed */
  totalCredits: number;

  /** Total documents processed */
  documentsProcessed: number;

  /** Total tokens processed */
  tokensProcessed: number;

  /** Total chunks created */
  chunksCreated: number;

  /** Breakdown by processing type */
  byType: {
    type: DocumentProcessingType;
    cost: number;
    credits: number;
    count: number;
  }[];
}

/**
 * Daily cost breakdown
 */
export interface DocumentDailyCost {
  date: string;
  cost: number;
  credits: number;
  documentsProcessed: number;
}
