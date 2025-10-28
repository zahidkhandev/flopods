/**
 * Document MIME Type Detector Utility
 *
 * @description Detects file MIME types and maps them to document source types.
 * Uses file-type for magic number detection and mime-types for extension fallback.
 *
 * @module v1/documents/utils/mime-detector
 */

import { fileTypeFromBuffer } from 'file-type';
import { lookup } from 'mime-types';
import { DocumentSourceType } from '@flopods/schema';

/**
 * Supported document MIME types
 */
export const SUPPORTED_DOCUMENT_MIME_TYPES = {
  // PDFs
  'application/pdf': DocumentSourceType.INTERNAL,

  // Images
  'image/jpeg': DocumentSourceType.INTERNAL,
  'image/jpg': DocumentSourceType.INTERNAL,
  'image/png': DocumentSourceType.INTERNAL,
  'image/webp': DocumentSourceType.INTERNAL,
  'image/gif': DocumentSourceType.INTERNAL,
  'image/bmp': DocumentSourceType.INTERNAL,
  'image/tiff': DocumentSourceType.INTERNAL,

  // Text documents
  'text/plain': DocumentSourceType.INTERNAL,
  'text/markdown': DocumentSourceType.INTERNAL,

  // Microsoft Office
  'application/msword': DocumentSourceType.INTERNAL, // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    DocumentSourceType.INTERNAL, // .docx

  // Other
  'application/rtf': DocumentSourceType.INTERNAL,
} as const;

/**
 * Detect MIME type from document file buffer
 *
 * @description Detects MIME type using file magic numbers.
 * Falls back to extension-based detection if magic number detection fails.
 *
 * @param buffer - File buffer
 * @param filename - Original filename (for extension fallback)
 * @returns MIME type string
 *
 * @throws {Error} If buffer is empty or not a Buffer
 *
 * @example
 * ```
 * const buffer = fs.readFileSync('document.pdf');
 * const mimeType = await detectDocumentMimeType(buffer, 'document.pdf');
 * console.log(mimeType); // 'application/pdf'
 * ```
 */
export async function detectDocumentMimeType(buffer: Buffer, filename?: string): Promise<string> {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Invalid buffer provided');
  }

  // Try magic number detection first (most accurate)
  try {
    const fileType = await fileTypeFromBuffer(buffer);
    if (fileType?.mime) {
      return fileType.mime;
    }
  } catch {
    // Fallback to extension-based detection
  }

  // Fallback: Extension-based detection
  if (filename) {
    const mimeFromExtension = lookup(filename);
    if (mimeFromExtension) {
      return mimeFromExtension;
    }
  }

  // Default fallback
  return 'application/octet-stream';
}

/**
 * Check if document MIME type is supported
 *
 * @description Validates if the MIME type is supported for processing.
 *
 * @param mimeType - MIME type string
 * @returns True if supported, false otherwise
 *
 * @example
 * ```
 * const isSupported = isDocumentMimeTypeSupported('application/pdf');
 * console.log(isSupported); // true
 *
 * const isSupported2 = isDocumentMimeTypeSupported('video/mp4');
 * console.log(isSupported2); // false
 * ```
 */
export function isDocumentMimeTypeSupported(mimeType: string): boolean {
  return mimeType in SUPPORTED_DOCUMENT_MIME_TYPES;
}

/**
 * Get document file type category from MIME type
 *
 * @description Categorizes files into PDF, IMAGE, TEXT, or DOCUMENT.
 *
 * @param mimeType - MIME type string
 * @returns File type category
 *
 * @example
 * ```
 * const category = getDocumentFileCategory('application/pdf');
 * console.log(category); // 'PDF'
 *
 * const category2 = getDocumentFileCategory('image/jpeg');
 * console.log(category2); // 'IMAGE'
 * ```
 */
export function getDocumentFileCategory(
  mimeType: string,
): 'PDF' | 'IMAGE' | 'TEXT' | 'DOCUMENT' | 'UNKNOWN' {
  if (mimeType === 'application/pdf') {
    return 'PDF';
  }

  if (mimeType.startsWith('image/')) {
    return 'IMAGE';
  }

  if (mimeType.startsWith('text/')) {
    return 'TEXT';
  }

  if (
    mimeType.includes('word') ||
    mimeType.includes('document') ||
    mimeType === 'application/rtf'
  ) {
    return 'DOCUMENT';
  }

  return 'UNKNOWN';
}

/**
 * Validate document file type for upload
 *
 * @description Validates file buffer and returns MIME type if supported.
 *
 * @param buffer - File buffer
 * @param filename - Original filename
 * @returns Object with MIME type and category
 *
 * @throws {Error} If file type is not supported
 *
 * @example
 * ```
 * const buffer = fs.readFileSync('document.pdf');
 * const validation = await validateDocumentFileType(buffer, 'document.pdf');
 * console.log(validation);
 * // {
 * //   mimeType: 'application/pdf',
 * //   category: 'PDF',
 * //   isSupported: true
 * // }
 * ```
 */
export async function validateDocumentFileType(
  buffer: Buffer,
  filename?: string,
): Promise<{
  mimeType: string;
  category: string;
  isSupported: boolean;
}> {
  const mimeType = await detectDocumentMimeType(buffer, filename);
  const category = getDocumentFileCategory(mimeType);
  const isSupported = isDocumentMimeTypeSupported(mimeType);

  if (!isSupported) {
    throw new Error(
      `File type '${mimeType}' is not supported. Supported types: PDF, images, text documents.`,
    );
  }

  return {
    mimeType,
    category,
    isSupported,
  };
}
