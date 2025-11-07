import { Injectable, Logger } from '@nestjs/common';
import { LLMProvider } from '@flopods/schema';
import type { IDocumentQueueService } from './queue.interface';
import type { DocumentQueueMessage } from '../types';
import { DocumentProcessingAction, DocumentMessagePriority } from '../types';
import { V1DocumentQueueFactory } from './queue.factory';

@Injectable()
export class V1DocumentQueueProducer {
  private readonly logger = new Logger(V1DocumentQueueProducer.name);
  private readonly queueService: IDocumentQueueService;

  constructor(private readonly queueFactory: V1DocumentQueueFactory) {
    this.queueService = this.queueFactory.createDocumentQueue();
  }

  async sendDocumentProcessingJob(params: {
    documentId: string;
    workspaceId: string;
    userId: string;
    fileType: string;
    sourceType: string;
    externalUrl?: string;
    estimatedTokens?: number;
    visionProvider?: LLMProvider;
  }): Promise<string> {
    const message: DocumentQueueMessage = {
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      documentId: params.documentId,
      workspaceId: params.workspaceId,
      userId: params.userId,
      action: DocumentProcessingAction.PROCESS,
      priority: DocumentMessagePriority.HIGH,
      metadata: {
        fileType: params.fileType,
        sourceType: params.sourceType as any,
        externalUrl: params.externalUrl, // ✅ NOW DEFINED IN DocumentMetadata
        estimatedTokens: params.estimatedTokens,
      },
      timestamp: new Date().toISOString(),
    };

    try {
      const messageId = await this.queueService.sendDocumentMessage(message);
      this.logger.log(`[Producer] Document processing job queued: ${params.documentId}`);
      return messageId;
    } catch (error) {
      const _errorMessage = error instanceof Error ? error.message : 'Unknown error'; // ✅ FIXED: Prefixed with _ for unused variable
      this.logger.error(`[Producer] Failed to queue: ${params.documentId} - ${_errorMessage}`);
      throw error;
    }
  }

  async queueEmbeddingsNow(payload: {
    documentId: string;
    workspaceId: string;
    userId: string;
    extractedText: string; // pass text so we don't re-fetch
  }): Promise<string> {
    const { documentId, workspaceId, userId, extractedText } = payload;

    const message: DocumentQueueMessage = {
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      documentId,
      workspaceId,
      userId,
      action: DocumentProcessingAction.GENERATE_EMBEDDINGS,
      priority: DocumentMessagePriority.HIGH, // run ASAP
      metadata: {
        fileType: '',
        sourceType: '' as any,
        retryCount: 0, // first attempt
        extractedText, // supply text for embeddings
      },
      timestamp: new Date().toISOString(),
    };

    try {
      this.logger.log(`[Producer] ▶️ Queueing embeddings NOW for ${documentId}`);
      const messageId = await this.queueService.sendDocumentMessage(message);
      this.logger.log(`[Producer] ✅ Embeddings queued now: ${documentId}`);
      return messageId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[Producer] ❌ Failed to queue embeddings now: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * ✅ Queue embeddings with exponential backoff
   */
  async queueEmbeddingGenerationWithBackoff(payload: {
    documentId: string;
    workspaceId: string;
    userId: string;
    extractedText: string;
    retryCount: number;
  }): Promise<string> {
    const { documentId, workspaceId, userId, extractedText, retryCount } = payload;

    // ✅ Exponential backoff delays in milliseconds
    const backoffDelays = [
      5 * 60 * 1000, // 5 minutes
      15 * 60 * 1000, // 15 minutes
      30 * 60 * 1000, // 30 minutes
      60 * 60 * 1000, // 1 hour
      2 * 60 * 60 * 1000, // 2 hours
      4 * 60 * 60 * 1000, // 4 hours
      8 * 60 * 60 * 1000, // 8 hours
    ];

    const delayMs = backoffDelays[Math.min(retryCount, 6)];
    const delaySeconds = Math.ceil(delayMs / 1000);

    const message: DocumentQueueMessage = {
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      documentId,
      workspaceId,
      userId,
      action: DocumentProcessingAction.GENERATE_EMBEDDINGS,
      priority: DocumentMessagePriority.LOW,
      metadata: {
        fileType: '',
        sourceType: '' as any,
        retryCount,
        extractedText, // ✅ Include text for embeddings
      },
      timestamp: new Date().toISOString(),
    };

    try {
      this.logger.log(
        `[Producer] ⏰ Queueing embeddings for ${documentId} in ${delaySeconds}s (attempt ${retryCount + 1})`,
      );

      const messageId = await this.queueService.sendDocumentMessageWithDelay(message, delayMs);

      this.logger.log(`[Producer] ✅ Embeddings queued with backoff: ${documentId}`);
      return messageId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[Producer] ❌ Failed to queue embeddings with backoff: ${errorMessage}`);
      throw error;
    }
  }

  async sendDocumentReprocessingJob(params: {
    documentId: string;
    workspaceId: string;
    userId: string;
  }): Promise<string> {
    const message: DocumentQueueMessage = {
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      documentId: params.documentId,
      workspaceId: params.workspaceId,
      userId: params.userId,
      action: DocumentProcessingAction.REPROCESS,
      priority: DocumentMessagePriority.NORMAL,
      metadata: {
        fileType: '',
        sourceType: '' as any,
      },
      timestamp: new Date().toISOString(),
    };

    try {
      const messageId = await this.queueService.sendDocumentMessage(message);
      this.logger.log(`[Producer] Document reprocessing job queued: ${params.documentId}`);
      return messageId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[Producer] ❌ Failed to queue reprocessing: ${errorMessage}`);
      throw error;
    }
  }

  async sendDocumentBulkProcessingJobs(
    documents: Array<{
      documentId: string;
      workspaceId: string;
      userId: string;
      fileType: string;
      sourceType: string;
      estimatedTokens?: number;
      visionProvider?: LLMProvider;
    }>,
  ): Promise<string[]> {
    const messages: DocumentQueueMessage[] = documents.map((doc) => ({
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      documentId: doc.documentId,
      workspaceId: doc.workspaceId,
      userId: doc.userId,
      action: DocumentProcessingAction.PROCESS,
      priority: DocumentMessagePriority.NORMAL,
      metadata: {
        fileType: doc.fileType,
        sourceType: doc.sourceType as any,
        estimatedTokens: doc.estimatedTokens,
      },
      timestamp: new Date().toISOString(),
    }));

    try {
      const messageIds = await this.queueService.sendDocumentMessageBatch(messages);
      this.logger.log(`[Producer] Bulk jobs queued: ${documents.length}`);
      return messageIds;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[Producer] ❌ Failed bulk queue: ${errorMessage}`);
      throw error;
    }
  }

  async getDocumentQueueMetrics() {
    return this.queueService.getDocumentQueueMetrics();
  }
}
