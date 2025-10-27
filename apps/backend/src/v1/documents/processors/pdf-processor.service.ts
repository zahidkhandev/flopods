/**
 * PDF Document Processor Service
 *
 * @description Production-grade PDF text extraction service with full S3 integration.
 * Compatible with ResponseInterceptor for consistent API responses.
 *
 * @module v1/documents/processors/pdf-processor
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import * as pdfParse from 'pdf-parse';
import { BaseDocumentProcessor } from './base-processor.abstract';
import type { DocumentExtractedContent } from '../types';
import { DocumentSourceType } from '@actopod/schema';
import { PrismaService } from '../../../prisma/prisma.service';
import { S3Service } from '../../../common/aws/s3/s3.service';

/**
 * PDF document processor service
 *
 * @description Extracts text content from PDF documents stored in S3.
 * Validates PDF signature, extracts metadata, and handles errors gracefully.
 * Returns data compatible with ResponseInterceptor format.
 */
@Injectable()
export class PDFDocumentProcessor extends BaseDocumentProcessor {
  private readonly logger = new Logger(PDFDocumentProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
  ) {
    super();
  }

  /**
   * Process PDF document and extract text content
   *
   * @param documentId - Document ID from database
   * @returns Extracted content with text and metadata
   * @throws {NotFoundException} If document not found
   * @throws {BadRequestException} If PDF is invalid
   */
  async processDocument(documentId: string): Promise<DocumentExtractedContent> {
    this.logger.log(`[PDF Processor] Starting processing: ${documentId}`);

    // Fetch document from database
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        name: true,
        storageKey: true,
        s3Bucket: true,
        mimeType: true,
        sizeInBytes: true,
      },
    });

    if (!document) {
      throw new NotFoundException(`Document not found: ${documentId}`);
    }

    if (!document.storageKey || !document.s3Bucket) {
      throw new BadRequestException(`Document storage information missing: ${documentId}`);
    }

    this.logger.debug(`[PDF Processor] Downloading from S3: ${document.storageKey}`);

    // Get signed URL with 1 hour expiration
    const signedUrl = await this.s3Service.getSignedUrl(document.storageKey, 3600);

    // Download PDF from S3
    const response = await fetch(signedUrl);

    if (!response.ok) {
      this.logger.error(
        `[PDF Processor] Download failed: ${response.status} ${response.statusText}`,
      );
      throw new BadRequestException(`Failed to download PDF from S3`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    this.logger.debug(`[PDF Processor] Downloaded ${buffer.length} bytes`);

    // Validate PDF format
    await this.validateDocument(buffer);

    // Extract text and metadata from PDF
    this.logger.debug(`[PDF Processor] Extracting text...`);
    const pdfData = await (pdfParse as any)(buffer);

    const extractedContent: DocumentExtractedContent = {
      text: pdfData.text,
      metadata: {
        pageCount: pdfData.numpages,
        info: pdfData.info || {},
        fileName: document.name,
        fileSize: document.sizeInBytes,
      },
      sourceType: DocumentSourceType.INTERNAL,
    };

    this.logger.log(
      `[PDF Processor] Successfully processed: ${documentId} (${pdfData.numpages} pages, ${pdfData.text.length} chars)`,
    );

    return extractedContent;
  }

  /**
   * Validate PDF document format
   *
   * @param buffer - PDF file buffer
   * @returns True if valid PDF
   * @throws {BadRequestException} If PDF is invalid
   */
  async validateDocument(buffer?: Buffer): Promise<boolean> {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('Invalid PDF buffer: empty or null');
    }

    // Check minimum file size (PDF header is at least 5 bytes)
    if (buffer.length < 5) {
      throw new BadRequestException('Invalid PDF: file too small');
    }

    // Check PDF signature (magic bytes: %PDF-)
    const pdfSignature = buffer.slice(0, 5).toString('utf8');
    if (!pdfSignature.startsWith('%PDF-')) {
      throw new BadRequestException('Invalid PDF: missing PDF signature');
    }

    this.logger.debug('[PDF Processor] PDF validation passed');
    return true;
  }

  /**
   * Get PDF metadata without full text extraction
   *
   * @param buffer - PDF file buffer
   * @returns PDF metadata object
   * @throws {BadRequestException} If metadata extraction fails
   */
  async getDocumentMetadata(buffer?: Buffer): Promise<Record<string, any>> {
    if (!buffer) {
      throw new BadRequestException('Buffer is required for PDF metadata extraction');
    }

    try {
      const pdfData = await (pdfParse as any)(buffer);
      return {
        pageCount: pdfData.numpages,
        info: pdfData.info || {},
        version: pdfData.version,
      };
    } catch {
      throw new BadRequestException('Failed to extract PDF metadata');
    }
  }
}
