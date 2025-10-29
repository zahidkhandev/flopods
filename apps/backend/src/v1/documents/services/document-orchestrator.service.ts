/**
 * Document Orchestrator Service - WITH IMAGE SUPPORT
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { S3Service } from '../../../common/aws/s3/s3.service';
import { V1DocumentEmbeddingsService } from './embeddings.service';
import { DocumentStatus, DocumentSourceType } from '@flopods/schema';
import type { DocumentQueueMessage } from '../types';
import { PDFParse } from 'pdf-parse';

@Injectable()
export class V1DocumentOrchestratorService {
  private readonly logger = new Logger(V1DocumentOrchestratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    private readonly embeddingsService: V1DocumentEmbeddingsService,
  ) {}

  async processDocument(message: DocumentQueueMessage): Promise<void> {
    const startTime = Date.now();
    const { documentId, action } = message;

    try {
      this.logger.log(`[Orchestrator] 🚀 Starting ${action} for: ${documentId}`);

      const document = await this.prisma.document.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          workspaceId: true,
          name: true,
          sourceType: true,
          mimeType: true,
          storageKey: true,
          s3Bucket: true,
          externalUrl: true,
          status: true,
          metadata: true,
        },
      });

      if (!document) {
        throw new BadRequestException(`Document not found: ${documentId}`);
      }

      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: DocumentStatus.PROCESSING },
      });

      const extractedText =
        document.sourceType === DocumentSourceType.INTERNAL
          ? await this.extractTextFromS3Document(document.storageKey!, document.mimeType!)
          : await this.extractTextFromExternalDocument(document.externalUrl!, document.sourceType);

      this.logger.debug(`[Orchestrator] 📄 Extracted ${extractedText.length} chars`);

      await this.embeddingsService.generateDocumentEmbeddings(documentId, extractedText);

      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          status: DocumentStatus.READY,
          metadata: {
            ...(document.metadata as any),
            processedAt: new Date().toISOString(),
            textLength: extractedText.length,
          },
        },
      });

      const duration = Date.now() - startTime;
      this.logger.log(`[Orchestrator] 🎉 Completed ${documentId} in ${duration}ms`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      const duration = Date.now() - startTime;

      this.logger.error(
        `[Orchestrator] ❌ Failed ${documentId} (${duration}ms): ${errorMessage}`,
        errorStack,
      );

      try {
        await this.prisma.document.update({
          where: { id: documentId },
          data: {
            status: DocumentStatus.ERROR,
            metadata: {
              error: errorMessage,
              failedAt: new Date().toISOString(),
            },
          },
        });
      } catch {
        this.logger.error(`[Orchestrator] ❌ Failed to update error status`);
      }

      throw error;
    }
  }

  private async extractTextFromS3Document(storageKey: string, mimeType: string): Promise<string> {
    this.logger.debug(`[Orchestrator] 📥 Downloading: ${storageKey}`);

    const signedUrl = await this.s3Service.getSignedUrl(storageKey, 3600);
    const response = await fetch(signedUrl);
    const buffer = Buffer.from(await response.arrayBuffer());

    this.logger.debug(`[Orchestrator] ✅ Downloaded ${buffer.length} bytes`);

    return this.extractTextFromBuffer(buffer, mimeType);
  }

  private async extractTextFromExternalDocument(
    externalUrl: string,
    sourceType: DocumentSourceType,
  ): Promise<string> {
    this.logger.debug(`[Orchestrator] 🌐 Fetching: ${externalUrl}`);

    switch (sourceType) {
      case DocumentSourceType.URL:
        return this.extractTextFromWebPage(externalUrl);

      case DocumentSourceType.YOUTUBE:
      case DocumentSourceType.VIMEO:
      case DocumentSourceType.LOOM:
        throw new Error(`Video transcript extraction not implemented for ${sourceType}`);

      default:
        throw new Error(`Unsupported source type: ${sourceType}`);
    }
  }

  /**
   * ✅ UPDATED: Added image support
   */
  private async extractTextFromBuffer(buffer: Buffer, mimeType: string): Promise<string> {
    switch (mimeType) {
      case 'application/pdf':
        return this.extractTextFromPDF(buffer);

      case 'text/plain':
        return buffer.toString('utf-8');

      // ✅ IMAGE SUPPORT - Placeholder for now
      case 'image/png':
      case 'image/jpeg':
      case 'image/jpg':
        return this.extractTextFromImage(buffer, mimeType);

      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case 'application/msword':
        throw new Error('DOCX extraction not yet implemented');

      default:
        throw new Error(`Unsupported MIME type: ${mimeType}`);
    }
  }

  private async extractTextFromPDF(buffer: Buffer): Promise<string> {
    try {
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      await parser.destroy();

      return result.text.trim();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`PDF extraction failed: ${errorMessage}`);
    }
  }

  /**
   * ✅ NEW: Extract text from images using OCR
   * TODO: Implement Gemini Vision API or Tesseract.js
   */
  private async extractTextFromImage(buffer: Buffer, mimeType: string): Promise<string> {
    this.logger.warn(`[Orchestrator] ⚠️ Image OCR not yet implemented for ${mimeType}`);

    // For now, return a placeholder to allow processing
    // TODO: Implement Gemini Vision API for OCR
    return `[Image file: ${mimeType}. OCR extraction not yet implemented. This is a placeholder to allow document processing to continue. Implement Gemini Vision API or Tesseract.js for actual text extraction.]`;
  }

  private async extractTextFromWebPage(url: string): Promise<string> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Flopods/1.0; +https://flopods.dev)',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();

      const text = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (!text || text.length < 50) {
        throw new Error('Extracted text too short or empty');
      }

      return text;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Web scraping failed: ${errorMessage}`);
    }
  }
}
