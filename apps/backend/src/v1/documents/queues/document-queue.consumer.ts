/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * DOCUMENT QUEUE CONSUMER - PRODUCTION GRADE
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * @file document-queue-consumer.ts
 * @module v1/documents/queues
 *
 * @description
 * Production-ready background worker service for consuming and processing document
 * queue messages from BullMQ (Redis) or AWS SQS. Automatically starts on module
 * initialization and gracefully shuts down on application termination.
 *
 */

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import type { IDocumentQueueService } from './queue.interface';
import type { DocumentQueueMessage } from '../types';
import { V1DocumentQueueFactory } from './queue.factory';
import { V1DocumentOrchestratorService } from '../services/document-orchestrator.service';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * DOCUMENT QUEUE CONSUMER SERVICE
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * @description
 * Background worker service that consumes document processing jobs from queue.
 * Implements NestJS lifecycle hooks for automatic startup and shutdown.
 */
@Injectable()
export class V1DocumentQueueConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(V1DocumentQueueConsumer.name);
  private readonly queueService: IDocumentQueueService;

  constructor(
    private readonly queueFactory: V1DocumentQueueFactory,
    private readonly orchestratorService: V1DocumentOrchestratorService,
  ) {
    this.queueService = this.queueFactory.createDocumentQueue();
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * ON MODULE INIT - START CONSUMER
   * ═══════════════════════════════════════════════════════════════════════════════
   *
   * @description
   * Lifecycle hook called when NestJS module initializes. Automatically starts
   * the queue consumer and begins processing messages.
   *
   */
  async onModuleInit() {
    this.logger.log('🚀 Starting document queue consumer...');

    try {
      await this.queueService.startDocumentConsumer(this.handleDocumentMessage.bind(this));
      this.logger.log('✅ Document queue consumer started successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Failed to start document queue consumer: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * ON MODULE DESTROY - STOP CONSUMER
   * ═══════════════════════════════════════════════════════════════════════════════
   *
   * @description
   * Lifecycle hook called when NestJS application is shutting down. Gracefully
   * stops the queue consumer and ensures all in-flight messages are completed.
   *
   * **Shutdown Process:**
   * 1. Stop accepting new messages
   * 2. Wait for in-flight messages to complete (timeout: 30s)
   * 3. Disconnect from queue backend
   * 4. Release resources and cleanup
   *
   * **Graceful Shutdown:**
   * - In-flight jobs complete before shutdown
   * - Unprocessed messages remain in queue for restart
   * - No data loss or corruption
   *
   * @example
   * ```
   * // Called automatically on app shutdown:
   * // 1. SIGTERM/SIGINT signal received
   * // 2. onModuleDestroy() called
   * // 3. Consumer gracefully stops
   * ```
   */
  async onModuleDestroy() {
    this.logger.log('Stopping document queue consumer...');

    try {
      await this.queueService.stopDocumentConsumer();
      this.logger.log('✅ Document queue consumer stopped gracefully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`⚠️  Error during consumer shutdown: ${errorMessage}`);
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * HANDLE DOCUMENT MESSAGE
   * ═══════════════════════════════════════════════════════════════════════════════
   *
   * @description
   * Core message processing handler. Called automatically by queue service for
   * each message received. Delegates to OrchestratorService for actual document
   * processing (text extraction + embedding generation).
   *
   * @param {DocumentQueueMessage} message - Queue message with document details
   * @param {string} message.messageId - Unique message identifier
   * @param {string} message.documentId - Document UUID to process
   * @param {string} message.workspaceId - Workspace UUID
   * @param {string} message.userId - User who initiated processing
   * @param {DocumentProcessingAction} message.action - PROCESS or REPROCESS
   * @param {DocumentMessagePriority} message.priority - HIGH, NORMAL, or LOW
   * @param {object} message.metadata - Additional metadata (file type, tokens, etc.)
   *
   * @returns {Promise<void>} Resolves when processing complete
   * @throws {Error} Any error from orchestrator (triggers queue retry)
   *
   * @private
   *
   * @example
   * ```
   * // Called automatically by queue - example message:
   * {
   *   messageId: 'msg_1761760442530_abc123',
   *   documentId: 'cmhca20ol000bkjf0y7lpejdd',
   *   workspaceId: 'cmhca1tdf0000kjf0qukf8w71',
   *   userId: 'user_123',
   *   action: 'PROCESS',
   *   priority: 'HIGH',
   *   metadata: {
   *     fileType: 'application/pdf',
   *     sourceType: 'INTERNAL',
   *     retryCount: 0
   *   },
   *   timestamp: '2025-10-29T18:00:00.000Z'
   * }
   * ```
   */
  private async handleDocumentMessage(message: DocumentQueueMessage): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.log(
        `[Consumer] 📨 Processing: ${message.documentId} (action: ${message.action})`,
      );

      // ✅ DELEGATE TO ORCHESTRATOR FOR ACTUAL PROCESSING
      await this.orchestratorService.processDocument(message);

      const duration = Date.now() - startTime;
      this.logger.log(`[Consumer] ✅ Success: ${message.documentId} (${duration}ms)`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      const duration = Date.now() - startTime;

      this.logger.error(
        `[Consumer] ❌ Failed: ${message.documentId} (${duration}ms) - ${errorMessage}`,
        errorStack,
      );

      // Re-throw error for queue retry logic
      // Queue will:
      // 1. Retry with exponential backoff (2s, 4s, 8s)
      // 2. After 3 failures → Dead letter queue
      // 3. Document status set to ERROR by orchestrator
      throw error;
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * GET QUEUE METRICS
   * ═══════════════════════════════════════════════════════════════════════════════
   *
   * @description
   * Retrieves current queue metrics for monitoring and health checks. Returns
   * real-time statistics about queue depth, processing rates, and job status.
   *
   * @returns {Promise<DocumentQueueMetrics>} Queue metrics object
   *
   * @example
   */
  async getDocumentQueueMetrics() {
    return this.queueService.getDocumentQueueMetrics();
  }
}
