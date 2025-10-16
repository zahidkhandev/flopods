import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  UpdateItemCommand,
  DeleteItemCommand,
  QueryCommand,
  ScanCommand,
  BatchWriteItemCommand,
  BatchGetItemCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

export interface QueryOptions {
  tableName: string;
  keyConditionExpression: string;
  expressionAttributeValues: Record<string, any>;
  expressionAttributeNames?: Record<string, string>;
  limit?: number;
  exclusiveStartKey?: Record<string, any>;
}

export interface ScanOptions {
  tableName: string;
  filterExpression?: string;
  expressionAttributeValues?: Record<string, any>;
  expressionAttributeNames?: Record<string, string>;
  limit?: number;
  exclusiveStartKey?: Record<string, any>;
}

@Injectable()
export class DynamoDbService {
  private readonly logger = new Logger(DynamoDbService.name);
  private readonly dynamoClient: DynamoDBClient | null = null;
  private readonly isEnabled: boolean;
  private readonly region: string;

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION') || 'us-east-1';
    const accessKeyId = this.configService.get<string>('AWS_DYNAMODB_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_DYNAMODB_SECRET_ACCESS_KEY');

    this.isEnabled = !!(this.region && accessKeyId && secretAccessKey);

    if (this.isEnabled && accessKeyId && secretAccessKey) {
      this.dynamoClient = new DynamoDBClient({
        region: this.region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
        maxAttempts: 3,
      });
      this.logger.log('✅ AWS DynamoDB initialized successfully');
    } else {
      this.logger.warn('⚠️  AWS DynamoDB not configured');
    }
  }

  /**
   * Put item into table
   */
  async putItem(tableName: string, item: Record<string, any>): Promise<void> {
    if (!this.isEnabled || !this.dynamoClient) {
      this.logger.log(`[DynamoDB LOG] Put item in ${tableName}:`, item);
      return;
    }

    try {
      const command = new PutItemCommand({
        TableName: tableName,
        Item: marshall(item),
      });

      await this.dynamoClient.send(command);
      this.logger.log(`✅ Item added to DynamoDB table: ${tableName}`);
    } catch (error: any) {
      this.logger.error('❌ DynamoDB put item error:', error);
      throw new InternalServerErrorException(`Failed to put item in DynamoDB: ${error.message}`);
    }
  }

  /**
   * Get item from table
   */
  async getItem(tableName: string, key: Record<string, any>): Promise<Record<string, any> | null> {
    if (!this.isEnabled || !this.dynamoClient) {
      this.logger.log(`[DynamoDB LOG] Get item from ${tableName}:`, key);
      return null;
    }

    try {
      const command = new GetItemCommand({
        TableName: tableName,
        Key: marshall(key),
      });

      const response = await this.dynamoClient.send(command);
      return response.Item ? unmarshall(response.Item) : null;
    } catch (error: any) {
      this.logger.error('❌ DynamoDB get item error:', error);
      throw new InternalServerErrorException(`Failed to get item from DynamoDB: ${error.message}`);
    }
  }

  /**
   * Update item in table
   */
  async updateItem(
    tableName: string,
    key: Record<string, any>,
    updates: Record<string, any>,
  ): Promise<Record<string, any>> {
    if (!this.isEnabled || !this.dynamoClient) {
      throw new InternalServerErrorException('DynamoDB not configured');
    }

    try {
      const updateExpression =
        'SET ' +
        Object.keys(updates)
          .map((k, i) => `#attr${i} = :val${i}`)
          .join(', ');
      const expressionAttributeNames = Object.keys(updates).reduce(
        (acc, k, i) => {
          acc[`#attr${i}`] = k;
          return acc;
        },
        {} as Record<string, string>,
      );
      const expressionAttributeValues = marshall(
        Object.values(updates).reduce(
          (acc, v, i) => {
            acc[`:val${i}`] = v;
            return acc;
          },
          {} as Record<string, any>,
        ),
      );

      const command = new UpdateItemCommand({
        TableName: tableName,
        Key: marshall(key),
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW',
      });

      const response = await this.dynamoClient.send(command);
      this.logger.log(`✅ Item updated in DynamoDB table: ${tableName}`);
      return response.Attributes ? unmarshall(response.Attributes) : {};
    } catch (error: any) {
      this.logger.error('❌ DynamoDB update item error:', error);
      throw new InternalServerErrorException(`Failed to update item: ${error.message}`);
    }
  }

  /**
   * Delete item from table
   */
  async deleteItem(tableName: string, key: Record<string, any>): Promise<void> {
    if (!this.isEnabled || !this.dynamoClient) {
      throw new InternalServerErrorException('DynamoDB not configured');
    }

    try {
      const command = new DeleteItemCommand({
        TableName: tableName,
        Key: marshall(key),
      });

      await this.dynamoClient.send(command);
      this.logger.log(`✅ Item deleted from DynamoDB table: ${tableName}`);
    } catch (error: any) {
      this.logger.error('❌ DynamoDB delete item error:', error);
      throw new InternalServerErrorException(`Failed to delete item: ${error.message}`);
    }
  }

  /**
   * Query items from table
   */
  async query(options: QueryOptions): Promise<{
    items: Record<string, any>[];
    lastEvaluatedKey?: Record<string, any>;
  }> {
    if (!this.isEnabled || !this.dynamoClient) {
      throw new InternalServerErrorException('DynamoDB not configured');
    }

    try {
      const command = new QueryCommand({
        TableName: options.tableName,
        KeyConditionExpression: options.keyConditionExpression,
        ExpressionAttributeValues: marshall(options.expressionAttributeValues),
        ExpressionAttributeNames: options.expressionAttributeNames,
        Limit: options.limit,
        ExclusiveStartKey: options.exclusiveStartKey
          ? marshall(options.exclusiveStartKey)
          : undefined,
      });

      const response = await this.dynamoClient.send(command);

      return {
        items: (response.Items || []).map((item) => unmarshall(item)),
        lastEvaluatedKey: response.LastEvaluatedKey
          ? unmarshall(response.LastEvaluatedKey)
          : undefined,
      };
    } catch (error: any) {
      this.logger.error('❌ DynamoDB query error:', error);
      throw new InternalServerErrorException(`Failed to query items: ${error.message}`);
    }
  }

  /**
   * Scan table
   */
  async scan(options: ScanOptions): Promise<{
    items: Record<string, any>[];
    lastEvaluatedKey?: Record<string, any>;
  }> {
    if (!this.isEnabled || !this.dynamoClient) {
      throw new InternalServerErrorException('DynamoDB not configured');
    }

    try {
      const command = new ScanCommand({
        TableName: options.tableName,
        FilterExpression: options.filterExpression,
        ExpressionAttributeValues: options.expressionAttributeValues
          ? marshall(options.expressionAttributeValues)
          : undefined,
        ExpressionAttributeNames: options.expressionAttributeNames,
        Limit: options.limit,
        ExclusiveStartKey: options.exclusiveStartKey
          ? marshall(options.exclusiveStartKey)
          : undefined,
      });

      const response = await this.dynamoClient.send(command);

      return {
        items: (response.Items || []).map((item) => unmarshall(item)),
        lastEvaluatedKey: response.LastEvaluatedKey
          ? unmarshall(response.LastEvaluatedKey)
          : undefined,
      };
    } catch (error: any) {
      this.logger.error('❌ DynamoDB scan error:', error);
      throw new InternalServerErrorException(`Failed to scan table: ${error.message}`);
    }
  }

  /**
   * Batch write items
   */
  async batchWrite(tableName: string, items: Record<string, any>[]): Promise<void> {
    if (!this.isEnabled || !this.dynamoClient) {
      throw new InternalServerErrorException('DynamoDB not configured');
    }

    // DynamoDB batch write limit is 25 items
    const batches = [];
    for (let i = 0; i < items.length; i += 25) {
      batches.push(items.slice(i, i + 25));
    }

    try {
      for (const batch of batches) {
        const command = new BatchWriteItemCommand({
          RequestItems: {
            [tableName]: batch.map((item) => ({
              PutRequest: { Item: marshall(item) },
            })),
          },
        });

        await this.dynamoClient.send(command);
      }

      this.logger.log(`✅ ${items.length} items batch written to DynamoDB table: ${tableName}`);
    } catch (error: any) {
      this.logger.error('❌ DynamoDB batch write error:', error);
      throw new InternalServerErrorException(`Failed to batch write items: ${error.message}`);
    }
  }

  /**
   * Batch get items
   */
  async batchGet(tableName: string, keys: Record<string, any>[]): Promise<Record<string, any>[]> {
    if (!this.isEnabled || !this.dynamoClient) {
      throw new InternalServerErrorException('DynamoDB not configured');
    }

    try {
      const command = new BatchGetItemCommand({
        RequestItems: {
          [tableName]: {
            Keys: keys.map((key) => marshall(key)),
          },
        },
      });

      const response = await this.dynamoClient.send(command);
      const items = response.Responses?.[tableName] || [];

      return items.map((item) => unmarshall(item));
    } catch (error: any) {
      this.logger.error('❌ DynamoDB batch get error:', error);
      throw new InternalServerErrorException(`Failed to batch get items: ${error.message}`);
    }
  }

  /**
   * Check if DynamoDB is configured
   */
  isConfigured(): boolean {
    return this.isEnabled;
  }

  /**
   * Get DynamoDB configuration info
   */
  getConfig() {
    return {
      isEnabled: this.isEnabled,
      region: this.region,
    };
  }
}
