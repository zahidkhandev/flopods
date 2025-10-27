import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, Job } from 'bullmq';
import { QueueAdapter, QueueJobStatus } from './queue-adapter.interface';

@Injectable()
export class RedisQueueAdapter implements QueueAdapter {
  private readonly logger = new Logger(RedisQueueAdapter.name);
  private queue: Queue;
  private worker!: Worker;

  constructor(
    private readonly config: ConfigService,
    queueName: string,
    private readonly concurrency: number = 10,
  ) {
    const redisConfig = {
      host: this.config.get('REDIS_HOST', 'localhost'),
      port: this.config.get('REDIS_PORT', 6379),
      password: this.config.get('REDIS_PASSWORD'),
      tls: this.config.get('REDIS_TLS_ENABLED') === 'true' ? {} : undefined,
    };

    this.queue = new Queue(queueName, {
      connection: redisConfig,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 3600,
          count: 1000,
        },
        removeOnFail: {
          age: 86400,
        },
      },
    });

    this.logger.log(`✅ Redis queue initialized: ${queueName}`);
  }

  async add(jobName: string, data: any, options?: any): Promise<string> {
    const job = await this.queue.add(jobName, data, options);
    return job.id || `${Date.now()}`;
  }

  process(handler: (job: any) => Promise<any>): void {
    this.worker = new Worker(this.queue.name, async (job: Job) => handler(job), {
      connection: this.queue.opts.connection as any,
      concurrency: this.concurrency,
    });

    this.setupEventHandlers();
  }

  async getMetrics() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
  }

  async cancel(jobId: string): Promise<boolean> {
    const job = await this.queue.getJob(jobId);
    if (job) {
      await job.remove();
      return true;
    }
    return false;
  }

  async getJobStatus(jobId: string): Promise<QueueJobStatus | null> {
    const job = await this.queue.getJob(jobId);
    if (!job) return null;

    return {
      id: job.id,
      state: await job.getState(),
      progress: job.progress,
      attemptsMade: job.attemptsMade,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    };
  }

  private setupEventHandlers() {
    this.worker.on('completed', (job: Job) => {
      this.logger.log(`✅ Job ${job.id} completed`);
    });

    this.worker.on('failed', (job: Job | undefined, err: Error) => {
      this.logger.error(`❌ Job ${job?.id} failed:`, err.message);
    });

    this.worker.on('stalled', (jobId: string) => {
      this.logger.warn(`⚠️ Job ${jobId} stalled`);
    });
  }

  async close(): Promise<void> {
    await this.queue.close();
    if (this.worker) await this.worker.close();
  }
}
