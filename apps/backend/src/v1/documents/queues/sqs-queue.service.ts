/**
 * SQS Document Queue Service
 *
 * @description AWS SQS implementation of document queue service.
 * Used for production with FIFO queue. Gracefully handles missing configuration
 * in development environments (when QUEUE_BACKEND=redis).
 *
 * @module v1/documents/queues/sqs-queue-service
 */

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SQSClient,
  SendMessageCommand,
  SendMessageBatchCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  GetQueueAttributesCommand,
} from '@aws-sdk/client-sqs';
import type { IDocumentQueueService } from './queue.interface';
import type { DocumentQueueMessage, DocumentQueueMetrics } from '../types';

/**
 * SQS queue service for document processing
 *
 * @description Production queue service using AWS SQS FIFO.
 * Only initializes if QUEUE_BACKEND=sqs and required env vars are set.
 */
@Injectable()
export class V1SQSDocumentQueueService implements IDocumentQueueService, OnModuleDestroy {
  private readonly logger = new Logger(V1SQSDocumentQueueService.name);
  private readonly sqsClient?: SQSClient;
  private readonly queueUrl?: string;
  private isConsuming = false;
  private consumerInterval?: NodeJS.Timeout;

  constructor(private readonly configService: ConfigService) {
    // Check if SQS should be initialized
    const queueBackend = this.configService.get<string>('QUEUE_BACKEND', 'redis');

    if (queueBackend.toLowerCase() !== 'sqs') {
      this.logger.log('SQS not configured (using different queue backend)');
      return;
    }

    // Get configuration
    const region = this.configService.get<string>('AWS_SQS_REGION', 'ap-south-1');
    const accessKeyId = this.configService.get<string>('AWS_SQS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_SQS_SECRET_ACCESS_KEY');
    this.queueUrl = this.configService.get<string>('AWS_SQS_QUEUE_URL');

    // Validate required configuration
    if (!this.queueUrl) {
      this.logger.warn(
        'AWS_SQS_QUEUE_URL not configured. SQS will not be available. ' +
          'Set QUEUE_BACKEND=redis to use BullMQ instead.',
      );
      return;
    }

    // Initialize SQS client
    this.sqsClient = new SQSClient({
      region,
      credentials:
        accessKeyId && secretAccessKey
          ? {
              accessKeyId,
              secretAccessKey,
            }
          : undefined,
    });

    this.logger.log(`✅ SQS Document Queue initialized: ${this.queueUrl}`);
  }

  /**
   * Check if SQS is configured
   *
   * @private
   */
  private ensureConfigured(): void {
    if (!this.sqsClient || !this.queueUrl) {
      throw new Error(
        'SQS not configured. Set QUEUE_BACKEND=sqs and AWS_SQS_QUEUE_URL in environment variables.',
      );
    }
  }

