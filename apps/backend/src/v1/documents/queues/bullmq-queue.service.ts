// /src/modules/v1/documents/queues/bullmq-queue.service.ts

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, Job } from 'bullmq';
import type { IDocumentQueueService } from './queue.interface';
import type { DocumentQueueMessage, DocumentQueueMetrics } from '../types';
import { DocumentMessagePriority } from '../types';

/**
 * BullMQ queue service for document processing
 */
@Injectable()
export class V1BullMQDocumentQueueService implements IDocumentQueueService, OnModuleDestroy {
  private readonly logger = new Logger(V1BullMQDocumentQueueService.name);
  private readonly queue: Queue;
  private worker?: Worker;
  private readonly queueName = 'document-processing';

  constructor(private readonly configService: ConfigService) {
    const redisHost = this.configService.get<string>('REDIS_HOST', 'localhost');
    const redisPort = this.configService.get<number>('REDIS_PORT', 6379);
    const redisPassword = this.configService.get<string>('REDIS_PASSWORD');

    this.queue = new Queue(this.queueName, {
      connection: {
        host: redisHost,
        port: redisPort,
        password: redisPassword || undefined,
      },
      defaultJobOptions: {
        attempts: 1,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 86400,
          count: 1000,
        },
        removeOnFail: {
          age: 604800,
        },
      },
    });

    this.logger.log(`BullMQ Document Queue initialized: ${redisHost}:${redisPort}`);
  }

  async sendDocumentMessage(message: DocumentQueueMessage): Promise<string> {
    try {
      // ✅ Validate priority enum before use
      if (!Object.values(DocumentMessagePriority).includes(message.priority)) {
        throw new Error(`Invalid priority: ${message.priority}`);
      }

      const priority = this.mapDocumentPriority(message.priority);

      const job = await this.queue.add('process-document', message, {
        jobId: message.messageId,
        priority,
      });

      this.logger.debug(`Document message sent to BullMQ: ${job.id}`);
      return job.id!;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to send document message to BullMQ: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  async sendDocumentMessageBatch(messages: DocumentQueueMessage[]): Promise<string[]> {
    try {
      const jobs = await this.queue.addBulk(
        messages.map((message) => {
          // ✅ Validate priority enum before use
          if (!Object.values(DocumentMessagePriority).includes(message.priority)) {
            throw new Error(`Invalid priority: ${message.priority}`);
          }

          return {
            name: 'process-document',
            data: message,
            opts: {
              jobId: message.messageId,
              priority: this.mapDocumentPriority(message.priority),
            },
          };
        }),
      );

      const jobIds = jobs.map((job) => job.id!);
      this.logger.debug(`Document batch sent to BullMQ: ${jobIds.length} messages`);
      return jobIds;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to send document batch to BullMQ: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  async startDocumentConsumer(
    handler: (message: DocumentQueueMessage) => Promise<void>,
  ): Promise<void> {
    if (this.worker) {
      this.logger.warn('Document consumer already started');
      return;
    }

    const redisHost = this.configService.get<string>('REDIS_HOST', 'localhost');
    const redisPort = this.configService.get<number>('REDIS_PORT', 6379);
    const redisPassword = this.configService.get<string>('REDIS_PASSWORD');

    this.worker = new Worker(
      this.queueName,
      async (job: Job<DocumentQueueMessage>) => {
        this.logger.debug(`Processing document job: ${job.id}`);
        await handler(job.data);
      },
      {
        connection: {
          host: redisHost,
          port: redisPort,
          password: redisPassword || undefined,
        },
        concurrency: 10,
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Document job completed: ${job.id}`);
    });

    this.worker.on('failed', (job, error) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Document job failed: ${job?.id} - ${errorMessage}`, errorStack);
    });

    this.worker.on('stalled', (jobId) => {
      this.logger.warn(`Document job stalled: ${jobId}`);
    });

    this.logger.log('BullMQ document consumer started');
  }

  async stopDocumentConsumer(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = undefined;
      this.logger.log('BullMQ document consumer stopped');
    }
  }

  async deleteDocumentMessage(messageId: string): Promise<void> {
    try {
      const job = await this.queue.getJob(messageId);
      if (job) {
        await job.remove();
        this.logger.debug(`Document message deleted from BullMQ: ${messageId}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to delete document message from BullMQ: ${errorMessage}`,
        errorStack,
      );
      throw error;
    }
  }

  async getDocumentQueueMetrics(): Promise<DocumentQueueMetrics> {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.queue.getWaitingCount(),
        this.queue.getActiveCount(),
        this.queue.getCompletedCount(),
        this.queue.getFailedCount(),
        this.queue.getDelayedCount(),
      ]);

      return {
        waiting,
        active,
        completed,
        failed,
        delayed,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to get document queue metrics: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  private mapDocumentPriority(priority: DocumentMessagePriority): number {
    switch (priority) {
      case DocumentMessagePriority.HIGH:
        return 1;
      case DocumentMessagePriority.NORMAL:
        return 5;
      case DocumentMessagePriority.LOW:
        return 10;
      default:
        return 5;
    }
  }

  async onModuleDestroy() {
    await this.stopDocumentConsumer();
    await this.queue.close();
    this.logger.log('BullMQ document queue closed');
  }
}
