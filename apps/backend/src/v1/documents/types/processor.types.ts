/**
 * Processor Type Definitions
 *
 * @description Type definitions for document content processors.
 * Defines interfaces for text extraction, chunking, and processing.
 *
 * @module v1/documents/types/processor
 */

import { DocumentSourceType } from '@actopod/schema';

/**
 * Document processor configuration options
 *
 * @description Configuration for document processor behavior,
 * including file size limits and chunking parameters.
 */
export interface DocumentProcessorConfig {
  /** Maximum file size in bytes */
  maxFileSize: number;

  /** List of supported MIME types */
  supportedMimeTypes: string[];

  /** Maximum tokens per chunk */
  chunkSize: number;

  /** Token overlap between consecutive chunks */
  chunkOverlap: number;
}

/**
 * Extracted content from document processing
 *
 * @description Result of document text extraction.
 * Contains raw text and metadata from the processed document.
 */
export interface DocumentExtractedContent {
  /** Extracted text content */
  text: string;

  /** Metadata extracted from the document */
  metadata: Record<string, any>;

  /** Source type of the document */
  sourceType: DocumentSourceType;
}

/**
 * Text chunk with position and token information
 *
 * @description Represents a single chunk of text from a document.
 * Used for embedding generation and vector search.
 *
 * @example
 * ```
 * const chunk: DocumentTextChunk = {
 *   index: 0,
 *   text: 'This is the first chunk of text...',
 *   tokenCount: 125,
 *   startChar: 0,
 *   endChar: 512,
 *   metadata: {
 *     pageNumber: 1,
 *     section: 'Introduction'
 *   }
 * };
 * ```
 */
export interface DocumentTextChunk {
  /** Zero-indexed chunk number */
  index: number;

  /** Chunk text content */
  text: string;

  /** Number of tokens in this chunk */
  tokenCount: number;

  /** Starting character position in original document */
  startChar: number;

  /** Ending character position in original document */
  endChar: number;

  /** Optional metadata (page numbers, sections, etc.) */
  metadata?: Record<string, any>;
}

/**
 * Document embedding generation result
 *
 * @description Result of embedding generation for a single chunk.
 * Contains the vector embedding and model information.
 */
export interface DocumentEmbeddingResult {
  /** Chunk index this embedding corresponds to */
  chunkIndex: number;

  /** Embedding vector (array of floats) */
  embedding: number[];

  /** Model used to generate embedding */
  model: string;

  /** Embedding vector dimension */
  dimension: number;
}
