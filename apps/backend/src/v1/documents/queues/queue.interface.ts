import type { DocumentQueueMessage, DocumentQueueMetrics } from '../types';

export interface IDocumentQueueService {
  /**
   * Send a single message to queue
   */
  sendDocumentMessage(message: DocumentQueueMessage): Promise<string>;

  /**
   * Send multiple messages in batch
   */
  sendDocumentMessageBatch(messages: DocumentQueueMessage[]): Promise<string[]>;

  /**
   * Send message with delay (for backoff)
   */
  sendDocumentMessageWithDelay(message: DocumentQueueMessage, delayMs: number): Promise<string>;

  /**
   * Start consuming messages
   */
  startDocumentConsumer(handler: (message: DocumentQueueMessage) => Promise<void>): Promise<void>;

  /**
   * Stop consuming messages
   */
  stopDocumentConsumer(): Promise<void>;

  /**
   * Delete message from queue
   */
  deleteDocumentMessage(messageId: string): Promise<void>;

  /**
   * Get queue metrics
   */
  getDocumentQueueMetrics(): Promise<DocumentQueueMetrics>;
}
