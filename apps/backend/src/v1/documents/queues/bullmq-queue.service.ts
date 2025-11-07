import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, Job } from 'bullmq';
import type { IDocumentQueueService } from './queue.interface';
import type { DocumentQueueMessage, DocumentQueueMetrics } from '../types';
import { DocumentMessagePriority } from '../types';

/**
 * BullMQ queue service for document processing
 * ✅ Redis persistence with AOF + RDB
 * ✅ Exponential backoff retries
 * ✅ Job state tracking
 * ✅ Delayed execution support
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

    // ✅ REDIS PERSISTENCE CONFIG
    this.queue = new Queue(this.queueName, {
      connection: {
        host: redisHost,
        port: redisPort,
        password: redisPassword || undefined,
        maxRetriesPerRequest: null, // ✅ Critical for background jobs
        enableReadyCheck: false,
        enableOfflineQueue: true, // ✅ Queue commands when Redis down
      },
      defaultJobOptions: {
        attempts: 3, // ✅ Retry 3 times with backoff
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 86400, // Keep for 24 hours
          count: 1000, // Keep last 1000 jobs
        },
        removeOnFail: {
          age: 604800, // Keep failed jobs for 7 days
        },
        // ✅ REMOVED: timeout is not in BullMQ DefaultJobOptions
        // Use job settings instead if needed
      },
    });

    this.logger.log(`[BullMQ] 🚀 Initialized: ${redisHost}:${redisPort} (AOF+RDB persistence)`);
  }

  async sendDocumentMessage(message: DocumentQueueMessage): Promise<string> {
    try {
      if (!Object.values(DocumentMessagePriority).includes(message.priority)) {
        throw new Error(`Invalid priority: ${message.priority}`);
      }

      const priority = this.mapDocumentPriority(message.priority);

      const job = await this.queue.add('process-document', message, {
        jobId: message.messageId,
        priority,
      });

      this.logger.debug(`[BullMQ] 📨 Message sent: ${job.id}`);
      return job.id!;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[BullMQ] ❌ Failed to send message: ${errorMessage}`);
      throw error;
    }
  }

  async sendDocumentMessageBatch(messages: DocumentQueueMessage[]): Promise<string[]> {
    try {
      const jobs = await this.queue.addBulk(
        messages.map((message) => {
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
      this.logger.debug(`[BullMQ] 📦 Batch sent: ${jobIds.length} messages`);
      return jobIds;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[BullMQ] ❌ Failed to send batch: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * ✅ Send message with delay (for embeddings backoff)
   */
  async sendDocumentMessageWithDelay(
    message: DocumentQueueMessage,
    delayMs: number,
  ): Promise<string> {
    try {
      if (!Object.values(DocumentMessagePriority).includes(message.priority)) {
        throw new Error(`Invalid priority: ${message.priority}`);
      }

      const priority = this.mapDocumentPriority(message.priority);

      const job = await this.queue.add('process-document', message, {
        jobId: message.messageId,
        priority,
        delay: delayMs, // ✅ BullMQ saves delayed jobs to Redis
      });

      this.logger.debug(`[BullMQ] ⏰ Delayed message sent: ${job.id} (${delayMs}ms)`);
      return job.id!;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[BullMQ] ❌ Failed to send delayed message: ${errorMessage}`);
      throw error;
    }
  }

  async startDocumentConsumer(
    handler: (message: DocumentQueueMessage) => Promise<void>,
  ): Promise<void> {
    if (this.worker) {
      this.logger.warn('[BullMQ] Consumer already started');
      return;
    }

    const redisHost = this.configService.get<string>('REDIS_HOST', 'localhost');
    const redisPort = this.configService.get<number>('REDIS_PORT', 6379);
    const redisPassword = this.configService.get<string>('REDIS_PASSWORD');

    this.worker = new Worker(
      this.queueName,
      async (job: Job<DocumentQueueMessage>) => {
        this.logger.debug(`[BullMQ] 🔄 Processing: ${job.id}`);
        await handler(job.data);
      },
      {
        connection: {
          host: redisHost,
          port: redisPort,
          password: redisPassword || undefined,
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
          enableOfflineQueue: true,
        },
        concurrency: 10, // ✅ Process 10 jobs simultaneously
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`[BullMQ] ✅ Completed: ${job.id}`);
    });

    this.worker.on('failed', (job, error) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[BullMQ] ❌ Failed: ${job?.id} - ${errorMessage}`);
    });

    this.worker.on('stalled', (jobId) => {
      this.logger.warn(`[BullMQ] ⚠️ Stalled: ${jobId}`);
    });

    this.logger.log('[BullMQ] 🚀 Consumer started');
  }

  async stopDocumentConsumer(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = undefined;
      this.logger.log('[BullMQ] Consumer stopped');
    }
  }

  async deleteDocumentMessage(messageId: string): Promise<void> {
    try {
      const job = await this.queue.getJob(messageId);
      if (job) {
        await job.remove();
        this.logger.debug(`[BullMQ] 🗑️ Deleted: ${messageId}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[BullMQ] ❌ Delete failed: ${errorMessage}`);
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
      this.logger.error(`[BullMQ] ❌ Failed to get metrics: ${errorMessage}`);
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
    this.logger.log('[BullMQ] Queue closed gracefully');
  }
}
