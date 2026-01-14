import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SQSClient,
  SendMessageCommand,
  SendMessageBatchCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  GetQueueAttributesCommand,
  ChangeMessageVisibilityCommand,
} from '@aws-sdk/client-sqs';
import type { IDocumentQueueService } from './queue.interface';
import type { DocumentQueueMessage, DocumentQueueMetrics } from '../types';

/**
 * AWS SQS Document Queue Service
 * FIFO queue guarantees
 * Dead Letter Queue (DLQ) for failed messages
 * Message visibility timeout
 * Durable storage (AWS managed)
 * Works even if backend is down
 */
@Injectable()
export class V1SQSDocumentQueueService implements IDocumentQueueService, OnModuleDestroy {
  private readonly logger = new Logger(V1SQSDocumentQueueService.name);
  private readonly sqsClient?: SQSClient;
  private readonly queueUrl?: string;
  private readonly dlqUrl?: string;
  private isConsuming = false;
  private consumerInterval?: NodeJS.Timeout;

  constructor(private readonly configService: ConfigService) {
    const queueBackend = this.configService.get<string>('QUEUE_BACKEND', 'bullmq');

    if (queueBackend.toLowerCase() !== 'sqs') {
      this.logger.log('[SQS] Not configured (using different backend)');
      return;
    }

    const region = this.configService.get<string>('AWS_SQS_REGION', 'ap-south-1');
    const accessKeyId = this.configService.get<string>('AWS_SQS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_SQS_SECRET_ACCESS_KEY');
    this.queueUrl = this.configService.get<string>('AWS_SQS_QUEUE_URL');
    this.dlqUrl = this.configService.get<string>('AWS_SQS_DLQ_URL');

    if (!this.queueUrl) {
      this.logger.warn('[SQS] AWS_SQS_QUEUE_URL not configured');
      return;
    }

    // SQS CLIENT WITH DURABLE STORAGE
    this.sqsClient = new SQSClient({
      region,
      credentials:
        accessKeyId && secretAccessKey
          ? {
              accessKeyId,
              secretAccessKey,
            }
          : undefined,
      maxAttempts: 3, // Retry failed API calls
    });

    this.logger.log(`[SQS] 🚀 Initialized: ${this.queueUrl} (FIFO + DLQ + AWS Durability)`);
  }

  private ensureConfigured(): void {
    if (!this.sqsClient || !this.queueUrl) {
      throw new Error('SQS not configured');
    }
  }

