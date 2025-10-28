/**
 * Base Document Processor
 *
 * @description Abstract base class for all document processors.
 * Defines common interface for PDF, Image, YouTube, and URL processors.
 *
 * @module v1/documents/processors/base-processor
 */

import type { DocumentExtractedContent } from '../types';

/**
 * Abstract base processor for document content extraction
 *
 * @description All document processors must extend this class
 * and implement the process method.
 */
export abstract class BaseDocumentProcessor {
  /**
   * Process document and extract content
   *
   * @param documentId - Document ID from database
   * @returns Extracted content with metadata
   */
  abstract processDocument(documentId: string): Promise<DocumentExtractedContent>;

  /**
   * Validate document before processing
   *
   * @param buffer - File buffer (for internal files)
   * @param url - External URL (for external sources)
   * @returns True if valid, throws error if invalid
   */
  abstract validateDocument(buffer?: Buffer, url?: string): Promise<boolean>;

  /**
   * Get document metadata without full processing
   *
   * @param buffer - File buffer (for internal files)
   * @param url - External URL (for external sources)
   * @returns Document metadata
   */
  abstract getDocumentMetadata(buffer?: Buffer, url?: string): Promise<Record<string, any>>;
}
