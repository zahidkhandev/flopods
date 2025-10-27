/**
 * Document Processor Orchestrator Service
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DocumentSourceType, DocumentStatus } from '@actopod/schema';
import { PrismaService } from '../../../prisma/prisma.service';
import { PDFDocumentProcessor } from './pdf-processor.service';
import { ImageDocumentProcessor } from './image-processor.service';
import { YouTubeDocumentProcessor } from './youtube-processor.service';
import { URLDocumentProcessor } from './url-processor.service';
import type { DocumentQueueMessage } from '../types';

@Injectable()
export class DocumentProcessorOrchestrator {
  private readonly logger = new Logger(DocumentProcessorOrchestrator.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfProcessor: PDFDocumentProcessor,
    private readonly imageProcessor: ImageDocumentProcessor,
    private readonly youtubeProcessor: YouTubeDocumentProcessor,
    private readonly urlProcessor: URLDocumentProcessor,
  ) {}

  async processDocument(message: DocumentQueueMessage): Promise<void> {
    const { documentId } = message;

    this.logger.log(`[Orchestrator] Processing: ${documentId} (workspace: ${message.workspaceId})`);

    try {
      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: DocumentStatus.PROCESSING },
      });

      const document = await this.prisma.document.findUnique({
        where: { id: documentId },
        select: { sourceType: true, mimeType: true },
      });

      if (!document) {
        throw new BadRequestException('Document not found');
      }

      const processor = this.getProcessor(document.sourceType, document.mimeType);
      const extracted = await processor.processDocument(documentId);

      this.logger.log(`[Orchestrator] Extracted ${extracted.text.length} chars from ${documentId}`);

      // TODO: Phase 5 - Pass to EmbeddingsService
      // await this.embeddingsService.generateEmbeddings(documentId, extracted.text);

      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          status: DocumentStatus.READY,
          metadata: extracted.metadata as any,
        },
      });

      this.logger.log(`[Orchestrator] Completed: ${documentId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(`[Orchestrator] Failed: ${documentId} - ${errorMessage}`);

      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          status: DocumentStatus.ERROR,
          metadata: { error: errorMessage } as any,
        },
      });

      throw error;
    }
  }

  private getProcessor(sourceType: DocumentSourceType, mimeType: string | null) {
    switch (sourceType) {
      case DocumentSourceType.YOUTUBE:
        return this.youtubeProcessor;

      case DocumentSourceType.URL:
        return this.urlProcessor;

      case DocumentSourceType.INTERNAL:
        if (mimeType?.startsWith('image/')) {
          return this.imageProcessor;
        }
        if (mimeType === 'application/pdf') {
          return this.pdfProcessor;
        }
        throw new BadRequestException(`Unsupported MIME type: ${mimeType}`);

      default:
        throw new BadRequestException(`Unsupported source type: ${sourceType}`);
    }
  }
}