  async sendDocumentMessage(message: DocumentQueueMessage): Promise<string> {
    this.ensureConfigured();

    try {
      const command = new SendMessageCommand({
        QueueUrl: this.queueUrl!,
        MessageBody: JSON.stringify(message),
        MessageGroupId: message.workspaceId || 'default',
        MessageDeduplicationId: `${message.documentId}-${Date.now()}`,
      });

      const response = await this.sqsClient!.send(command);
      this.logger.debug(`[SQS] 📨 Message sent: ${response.MessageId}`);
      return response.MessageId!;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[SQS] ❌ Failed to send message: ${errorMessage}`);
      throw error;
    }
  }

  async sendDocumentMessageBatch(messages: DocumentQueueMessage[]): Promise<string[]> {
    this.ensureConfigured();

    try {
      const batches = this.chunkMessages(messages, 10);
      const messageIds: string[] = [];

      for (const batch of batches) {
        const command = new SendMessageBatchCommand({
          QueueUrl: this.queueUrl!,
          Entries: batch.map((message, index) => ({
            Id: `${index}`,
            MessageBody: JSON.stringify(message),
            MessageGroupId: message.workspaceId || 'default',
            MessageDeduplicationId: `${message.documentId}-${Date.now()}-${index}`,
          })),
        });

        const response = await this.sqsClient!.send(command);

        if (response.Successful) {
          messageIds.push(...response.Successful.map((msg) => msg.MessageId!));
        }

        if (response.Failed && response.Failed.length > 0) {
          this.logger.error(`[SQS] ⚠️ Failed to send ${response.Failed.length} messages`);
        }
      }

      this.logger.debug(`[SQS] 📦 Batch sent: ${messageIds.length} messages`);
      return messageIds;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[SQS] ❌ Failed to send batch: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Send message with delay (for embeddings backoff)
   */
  async sendDocumentMessageWithDelay(
    message: DocumentQueueMessage,
    delayMs: number,
  ): Promise<string> {
    this.ensureConfigured();

    try {
      const delaySeconds = Math.ceil(delayMs / 1000);
      // SQS max delay is 900 seconds (15 minutes)
      const actualDelay = Math.min(delaySeconds, 900);

      if (delaySeconds > 900) {
        this.logger.warn(
          `[SQS] ⚠️ Delay capped at 900s (was ${delaySeconds}s) - will need manual retry`,
        );
      }

      const command = new SendMessageCommand({
        QueueUrl: this.queueUrl!,
        MessageBody: JSON.stringify(message),
        MessageGroupId: message.workspaceId || 'default',
        MessageDeduplicationId: `${message.documentId}-${Date.now()}`,
        DelaySeconds: actualDelay,
      });

      const response = await this.sqsClient!.send(command);
      this.logger.debug(`[SQS] ⏰ Delayed message sent: ${response.MessageId} (${actualDelay}s)`);
      return response.MessageId!;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[SQS] ❌ Failed to send delayed message: ${errorMessage}`);
      throw error;
    }
  }

  async startDocumentConsumer(
    handler: (message: DocumentQueueMessage) => Promise<void>,
  ): Promise<void> {
    this.ensureConfigured();

    if (this.isConsuming) {
      this.logger.warn('[SQS] Consumer already started');
      return;
    }

    this.isConsuming = true;
    this.logger.log('[SQS] 🚀 Consumer started');

    // Poll every second with long polling (20s wait)
    this.consumerInterval = setInterval(async () => {
      await this.pollMessages(handler);
    }, 1000);
  }

  async stopDocumentConsumer(): Promise<void> {
    if (this.consumerInterval) {
      clearInterval(this.consumerInterval);
      this.consumerInterval = undefined;
    }
    this.isConsuming = false;
    this.logger.log('[SQS] Consumer stopped');
  }

  private async pollMessages(
    handler: (message: DocumentQueueMessage) => Promise<void>,
  ): Promise<void> {
    if (!this.sqsClient || !this.queueUrl) {
      return;
    }

    try {
      const command = new ReceiveMessageCommand({
        QueueUrl: this.queueUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 20, // Long polling
        MessageAttributeNames: ['All'],
        VisibilityTimeout: 600, // 10 minutes visibility timeout
      });

      const response = await this.sqsClient.send(command);

      if (!response.Messages || response.Messages.length === 0) {
        return;
      }

      for (const sqsMessage of response.Messages) {
        try {
          const message: DocumentQueueMessage = JSON.parse(sqsMessage.Body!);

          await handler(message);

          // Delete after successful processing
          await this.deleteDocumentMessage(sqsMessage.ReceiptHandle!);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(`[SQS] ⚠️ Failed to process message: ${errorMessage}`);

          // Increase visibility timeout to allow retry
          try {
            const visibilityCommand = new ChangeMessageVisibilityCommand({
              QueueUrl: this.queueUrl,
              ReceiptHandle: sqsMessage.ReceiptHandle!,
              VisibilityTimeout: 60, // Retry in 1 minute
            });
            await this.sqsClient.send(visibilityCommand);
          } catch {
            this.logger.warn(`[SQS] Failed to update visibility timeout`);
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[SQS] ❌ Failed to poll messages: ${errorMessage}`);
    }
  }

  async deleteDocumentMessage(receiptHandle: string): Promise<void> {
    this.ensureConfigured();

    try {
      const command = new DeleteMessageCommand({
        QueueUrl: this.queueUrl!,
        ReceiptHandle: receiptHandle,
      });

      await this.sqsClient!.send(command);
      this.logger.debug(`[SQS] 🗑️ Message deleted`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[SQS] ❌ Delete failed: ${errorMessage}`);
    }
  }

  async getDocumentQueueMetrics(): Promise<DocumentQueueMetrics> {
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
      this.logger.error(`[SQS] ❌ Failed to get metrics: ${errorMessage}`);
      throw error;
    }
  }

  private chunkMessages(messages: DocumentQueueMessage[], size: number): DocumentQueueMessage[][] {
    const chunks: DocumentQueueMessage[][] = [];
    for (let i = 0; i < messages.length; i += size) {
      chunks.push(messages.slice(i, i + size));
    }
    return chunks;
  }

  async onModuleDestroy() {
    await this.stopDocumentConsumer();
    if (this.sqsClient) {
      this.sqsClient.destroy();
      this.logger.log('[SQS] Queue closed gracefully');
    }
  }
}
