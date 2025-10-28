/**
 * Document Types Barrel Export
 *
 * @description Centralized export for all document processing types.
 * Provides clean imports for document processing functionality.
 *
 * @module v1/documents/types
 *
 * @example
 * ```
 * import {
 *   DocumentStatus,
 *   DocumentProcessingAction,
 *   DocumentQueueMessage,
 *   DocumentTextChunk,
 *   DocumentEmbeddingProvider,
 *   GEMINI_EMBEDDING_PROVIDER,
 * } from '../types';
 * ```
 */

// Document types
export * from './document.types';

// Queue types
export * from './queue.types';

// Processor types
export * from './processor.types';

// Embedding types
export * from './embedding.types';
