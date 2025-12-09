// /src/modules/v1/documents/utils/mime-detector.util.ts

import { fileTypeFromBuffer } from 'file-type';
import { lookup } from 'mime-types';
import { DocumentSourceType } from '@flopods/schema';

export const SUPPORTED_DOCUMENT_MIME_TYPES = {
  'application/pdf': DocumentSourceType.INTERNAL,
  'image/jpeg': DocumentSourceType.INTERNAL,
  'image/jpg': DocumentSourceType.INTERNAL,
  'image/png': DocumentSourceType.INTERNAL,
  'image/webp': DocumentSourceType.INTERNAL,
  'image/gif': DocumentSourceType.INTERNAL,
  'image/bmp': DocumentSourceType.INTERNAL,
  'image/tiff': DocumentSourceType.INTERNAL,
  'text/plain': DocumentSourceType.INTERNAL,
  'text/markdown': DocumentSourceType.INTERNAL,
  'application/msword': DocumentSourceType.INTERNAL,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    DocumentSourceType.INTERNAL,
  'application/rtf': DocumentSourceType.INTERNAL,
} as const;

export async function detectDocumentMimeType(buffer: Buffer, filename?: string): Promise<string> {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Invalid buffer provided');
  }

  try {
    const fileType = await fileTypeFromBuffer(buffer);
    if (fileType?.mime) {
      return fileType.mime;
    }
  } catch {
    // Fallback
  }

  if (filename) {
    const mimeFromExtension = lookup(filename);
    if (mimeFromExtension) {
      return mimeFromExtension as string;
    }
  }

  return 'application/octet-stream';
}

export function isDocumentMimeTypeSupported(mimeType: string): boolean {
  return mimeType in SUPPORTED_DOCUMENT_MIME_TYPES;
}

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
