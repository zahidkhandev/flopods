import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SNSClient,
  PublishCommand,
  CreateTopicCommand,
  SubscribeCommand,
  UnsubscribeCommand,
  ListTopicsCommand,
  SetTopicAttributesCommand,
} from '@aws-sdk/client-sns';

export interface PublishOptions {
  topicArn: string;
  message: string;
  subject?: string;
  messageAttributes?: Record<string, any>;
}

export interface SubscriptionOptions {
  topicArn: string;
  protocol: 'email' | 'sms' | 'http' | 'https' | 'sqs' | 'lambda';
  endpoint: string;
}

@Injectable()
export class SnsService {
  private readonly logger = new Logger(SnsService.name);
  private readonly snsClient: SNSClient | null = null;
  private readonly isEnabled: boolean;
  private readonly region: string;

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION') || 'us-east-1';
    const accessKeyId = this.configService.get<string>('AWS_SNS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_SNS_SECRET_ACCESS_KEY');

    this.isEnabled = !!(this.region && accessKeyId && secretAccessKey);

    if (this.isEnabled && accessKeyId && secretAccessKey) {
      this.snsClient = new SNSClient({
        region: this.region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
        maxAttempts: 3,
      });
      this.logger.log('AWS SNS initialized successfully');
    } else {
      this.logger.warn('⚠️  AWS SNS not configured');
    }
  }

  /**
   * Publish message to SNS topic
   */
  async publishMessage(options: PublishOptions): Promise<string> {
    if (!this.isEnabled || !this.snsClient) {
      this.logger.log(`[SNS LOG] Topic: ${options.topicArn}, Message: ${options.message}`);
      return `dev-mode-${Date.now()}`;
    }

    try {
      const command = new PublishCommand({
        TopicArn: options.topicArn,
        Message: options.message,
        Subject: options.subject,
        MessageAttributes: options.messageAttributes,
      });

      const response = await this.snsClient.send(command);
      this.logger.log(`📢 SNS message published: ${response.MessageId}`);
      return response.MessageId || '';
    } catch (error: any) {
      this.logger.error('❌ SNS publish error:', error);
      throw new InternalServerErrorException(`Failed to publish SNS message: ${error.message}`);
    }
  }

  /**
   * Create SNS topic
   */
  async createTopic(name: string): Promise<string> {
    if (!this.isEnabled || !this.snsClient) {
      throw new InternalServerErrorException('SNS not configured');
    }

    try {
      const command = new CreateTopicCommand({ Name: name });
      const response = await this.snsClient.send(command);
      this.logger.log(`SNS topic created: ${name}`);
      return response.TopicArn || '';
    } catch (error: any) {
      this.logger.error('❌ SNS create topic error:', error);
      throw new InternalServerErrorException(`Failed to create SNS topic: ${error.message}`);
    }
  }

  /**
   * Subscribe to SNS topic
   */
  async subscribe(options: SubscriptionOptions): Promise<string> {
    if (!this.isEnabled || !this.snsClient) {
      throw new InternalServerErrorException('SNS not configured');
    }

    try {
      const command = new SubscribeCommand({
        TopicArn: options.topicArn,
        Protocol: options.protocol,
        Endpoint: options.endpoint,
      });

      const response = await this.snsClient.send(command);
      this.logger.log(`Subscribed to SNS topic: ${options.topicArn}`);
      return response.SubscriptionArn || '';
    } catch (error: any) {
      this.logger.error('❌ SNS subscribe error:', error);
      throw new InternalServerErrorException(`Failed to subscribe to SNS topic: ${error.message}`);
    }
  }

  /**
   * Unsubscribe from SNS topic
   */
  async unsubscribe(subscriptionArn: string): Promise<void> {
    if (!this.isEnabled || !this.snsClient) {
      throw new InternalServerErrorException('SNS not configured');
    }

    try {
      const command = new UnsubscribeCommand({ SubscriptionArn: subscriptionArn });
      await this.snsClient.send(command);
      this.logger.log(`Unsubscribed from SNS topic`);
    } catch (error: any) {
      this.logger.error('❌ SNS unsubscribe error:', error);
      throw new InternalServerErrorException(`Failed to unsubscribe: ${error.message}`);
    }
  }

  /**
   * List all SNS topics
   */
  async listTopics(): Promise<string[]> {
    if (!this.isEnabled || !this.snsClient) {
      throw new InternalServerErrorException('SNS not configured');
    }

    try {
      const command = new ListTopicsCommand({});
      const response = await this.snsClient.send(command);
      return (response.Topics || []).map((t) => t.TopicArn || '');
    } catch (error: any) {
      this.logger.error('❌ SNS list topics error:', error);
      throw new InternalServerErrorException(`Failed to list SNS topics: ${error.message}`);
    }
  }

  /**
   * Set topic attribute
   */
  async setTopicAttribute(
    topicArn: string,
    attributeName: string,
    attributeValue: string,
  ): Promise<void> {
    if (!this.isEnabled || !this.snsClient) {
      throw new InternalServerErrorException('SNS not configured');
    }

    try {
      const command = new SetTopicAttributesCommand({
        TopicArn: topicArn,
        AttributeName: attributeName,
        AttributeValue: attributeValue,
      });

      await this.snsClient.send(command);
      this.logger.log(`SNS topic attribute set: ${attributeName}`);
    } catch (error: any) {
      this.logger.error('❌ SNS set attribute error:', error);
      throw new InternalServerErrorException(`Failed to set topic attribute: ${error.message}`);
    }
  }

  /**
   * Check if SNS is configured
   */
  isConfigured(): boolean {
    return this.isEnabled;
  }

  /**
   * Get SNS configuration info
   */
  getConfig() {
    return {
      isEnabled: this.isEnabled,
      region: this.region,
    };
  }
}
