import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueueAdapter } from './queue-adapter.interface';
import { RedisQueueAdapter } from './redis-queue.adapter';
import { SqsQueueAdapter } from './sqs-queue.adapter';

@Injectable()
export class QueueFactory {
  private readonly logger = new Logger(QueueFactory.name);

  constructor(private readonly config: ConfigService) {}

  createQueue(queueName: string, concurrency: number = 10): QueueAdapter {
    const backend = this.config.get('QUEUE_BACKEND', 'redis');

    this.logger.log(`🔧 Creating queue "${queueName}" with backend: ${backend}`);

    if (backend === 'sqs') {
      return new SqsQueueAdapter(this.config);
    }

    return new RedisQueueAdapter(this.config, queueName, concurrency);
  }
}