  /**
   * Send document message to SQS
   */
  async sendDocumentMessage(message: DocumentQueueMessage): Promise<string> {
    this.ensureConfigured();

    try {
      const command = new SendMessageCommand({
        QueueUrl: this.queueUrl!,
        MessageBody: JSON.stringify(message),
        MessageGroupId: message.workspaceId,
        MessageDeduplicationId: message.documentId,
        MessageAttributes: {
          priority: {
            DataType: 'String',
            StringValue: message.priority,
          },
          action: {
            DataType: 'String',
            StringValue: message.action,
          },
        },
      });

      const response = await this.sqsClient!.send(command);
      this.logger.debug(`Document message sent to SQS: ${response.MessageId}`);
      return response.MessageId!;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to send document message to SQS: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Send batch of document messages to SQS
   */
  async sendDocumentMessageBatch(messages: DocumentQueueMessage[]): Promise<string[]> {
    this.ensureConfigured();

    try {
      const batches = this.chunkDocumentMessages(messages, 10);
      const messageIds: string[] = [];

      for (const batch of batches) {
        const command = new SendMessageBatchCommand({
          QueueUrl: this.queueUrl!,
          Entries: batch.map((message, index) => ({
            Id: `${index}`,
            MessageBody: JSON.stringify(message),
            MessageGroupId: message.workspaceId,
            MessageDeduplicationId: message.documentId,
            MessageAttributes: {
              priority: {
                DataType: 'String',
                StringValue: message.priority,
              },
              action: {
                DataType: 'String',
                StringValue: message.action,
              },
            },
          })),
        });

        const response = await this.sqsClient!.send(command);

        if (response.Successful) {
          messageIds.push(...response.Successful.map((msg) => msg.MessageId!));
        }

        if (response.Failed && response.Failed.length > 0) {
          this.logger.error(`Failed to send ${response.Failed.length} document messages to SQS`);
        }
      }

      this.logger.debug(`Document batch sent to SQS: ${messageIds.length} messages`);
      return messageIds;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to send document batch to SQS: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Start SQS consumer
   */
  async startDocumentConsumer(
    handler: (message: DocumentQueueMessage) => Promise<void>,
  ): Promise<void> {
    this.ensureConfigured();

    if (this.isConsuming) {
      this.logger.warn('Document consumer already started');
      return;
    }

    this.isConsuming = true;
    this.logger.log('SQS document consumer started');

    this.consumerInterval = setInterval(async () => {
      await this.pollDocumentMessages(handler);
    }, 1000);
  }

  /**
   * Stop SQS consumer
   */
  async stopDocumentConsumer(): Promise<void> {
    if (this.consumerInterval) {
      clearInterval(this.consumerInterval);
      this.consumerInterval = undefined;
    }
    this.isConsuming = false;
    this.logger.log('SQS document consumer stopped');
  }

  /**
   * Delete message from SQS queue
   */
  async deleteDocumentMessage(receiptHandle: string): Promise<void> {
    this.ensureConfigured();

    try {
      const command = new DeleteMessageCommand({
        QueueUrl: this.queueUrl!,
        ReceiptHandle: receiptHandle,
      });

      await this.sqsClient!.send(command);
      this.logger.debug(`Document message deleted from SQS`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to delete document message from SQS: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Get SQS queue metrics
   */
  async getDocumentQueueMetrics(): Promise<DocumentQueueMetrics> {
    // Return empty metrics if not configured
    if (!this.sqsClient || !this.queueUrl) {
      return {
        waiting: 0,
        active: 0,
        delayed: 0,
      };
    }

    try {
      const command = new GetQueueAttributesCommand({
        QueueUrl: this.queueUrl,
        AttributeNames: [
          'ApproximateNumberOfMessages',
          'ApproximateNumberOfMessagesNotVisible',
          'ApproximateNumberOfMessagesDelayed',
        ],
      });

      const response = await this.sqsClient.send(command);

      return {
        waiting: parseInt(response.Attributes?.ApproximateNumberOfMessages || '0', 10),
        active: parseInt(response.Attributes?.ApproximateNumberOfMessagesNotVisible || '0', 10),
        delayed: parseInt(response.Attributes?.ApproximateNumberOfMessagesDelayed || '0', 10),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to get document queue metrics: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Poll messages from SQS queue
   *
   * @private
   */
  private async pollDocumentMessages(
    handler: (message: DocumentQueueMessage) => Promise<void>,
  ): Promise<void> {
    if (!this.sqsClient || !this.queueUrl) {
      return;
    }

    try {
      const command = new ReceiveMessageCommand({
        QueueUrl: this.queueUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 20,
        MessageAttributeNames: ['All'],
      });

      const response = await this.sqsClient.send(command);

      if (!response.Messages || response.Messages.length === 0) {
        return;
      }

      for (const sqsMessage of response.Messages) {
        try {
          const message: DocumentQueueMessage = JSON.parse(sqsMessage.Body!);
          await handler(message);
          await this.deleteDocumentMessage(sqsMessage.ReceiptHandle!);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const errorStack = error instanceof Error ? error.stack : undefined;
          this.logger.error(`Failed to process document message: ${errorMessage}`, errorStack);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to poll document messages: ${errorMessage}`, errorStack);
    }
  }

  /**
   * Chunk messages for batch operations
   *
   * @private
   */
  private chunkDocumentMessages(
    messages: DocumentQueueMessage[],
    size: number,
  ): DocumentQueueMessage[][] {
    const chunks: DocumentQueueMessage[][] = [];
    for (let i = 0; i < messages.length; i += size) {
      chunks.push(messages.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy() {
    await this.stopDocumentConsumer();
    if (this.sqsClient) {
      this.sqsClient.destroy();
      this.logger.log('SQS document queue closed');
    }
  }
}
