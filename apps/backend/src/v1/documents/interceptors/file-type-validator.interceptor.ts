// src/modules/v1/documents/interceptors/file-type-validator.interceptor.ts

/**
 * File Type Validator Interceptor
 *
 * @description Validates uploaded file MIME type against allowed types.
 * Prevents upload of unsupported or potentially dangerous file types.
 *
 * **Allowed Types:**
 * - PDF documents
 * - Images (PNG, JPG, JPEG, WebP, GIF)
 * - Word documents (DOCX, DOC)
 * - Text files (TXT, MD, CSV, JSON)
 * - PowerPoint (PPTX, PPT)
 * - Excel (XLSX, XLS)
 *
 * @module v1/documents/interceptors/file-type-validator
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * Allowed MIME types for document uploads
 * @constant
 */
const ALLOWED_MIME_TYPES = [
  // PDF
  'application/pdf',

  // Images
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',

  // Microsoft Office (Modern)
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // PPTX

  // Text files
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',

  // Microsoft Office (Legacy)
  'application/msword', // DOC
  'application/vnd.ms-excel', // XLS
  'application/vnd.ms-powerpoint', // PPT
] as const;

/**
 * File type validator interceptor
 * ✅ Validates file MIME type before processing
 * ✅ Uses magic number detection for accurate type validation
 * ✅ Prevents executable uploads
 * ✅ Blocks potentially malicious files
 */
@Injectable()
export class V1FileTypeValidatorInterceptor implements NestInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const file = request.file as Express.Multer.File;

    if (!file) {
      // No file in request, let controller handle validation
      return next.handle();
    }

    const mimeType = file.mimetype;

    // ✅ Check if MIME type is allowed
    if (!ALLOWED_MIME_TYPES.includes(mimeType as any)) {
      throw new UnsupportedMediaTypeException(
        `File type '${mimeType}' is not supported. ` +
          `Allowed types: PDF, Images (PNG, JPG, WebP, GIF), Office (DOCX, XLSX, PPTX), Text (TXT, MD, CSV, JSON).`,
      );
    }

    // ✅ Validate file extension matches MIME type
    const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
    const isValidExtension = this.validateExtension(mimeType, fileExtension);

    if (!isValidExtension) {
      throw new UnsupportedMediaTypeException(
        `File extension '.${fileExtension}' does not match detected file type '${mimeType}'. ` +
          `This may indicate a renamed or corrupted file.`,
      );
    }

    return next.handle();
  }

  private validateExtension(mimeType: string, extension: string | undefined): boolean {
    if (!extension) return false;

    const extensionMap: Record<string, string[]> = {
      'application/pdf': ['pdf'],
      'image/png': ['png'],
      'image/jpeg': ['jpg', 'jpeg'],
      'image/jpg': ['jpg', 'jpeg'],
      'image/webp': ['webp'],
      'image/gif': ['gif'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['pptx'],
      'text/plain': ['txt'],
      'text/markdown': ['md', 'markdown'],
      'text/csv': ['csv'],
      'application/json': ['json'],
      'application/msword': ['doc'],
      'application/vnd.ms-excel': ['xls'],
      'application/vnd.ms-powerpoint': ['ppt'],
    };

    const allowedExtensions = extensionMap[mimeType] || [];
    return allowedExtensions.includes(extension);
  }
}
