import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { S3Service } from '../../../common/aws/s3/s3.service';
import { V1DocumentEmbeddingsService } from './embeddings.service';
import { V1GeminiVisionService } from './gemini-vision.service';
import { V1YouTubeProcessorService } from './youtube-processor.service';
import { DocumentStatus, DocumentSourceType } from '@flopods/schema';
import type { DocumentQueueMessage } from '../types';
import { V1DocumentQueueProducer } from '../queues/document-queue.producer';
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
    private readonly queueProducer: V1DocumentQueueProducer,
  ) {}

  async processDocument(message: DocumentQueueMessage): Promise<void> {
    const startTime = Date.now();
    const { documentId, retryCount = 0 } = message;

    try {
      this.logger.log(
        `[Orchestrator] 🚀 Starting process for: ${documentId} (retry: ${retryCount})`,
      );

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

      if (message.action === 'GENERATE_EMBEDDINGS') {
        this.logger.log(
          `[Orchestrator] 🧮 Generating embeddings for: ${documentId} (attempt ${retryCount + 1})`,
        );

        try {
          const extractedText =
            typeof message.metadata?.extractedText === 'string'
              ? message.metadata.extractedText
              : '';

          if (!extractedText) {
            this.logger.warn(`[Orchestrator] ⚠️ No extracted text for embeddings: ${documentId}`);
            return;
          }

          await this.embeddingsService.generateDocumentEmbeddings(documentId, extractedText);

          await this.prisma.document.update({
            where: { id: documentId },
            data: {
              metadata: {
                ...(typeof document.metadata === 'object' ? document.metadata : {}),
                embeddingStatus: 'COMPLETE',
                embeddingsGeneratedAt: new Date().toISOString(),
              },
            },
          });

          this.logger.log(`[Orchestrator] ✅ Embeddings generated successfully: ${documentId}`);
          return;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';

          if (errorMessage.includes('429') || errorMessage.includes('quota')) {
            this.logger.warn(`[Orchestrator] ⚠️ Quota exceeded (429) - Will retry: ${documentId}`);

            if (retryCount < 7) {
              try {
                await this.queueProducer.queueEmbeddingGenerationWithBackoff({
                  documentId,
                  workspaceId: document.workspaceId,
                  userId: message.userId || 'system',
                  extractedText: message.metadata?.extractedText || '',
                  retryCount: retryCount + 1,
                });
                this.logger.log(
                  `[Orchestrator] ✅ Embeddings requeued with backoff (attempt ${retryCount + 2})`,
                );
              } catch (queueError) {
                const qErr = queueError instanceof Error ? queueError.message : 'Unknown error';
                this.logger.error(`[Orchestrator] ⚠️ Failed to requeue embeddings: ${qErr}`);
              }
            }
            return;
          }

          this.logger.error(`[Orchestrator] ❌ Embeddings generation failed: ${errorMessage}`);

          await this.prisma.document.update({
            where: { id: documentId },
            data: {
              metadata: {
                ...(typeof document.metadata === 'object' ? document.metadata : {}),
                embeddingStatus: 'FAILED',
                lastEmbeddingError: errorMessage,
                embeddingFailedAt: new Date().toISOString(),
              },
            },
          });
          return;
        }
      }

      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: DocumentStatus.PROCESSING },
      });

      let extractedText = '';

      try {
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
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`[Orchestrator] ❌ Text extraction failed: ${errorMessage}`);

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
        return;
      }

      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          status: DocumentStatus.READY,
          metadata: {
            ...(typeof document.metadata === 'object' ? document.metadata : {}),
            processedAt: new Date().toISOString(),
            textLength: extractedText.length,
            extractionSource: document.sourceType,
            embeddingStatus: 'PENDING',
          },
        },
      });

      this.logger.log(`[Orchestrator] ✅ Document saved with text: ${extractedText.length} chars`);

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
          this.logger.warn(`[Orchestrator] ⚠️ Vision analysis warning (non-blocking): ${err}`);
        }
      }

      try {
        await this.queueProducer.queueEmbeddingGenerationWithBackoff({
          documentId,
          workspaceId: document.workspaceId,
          userId: message.userId || 'system',
          extractedText,
          retryCount: 0,
        });
      } catch (queueError) {
        const err = queueError instanceof Error ? queueError.message : 'Unknown error';
        this.logger.warn(`[Orchestrator] ⚠️ Failed to queue embeddings: ${err} (non-blocking)`);
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `[Orchestrator] 🎉 Completed: ${documentId} in ${duration}ms (Text saved, embeddings queued)`,
      );
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
              errorStack: errorStack,
            },
          },
        });
      } catch (updateError) {
        if (updateError instanceof Error && updateError.message.includes('No record was found')) {
          this.logger.debug(`[Orchestrator] Document already deleted, skipping error update`);
          return;
        }
        this.logger.error(`[Orchestrator] Failed to update error status: ${updateError}`);
      }

      throw error;
    }
  }

  private async extractTextFromS3Document(storageKey: string, mimeType: string): Promise<string> {
    this.logger.debug(`[Orchestrator] 📥 Downloading from S3: ${storageKey}`);

    try {
      const signedUrl = await this.s3Service.getSignedUrl(storageKey, 3600);
      const response = await fetch(signedUrl);

      if (!response.ok) {
        throw new Error(`Failed to download from S3: ${response.status} ${response.statusText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      this.logger.debug(`[Orchestrator] ✅ Downloaded ${buffer.length} bytes`);

      return this.extractTextFromBuffer(buffer, mimeType);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`S3 extraction failed: ${errorMessage}`);
    }
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
        return this.extractTextFromYouTube(externalUrl);

      case DocumentSourceType.VIMEO:
      case DocumentSourceType.LOOM:
        throw new Error(`Video transcript extraction not implemented for ${sourceType}`);

      default:
        throw new Error(`Unsupported source type: ${sourceType}`);
    }
  }

  private async extractTextFromYouTube(videoUrl: string): Promise<string> {
    try {
      const result = await this.youtubeProcessor.processYouTubeURL(videoUrl);

      if (!result.hasTranscript || result.transcript.length < 20) {
        this.logger.log(`[Orchestrator] 📝 No transcript available for YouTube video`);

        try {
          const videoId = videoUrl.match(
            /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
          )?.[1];

          if (videoId) {
            const details = await this.youtubeProcessor.getVideoDetails(videoId);

            if (details.success && details.title) {
              return `YouTube Video: ${details.title}\n\nDescription: ${
                details.description || 'N/A'
              }\n\n[No transcript available for this video]`;
            }
          }
        } catch {
          this.logger.debug(`[Orchestrator] Could not fetch video details (non-blocking)`);
        }

        return `YouTube Video: ${result.videoTitle}\n\n[No transcript available]`;
      }

      this.logger.log(
        `[Orchestrator] ✅ YouTube transcript extracted: ${result.characterCount} chars (${result.captionEventCount} captions)`,
      );

      return result.transcript;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[Orchestrator] ❌ YouTube processing failed: ${message}`);

      return `[YouTube transcript extraction failed: ${message}]`;
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
        return '[Image detected - Gemini Vision will analyze]';

      default:
        throw new Error(`Unsupported MIME type: ${mimeType}`);
    }
  }

  private async extractTextFromPDF(buffer: Buffer): Promise<string> {
    try {
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      await parser.destroy();

      const text = result.text.trim();
      if (!text || text.length < 10) {
        throw new Error('PDF is empty or too short');
      }

      return text;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`PDF extraction failed: ${errorMessage}`);
    }
  }

  private async extractTextFromWebPage(url: string): Promise<string> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'text/html,application/xhtml+xml',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

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
        throw new Error('Extracted text is empty or too short');
      }

      return text;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Web scraping failed: ${errorMessage}`);
    }
  }
}
