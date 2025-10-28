/**
 * Queue Type Definitions
 *
 * @description Type definitions for document processing queue system.
 * Supports both BullMQ (Redis) and AWS SQS implementations.
 *
 * @module v1/documents/types/queue
 */

import { DocumentSourceType } from '@flopods/schema';
import { DocumentProcessingAction, DocumentMessagePriority } from './document.types';

/**
 * Document queue message structure
 *
 * @description Standard message format for all queue implementations.
 * Used by both BullMQ and SQS for document processing jobs.
 *
 * @example
 * ```
 * const message: DocumentQueueMessage = {
 *   messageId: 'msg_abc123',
 *   documentId: 'doc_xyz789',
 *   workspaceId: 'ws_def456',
 *   userId: 'user_ghi012',
 *   action: DocumentProcessingAction.PROCESS,
 *   priority: DocumentMessagePriority.HIGH,
 *   metadata: {
 *     fileType: 'application/pdf',
 *     sourceType: DocumentSourceType.INTERNAL,
 *     externalUrl: undefined,
 *     estimatedTokens: 50000,
 *     retryCount: 0,
 *   },
 *   timestamp: '2025-10-27T22:30:00.000Z',
 * };
 * ```
 */
export interface DocumentQueueMessage {
  /** Unique message identifier */
  messageId: string;

  /** Document ID from database */
  documentId: string;

  /** Workspace ID (used for FIFO grouping in SQS) */
  workspaceId: string;

  /** User ID who initiated the action */
  userId: string;

  /** Processing action to perform */
  action: DocumentProcessingAction;

  /** Message priority level */
  priority: DocumentMessagePriority;

  /** Processing metadata */
  metadata: {
    /** MIME type of the file */
    fileType: string;

    /** Document source type */
    sourceType: DocumentSourceType;

    /** External URL (for YouTube, Vimeo, Loom, web pages) */
    externalUrl?: string;

    /** Estimated token count */
    estimatedTokens?: number;

    /** Current retry attempt number (0-indexed) */
    retryCount: number;
  };

  /** ISO 8601 timestamp when message was created */
  timestamp: string;
}

/**
 * Queue metrics for monitoring
 *
 * @description Real-time metrics about queue health and performance.
 * Provides visibility into queue depth, active jobs, and failures.
 */
export interface DocumentQueueMetrics {
  /** Number of messages waiting to be processed */
  waiting: number;

  /** Number of messages currently being processed */
  active: number;

  /** Total number of successfully completed messages */
  completed?: number;

  /** Total number of failed messages */
  failed?: number;

  /** Number of delayed messages (scheduled for future) */
  delayed?: number;
}

/**
 * Document processing job data
 *
 * @description Simplified structure for sending jobs to queue producer.
 * Gets transformed into DocumentQueueMessage by the producer.
 */
export interface DocumentProcessingJobData {
  /** Document ID from database */
  documentId: string;

  /** Workspace ID */
  workspaceId: string;

  /** User ID who initiated the processing */
  userId: string;

  /** MIME type or file type */
  fileType: string;

  /** Document source type */
  sourceType: string;

  /** External URL (for YouTube, Vimeo, Loom, web pages) */
  externalUrl?: string;

  /** Estimated token count for cost calculation */
  estimatedTokens?: number;
}
