/**
 * Document Queue Consumer
 *
 * @description Service for consuming and processing document queue messages.
 * Coordinates with orchestrator service to process documents.
 *
 * @module v1/documents/queues/document-queue-consumer
 */

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import type { IDocumentQueueService } from './queue.interface';
import type { DocumentQueueMessage } from '../types';
import { V1DocumentQueueFactory } from './queue.factory';

/**
 * Consumer service for document processing queue
 *
 * @description Consumes messages from the queue and triggers document processing.
 * Starts automatically when the module initializes.
 */
@Injectable()
export class DocumentQueueConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DocumentQueueConsumer.name);
  private readonly queueService: IDocumentQueueService;

  constructor(private readonly queueFactory: V1DocumentQueueFactory) {
    this.queueService = this.queueFactory.createDocumentQueue();
  }

  /**
   * Start document queue consumer on module initialization
   *
   * @description Automatically starts consuming messages when the module loads.
   * Registers the message handler with the queue service.
   */
  async onModuleInit() {
    this.logger.log('Starting document queue consumer...');
    await this.queueService.startDocumentConsumer(this.handleDocumentMessage.bind(this));
    this.logger.log('Document queue consumer started successfully');
  }

  /**
   * Stop document queue consumer on module destruction
   *
   * @description Gracefully stops the consumer when the application shuts down.
   */
  async onModuleDestroy() {
    this.logger.log('Stopping document queue consumer...');
    await this.queueService.stopDocumentConsumer();
    this.logger.log('Document queue consumer stopped');
  }

  /**
   * Handle incoming document queue message
   *
   * @description Processes a single document message from the queue.
   * Updates document status, calls orchestrator, and handles errors.
   *
   * @param message - Document queue message
   *
   * @example
   * ```
   * // This is called automatically by the queue service
   * await consumer.handleDocumentMessage({
   *   messageId: 'msg_123',
   *   documentId: 'doc_456',
   *   action: 'PROCESS',
   *   ...
   * });
   * ```
   */
  private async handleDocumentMessage(message: DocumentQueueMessage): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.log(
        `Processing document message: ${message.documentId} (action: ${message.action})`,
      );

      // TODO: Implement document processing orchestration
      // This will be connected to OrchestratorService in Phase 4
      // For now, just log the message
      this.logger.debug(`Document message received: ${JSON.stringify(message)}`);

      // Placeholder for actual processing
      // await this.orchestratorService.processDocument(message);

      const processingTime = Date.now() - startTime;
      this.logger.log(
        `Document processed successfully: ${message.documentId} (${processingTime}ms)`,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      const processingTime = Date.now() - startTime;

      this.logger.error(
        `Failed to process document: ${message.documentId} (${processingTime}ms) - ${errorMessage}`,
        errorStack,
      );

      // Re-throw to let queue handle retry logic
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
