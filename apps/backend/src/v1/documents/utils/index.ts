/**
 * Document Utilities Barrel Export
 *
 * @description Centralized export for all document processing utilities.
 * Provides clean imports for utility functions.
 *
 * @module v1/documents/utils
 *
 * @example
 * ```
 * import {
 *   countDocumentTokens,
 *   chunkDocumentText,
 *   calculateDocumentEmbeddingCost,
 *   YouTubeURLParser,
 * } from '../utils';
 * ```
 */

export { countDocumentTokens, freeDocumentEncoder, getDocumentEncoder } from './token-counter.util';
export {
  chunkDocumentText,
  DEFAULT_DOCUMENT_CHUNK_CONFIG,
  type DocumentChunkConfig,
} from './text-chunker.util';
export * from './cost-calculator.util';
export {
  detectDocumentMimeType,
  isDocumentMimeTypeSupported,
  getDocumentFileCategory,
  validateDocumentFileType,
  SUPPORTED_DOCUMENT_MIME_TYPES,
} from './mime-detector.util';
export { V1YouTubeURLParser, V1YouTubeInvalidURLError } from './youtube-url-parser.util';
