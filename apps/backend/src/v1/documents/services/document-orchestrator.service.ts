import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { S3Service } from '../../../common/aws/s3/s3.service';
import { V1DocumentEmbeddingsService } from './embeddings.service';
import { V1GeminiVisionService } from './gemini-vision.service';
import { V1YouTubeProcessorService } from './youtube-processor.service';
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
    private readonly visionService: V1GeminiVisionService,
    private readonly youtubeProcessor: V1YouTubeProcessorService,
  ) {}

  async processDocument(message: DocumentQueueMessage): Promise<void> {
    const startTime = Date.now();
    const { documentId } = message;

    try {
      this.logger.log(`[Orchestrator] 🚀 Starting process for: ${documentId}`);

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
        this.logger.warn(`[Orchestrator] ⚠️ Document not found (likely deleted): ${documentId}`);
        return;
      }

      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: DocumentStatus.PROCESSING },
      });

      let extractedText = '';

      if (document.sourceType === DocumentSourceType.INTERNAL) {
        extractedText = await this.extractTextFromS3Document(
          document.storageKey!,
          document.mimeType!,
        );
      } else {
        extractedText = await this.extractTextFromExternalDocument(
          document.externalUrl!,
          document.sourceType,
        );
      }

      this.logger.debug(`[Orchestrator] 📄 Extracted ${extractedText.length} chars`);

      await this.embeddingsService.generateDocumentEmbeddings(documentId, extractedText);

      if (document.mimeType?.startsWith('image/')) {
        try {
          const signedUrl = await this.s3Service.getSignedUrl(document.storageKey!, 3600);
          const response = await fetch(signedUrl);
          const imageBuffer = Buffer.from(await response.arrayBuffer());

          await this.visionService.analyzeImageVision(
            documentId,
            document.workspaceId,
            imageBuffer,
            document.mimeType,
          );

          this.logger.log(`[Orchestrator] 🖼️ Vision analysis completed for: ${documentId}`);
        } catch (visionError) {
          const err = visionError instanceof Error ? visionError.message : 'Unknown error';
          this.logger.warn(`Vision analysis warning (non-blocking): ${err}`);
        }
      }

      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          status: DocumentStatus.READY,
          metadata: {
            ...(typeof document.metadata === 'object' ? document.metadata : {}),
            processedAt: new Date().toISOString(),
            textLength: extractedText.length,
          },
        },
      });

      const duration = Date.now() - startTime;
      this.logger.log(`[Orchestrator] 🎉 Completed: ${documentId} in ${duration}ms`);
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
      } catch (updateError) {
        if (updateError instanceof Error && updateError.message.includes('No record was found')) {
          this.logger.debug(`[Orchestrator] Document already deleted, skipping error update`);
          return;
        }
        this.logger.error(`Failed to update error status: ${updateError}`);
      }

      throw error;
    }
  }

  private async extractTextFromS3Document(storageKey: string, mimeType: string): Promise<string> {
    this.logger.debug(`[Orchestrator] 📥 Downloading: ${storageKey}`);

    const signedUrl = await this.s3Service.getSignedUrl(storageKey, 3600);
    const response = await fetch(signedUrl);

    if (!response.ok) {
      throw new Error(`Failed to download from S3: ${response.statusText}`);
    }

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
        try {
          const result = await this.youtubeProcessor.processYouTubeURL(externalUrl);

          if (!result.transcript || result.transcript.length < 50) {
            this.logger.log(`[Orchestrator] 📝 No transcript available, using video metadata`);

            return `YouTube Video: ${result.videoTitle}\n\nNo transcript available for this video. Please check YouTube directly for subtitles or captions.`;
          }

          this.logger.log(
            `[Orchestrator] ✅ YouTube transcript extracted: ${result.characterCount} chars`,
          );
          return result.transcript;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(`[Orchestrator] ❌ YouTube processing failed: ${message}`);
          throw error;
        }

      case DocumentSourceType.VIMEO:
      case DocumentSourceType.LOOM:
        throw new Error(`Video transcript extraction not implemented for ${sourceType}`);

      default:
        throw new Error(`Unsupported source type: ${sourceType}`);
    }
  }

  private async extractTextFromBuffer(buffer: Buffer, mimeType: string): Promise<string> {
    switch (mimeType) {
      case 'application/pdf':
        return this.extractTextFromPDF(buffer);

      case 'text/plain':
        return buffer.toString('utf-8');

      case 'image/png':
      case 'image/jpeg':
      case 'image/jpg':
      case 'image/webp':
        return '[Image detected - Gemini Vision will analyze in background]';

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

  private async extractTextFromWebPage(url: string): Promise<string> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Flopods/1.0)',
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
