import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SQSClient,
  SendMessageCommand,
  GetQueueAttributesCommand,
  Message,
} from '@aws-sdk/client-sqs';
import { Consumer } from 'sqs-consumer';
import { QueueAdapter, QueueJobStatus } from './queue-adapter.interface';

@Injectable()
export class SqsQueueAdapter implements QueueAdapter {
  private readonly logger = new Logger(SqsQueueAdapter.name);
  private sqs: SQSClient;
  private queueUrl: string;
  private consumer: Consumer | null = null;

  constructor(private readonly config: ConfigService) {
    const region = this.config.get('AWS_SQS_REGION') || this.config.get('AWS_REGION');

    this.sqs = new SQSClient({
      region,
      credentials: {
        accessKeyId: this.config.get('AWS_SQS_ACCESS_KEY_ID')!,
        secretAccessKey: this.config.get('AWS_SQS_SECRET_ACCESS_KEY')!,
      },
    });

    this.queueUrl = this.config.get('AWS_SQS_QUEUE_URL')!;
    this.logger.log(`SQS queue initialized: ${this.queueUrl}`);
  }

  async add(jobName: string, data: any, options?: any): Promise<string> {
    const jobId = options?.jobId || Date.now().toString();

    const command = new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: JSON.stringify({ jobName, data, options }),
      MessageAttributes: {
        jobName: { DataType: 'String', StringValue: jobName },
        jobId: { DataType: 'String', StringValue: jobId },
      },
    });

    const result = await this.sqs.send(command);
    return result.MessageId || jobId;
  }

  process(handler: (job: any) => Promise<any>): void {
    if (this.consumer) {
      this.consumer.stop();
    }

    this.consumer = Consumer.create({
      queueUrl: this.queueUrl,
      sqs: this.sqs,
      batchSize: 10,
      handleMessage: async (message: Message) => {
        try {
          if (!message.Body) {
            // Return undefined or message to satisfy the type signature
            return message;
          }

          const body = JSON.parse(message.Body);
          const job = {
            id: message.MessageAttributes?.jobId?.StringValue || message.MessageId,
            data: body.data,
            attemptsMade: 0,
          };

          await handler(job);

          this.logger.log(`Job ${job.id} completed`);

          // FIX: Explicitly return the message to satisfy TypeScript
          return message;
        } catch (error) {
          this.logger.error(
            `❌ Job processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
          throw error;
        }
      },
    });

    this.consumer.on('error', (err) => {
      this.logger.error(`[SQS Error] ${err.message}`);
    });

    this.consumer.on('processing_error', (err) => {
      this.logger.error(`[SQS Processing Error] ${err.message}`);
    });

    this.consumer.on('timeout_error', (err) => {
      this.logger.error(`[SQS Timeout Error] ${err.message}`);
    });

    this.consumer.start();
    this.logger.log('🚀 SQS Consumer started polling');
  }

  async getMetrics() {
    const command = new GetQueueAttributesCommand({
      QueueUrl: this.queueUrl,
      AttributeNames: [
        'ApproximateNumberOfMessages',
        'ApproximateNumberOfMessagesNotVisible',
        'ApproximateNumberOfMessagesDelayed',
      ],
    });

    const result = await this.sqs.send(command);

    return {
      waiting: parseInt(result.Attributes?.ApproximateNumberOfMessages || '0'),
      active: parseInt(result.Attributes?.ApproximateNumberOfMessagesNotVisible || '0'),
      completed: 0,
      failed: 0,
    };
  }

  async cancel(_jobId: string): Promise<boolean> {
    this.logger.warn('SQS does not support job cancellation by ID');
    return false;
  }

  async getJobStatus(_jobId: string): Promise<QueueJobStatus | null> {
    return null;
  }

  async close(): Promise<void> {
    if (this.consumer) {
      this.consumer.stop();
    }
  }
}
