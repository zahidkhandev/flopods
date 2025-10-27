import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  GetQueueAttributesCommand,
  Message,
} from '@aws-sdk/client-sqs';
import { QueueAdapter, QueueJobStatus } from './queue-adapter.interface';

@Injectable()
export class SqsQueueAdapter implements QueueAdapter {
  private readonly logger = new Logger(SqsQueueAdapter.name);
  private sqs: SQSClient;
  private queueUrl: string;
  private isProcessing = false;
  private processingHandler: ((job: any) => Promise<any>) | null = null;

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
    this.logger.log(`✅ SQS queue initialized: ${this.queueUrl}`);
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
    this.processingHandler = handler;
    this.startPolling();
  }

  private async startPolling() {
    this.isProcessing = true;

    while (this.isProcessing) {
      try {
        const command = new ReceiveMessageCommand({
          QueueUrl: this.queueUrl,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 20,
          MessageAttributeNames: ['All'],
        });

        const result = await this.sqs.send(command);

        if (result.Messages && result.Messages.length > 0) {
          await Promise.all(
            result.Messages.map(async (message: Message) => {
              try {
                const body = JSON.parse(message.Body!);
                const job = {
                  id: message.MessageAttributes?.jobId?.StringValue || message.MessageId,
                  data: body.data,
                  attemptsMade: 0,
                };

                await this.processingHandler!(job);

                const deleteCommand = new DeleteMessageCommand({
                  QueueUrl: this.queueUrl,
                  ReceiptHandle: message.ReceiptHandle!,
                });
                await this.sqs.send(deleteCommand);

                this.logger.log(`✅ Job ${job.id} completed`);
              } catch (error) {
                this.logger.error(
                  `❌ Job processing failed:`,
                  error instanceof Error ? error.message : 'Unknown error',
                );
              }
            }),
          );
        }
      } catch (error) {
        this.logger.error('SQS polling error:', error);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
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
    this.isProcessing = false;
  }
}
