/**
 * Document Queue Producer
 *
 * @description Service for sending document processing jobs to the queue.
 * Provides unified interface for both BullMQ and SQS implementations.
 *
 * @module v1/documents/queues/document-queue-producer
 */

import { Injectable, Logger } from '@nestjs/common';
import type { IDocumentQueueService } from './queue.interface';
import type { DocumentQueueMessage } from '../types';
import { DocumentProcessingAction, DocumentMessagePriority } from '../types';
import { V1DocumentQueueFactory } from './queue.factory';

/**
 * Producer service for document processing queue
 *
 * @description Sends document processing jobs to the queue.
 * Handles message creation, batching, and priority assignment.
 */
@Injectable()
export class V1DocumentQueueProducer {
  private readonly logger = new Logger(V1DocumentQueueProducer.name);
  private readonly queueService: IDocumentQueueService;

  constructor(private readonly queueFactory: V1DocumentQueueFactory) {
    this.queueService = this.queueFactory.createDocumentQueue();
  }

  /**
   * Send document processing job to queue
   *
   * @description Creates and sends a processing job for a newly uploaded document.
   * Sets priority to HIGH for immediate processing.
   *
   * @param params - Document processing parameters
   * @returns Message ID from queue
   *
   * @example
   * ```
   * const messageId = await producer.sendDocumentProcessingJob({
   *   documentId: 'doc_123',
   *   workspaceId: 'ws_456',
   *   userId: 'user_789',
   *   fileType: 'application/pdf',
   *   sourceType: DocumentSourceType.INTERNAL,
   * });
   * ```
   */
  /**
   * Send document processing job to queue
   */
  async sendDocumentProcessingJob(params: {
    documentId: string;
    workspaceId: string;
    userId: string;
    fileType: string;
    sourceType: string;
    externalUrl?: string; // ✅ ADD THIS
    estimatedTokens?: number;
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
        retryCount: 0,
      },
      timestamp: new Date().toISOString(),
    };

    try {
      const messageId = await this.queueService.sendDocumentMessage(message);
      this.logger.log(`Document processing job queued: ${params.documentId} (${messageId})`);
      return messageId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to queue document processing job: ${params.documentId} - ${errorMessage}`,
      );
      throw error;
    }
  }

  /**
   * Send document reprocessing job to queue
   *
   * @description Creates a job to regenerate embeddings for an existing document.
   * Sets priority to NORMAL as it's not time-sensitive.
   *
   * @param params - Document reprocessing parameters
   * @returns Message ID from queue
   *
   * @example
   * ```
   * const messageId = await producer.sendDocumentReprocessingJob({
   *   documentId: 'doc_123',
   *   workspaceId: 'ws_456',
   *   userId: 'user_789',
   * });
   * ```
   */
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
      this.logger.log(`Document reprocessing job queued: ${params.documentId} (${messageId})`);
      return messageId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to queue document reprocessing job: ${params.documentId} - ${errorMessage}`,
      );
      throw error;
    }
  }

  /**
   * Send bulk document processing jobs to queue
   *
   * @description Sends multiple documents for processing in batch.
   * Optimized for bulk uploads. Sets priority to NORMAL.
   *
   * @param documents - Array of documents to process
   * @returns Array of message IDs
   *
   * @example
   * ```
   * const messageIds = await producer.sendDocumentBulkProcessingJobs([
   *   { documentId: 'doc_1', workspaceId: 'ws_1', userId: 'user_1', ... },
   *   { documentId: 'doc_2', workspaceId: 'ws_1', userId: 'user_1', ... },
   * ]);
   * ```
   */
  async sendDocumentBulkProcessingJobs(
    documents: Array<{
      documentId: string;
      workspaceId: string;
      userId: string;
      fileType: string;
      sourceType: string;
      estimatedTokens?: number;
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
        retryCount: 0,
      },
      timestamp: new Date().toISOString(),
    }));

    try {
      const messageIds = await this.queueService.sendDocumentMessageBatch(messages);
      this.logger.log(`Bulk document processing jobs queued: ${documents.length} documents`);
      return messageIds;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to queue bulk document processing jobs: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Get document queue metrics
   *
   * @description Returns current queue metrics for monitoring.
   *
   * @returns Queue metrics object
   */
  async getDocumentQueueMetrics() {
    return this.queueService.getDocumentQueueMetrics();
  }
}
