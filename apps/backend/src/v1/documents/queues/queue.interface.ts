/**
 * Document Queue Service Interface
 *
 * @description Abstract interface for document processing queue.
 * Supports both BullMQ (Redis) and AWS SQS implementations.
 *
 * @module v1/documents/queues/queue-interface
 */

import type { DocumentQueueMessage, DocumentQueueMetrics } from '../types';

/**
 * Document queue service interface
 *
 * @description Defines the contract for queue implementations.
 * Both BullMQ and SQS services must implement this interface.
 */
export interface IDocumentQueueService {
  /**
   * Send a single message to the document processing queue
   *
   * @param message - Document queue message
   * @returns Message ID
   */
  sendDocumentMessage(message: DocumentQueueMessage): Promise<string>;

  /**
   * Send multiple messages to the document processing queue in batch
   *
   * @param messages - Array of document queue messages
   * @returns Array of message IDs
   */
  sendDocumentMessageBatch(messages: DocumentQueueMessage[]): Promise<string[]>;

  /**
   * Start consuming messages from the document processing queue
   *
   * @param handler - Function to handle each message
   */
  startDocumentConsumer(handler: (message: DocumentQueueMessage) => Promise<void>): Promise<void>;

  /**
   * Stop consuming messages from the document processing queue
   */
  stopDocumentConsumer(): Promise<void>;

  /**
   * Delete a message from the document processing queue (ACK)
   *
   * @param messageId - Message ID to delete
   */
  deleteDocumentMessage(messageId: string): Promise<void>;

  /**
   * Get queue metrics for monitoring
   *
   * @returns Queue metrics object
   */
  getDocumentQueueMetrics(): Promise<DocumentQueueMetrics>;
}
