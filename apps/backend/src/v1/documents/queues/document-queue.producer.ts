// /src/modules/v1/documents/queues/document-queue.producer.ts

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
    visionProvider?: LLMProvider; // ✅ Changed from VisionProvider
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
        externalUrl: params.externalUrl,
        estimatedTokens: params.estimatedTokens,
        visionProvider: params.visionProvider || LLMProvider.GOOGLE_GEMINI, // ✅ Default to LLMProvider
        retryCount: 0,
      },
      timestamp: new Date().toISOString(),
    };

    try {
      const messageId = await this.queueService.sendDocumentMessage(message);
      this.logger.log(`Document processing job queued: ${params.documentId}`);
      return messageId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to queue: ${params.documentId} - ${errorMessage}`);
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
        retryCount: 0,
      },
      timestamp: new Date().toISOString(),
    };

    try {
      const messageId = await this.queueService.sendDocumentMessage(message);
      this.logger.log(`Document reprocessing job queued: ${params.documentId}`);
      return messageId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to queue reprocessing: ${params.documentId}`);
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
      visionProvider?: LLMProvider; // ✅ Changed from VisionProvider
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
        visionProvider: doc.visionProvider || LLMProvider.GOOGLE_GEMINI, // ✅ Default to LLMProvider
        retryCount: 0,
      },
      timestamp: new Date().toISOString(),
    }));

    try {
      const messageIds = await this.queueService.sendDocumentMessageBatch(messages);
      this.logger.log(`Bulk jobs queued: ${documents.length} documents`);
      return messageIds;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed bulk queue: ${errorMessage}`);
      throw error;
    }
  }

  async getDocumentQueueMetrics() {
    return this.queueService.getDocumentQueueMetrics();
  }
}
