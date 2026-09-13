import { Injectable, Logger, InternalServerErrorException, OnModuleInit } from '@nestjs/common';
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
  CreateTableCommand,
  DescribeTableCommand,
  UpdateTimeToLiveCommand,
  ResourceNotFoundException,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

export interface QueryOptions {
  tableName: string;
  keyConditionExpression: string;
  expressionAttributeValues: Record<string, any>;
  expressionAttributeNames?: Record<string, string>;
  indexName?: string;
  limit?: number;
  exclusiveStartKey?: Record<string, any>;
  scanIndexForward?: boolean;
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
export class DynamoDbService implements OnModuleInit {
  private readonly logger = new Logger(DynamoDbService.name);
  private readonly dynamoClient: DynamoDBClient | null = null;
  private readonly isEnabled: boolean;
  private readonly region: string;
  private readonly isProduction: boolean;

  // Table names
  private readonly podTableName: string;
  private readonly executionTableName: string;
  private readonly contextTableName: string;

  constructor(private readonly configService: ConfigService) {
    this.region =
      this.configService.get<string>('AWS_DYNAMODB_REGION') ||
      this.configService.get<string>('AWS_REGION') ||
      'ap-south-1';

    const accessKeyId = this.configService.get<string>('AWS_DYNAMODB_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_DYNAMODB_SECRET_ACCESS_KEY');
    const endpoint = this.configService.get<string>('AWS_DYNAMODB_ENDPOINT');

    this.isProduction = this.configService.get('NODE_ENV') === 'production';

    // Get table names from environment
    this.podTableName = this.configService.get<string>(
      'AWS_DYNAMODB_POD_TABLE',
      'flopods-pods-dev',
    );
    this.executionTableName = this.configService.get<string>(
      'AWS_DYNAMODB_EXECUTION_TABLE',
      'flopods-executions-dev',
    );
    this.contextTableName = this.configService.get<string>(
      'AWS_DYNAMODB_CONTEXT_TABLE',
      'flopods-context-dev',
    );

    this.isEnabled = !!(accessKeyId && secretAccessKey);

    if (this.isEnabled && accessKeyId && secretAccessKey) {
      const clientConfig: any = {
        region: this.region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
        maxAttempts: 3,
      };

      if (endpoint) {
        clientConfig.endpoint = endpoint;
        this.logger.log(`🔧 DynamoDB LocalStack endpoint: ${endpoint}`);
      } else {
        this.logger.log('☁️  Using AWS DynamoDB (Production)');
      }

      this.dynamoClient = new DynamoDBClient(clientConfig);
      this.logger.log('AWS DynamoDB initialized successfully');
      this.logger.log(`📋 Pod Table: ${this.podTableName}`);
      this.logger.log(`📋 Execution Table: ${this.executionTableName}`);
      this.logger.log(`📋 Context Table: ${this.contextTableName}`);
    } else {
      this.logger.warn('⚠️  AWS DynamoDB not configured');
    }
  }

  async onModuleInit() {
    if (this.isEnabled && this.dynamoClient) {
      const endpoint = this.configService.get<string>('AWS_DYNAMODB_ENDPOINT');

      // Only auto-create tables when using LocalStack
      if (endpoint) {
        this.logger.log('🔧 LocalStack mode: Ensuring tables exist...');
        // Tables will be created by init script, just verify
        await this.verifyTables();
      } else {
        this.logger.log('🏭 Production mode: Tables should exist in AWS');
      }
    }
  }

  private async verifyTables() {
    try {
      const results = await Promise.allSettled([
        this.dynamoClient!.send(new DescribeTableCommand({ TableName: this.podTableName })),
        this.dynamoClient!.send(new DescribeTableCommand({ TableName: this.executionTableName })),
        this.dynamoClient!.send(new DescribeTableCommand({ TableName: this.contextTableName })),
      ]);

      const successful = results.filter((r) => r.status === 'fulfilled').length;
      this.logger.log(`${successful}/3 DynamoDB tables verified`);

      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          this.logger.warn(
            `⚠️  Table ${[this.podTableName, this.executionTableName, this.contextTableName][index]} issue: ${result.reason?.message}`,
          );
        }
      });
    } catch (error: any) {
      this.logger.warn(`⚠️  DynamoDB table verification: ${error.message}`);
    }
  }

  /**
   * Ensure table exists (development only)
   */
  private async ensureTableExists(tableName: string, schema: CreateTableCommand['input']) {
    try {
      await this.dynamoClient!.send(new DescribeTableCommand({ TableName: tableName }));
      this.logger.log(`DynamoDB table "${tableName}" exists`);
    } catch (error: any) {
      if (error instanceof ResourceNotFoundException) {
        await this.createTable(schema);
        // Enable TTL after table creation
        await this.enableTTL(tableName);
      } else {
        this.logger.error(`❌ Error checking table ${tableName}: ${error.message}`);
      }
    }
  }

  /**
   * Create table with schema
   */
  private async createTable(schema: CreateTableCommand['input']) {
    try {
      await this.dynamoClient!.send(new CreateTableCommand(schema));
      this.logger.log(`Created DynamoDB table "${schema.TableName}"`);

      // Wait for table to be active
      await this.waitForTableActive(schema.TableName!);
    } catch (error: any) {
      this.logger.error(`❌ Error creating table ${schema.TableName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Wait for table to become active
   */
  private async waitForTableActive(tableName: string, maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const { Table } = await this.dynamoClient!.send(
          new DescribeTableCommand({ TableName: tableName }),
        );

        if (Table?.TableStatus === 'ACTIVE') {
          this.logger.log(`Table "${tableName}" is active`);
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch {
        this.logger.warn(`⏳ Waiting for table "${tableName}" to be active...`);
      }
    }

    throw new Error(`Table "${tableName}" did not become active in time`);
  }

  /**
   * Enable TTL on a table
   */
  private async enableTTL(tableName: string) {
    try {
      await this.dynamoClient!.send(
        new UpdateTimeToLiveCommand({
          TableName: tableName,
          TimeToLiveSpecification: {
            Enabled: true,
            AttributeName: 'ttl',
          },
        }),
      );
      this.logger.log(`Enabled TTL for table "${tableName}"`);
    } catch (error: any) {
      this.logger.warn(`⚠️ Could not enable TTL for "${tableName}": ${error.message}`);
    }
  }

  /**
   * Pod Table Schema
   * Stores: Pod content, configuration, visual properties, connections, context
   */
  private createPodTableSchema(): CreateTableCommand['input'] {
    return {
      TableName: this.podTableName,
      KeySchema: [
        { AttributeName: 'pk', KeyType: 'HASH' }, // WORKSPACE#<id>
        { AttributeName: 'sk', KeyType: 'RANGE' }, // FLOW#<flowId>#POD#<podId>
      ],
      AttributeDefinitions: [
        { AttributeName: 'pk', AttributeType: 'S' },
        { AttributeName: 'sk', AttributeType: 'S' },
        { AttributeName: 'gsi1pk', AttributeType: 'S' }, // FLOW#<flowId>
        { AttributeName: 'gsi1sk', AttributeType: 'S' }, // POD#<podId>
        { AttributeName: 'gsi2pk', AttributeType: 'S' }, // POD#<podId>
        { AttributeName: 'gsi2sk', AttributeType: 'S' }, // VERSION#<timestamp>
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'GSI1-FlowPods',
          KeySchema: [
            { AttributeName: 'gsi1pk', KeyType: 'HASH' },
            { AttributeName: 'gsi1sk', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
        {
          IndexName: 'GSI2-PodVersions',
          KeySchema: [
            { AttributeName: 'gsi2pk', KeyType: 'HASH' },
            { AttributeName: 'gsi2sk', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    };
  }

  /**
   * Execution Table Schema
   * Stores: Execution results, inputs, outputs, context used, caching
   */
  private createExecutionTableSchema(): CreateTableCommand['input'] {
    return {
      TableName: this.executionTableName,
      KeySchema: [
        { AttributeName: 'pk', KeyType: 'HASH' }, // POD#<podId>
        { AttributeName: 'sk', KeyType: 'RANGE' }, // EXECUTION#<timestamp>
      ],
      AttributeDefinitions: [
        { AttributeName: 'pk', AttributeType: 'S' },
        { AttributeName: 'sk', AttributeType: 'S' },
        { AttributeName: 'gsi1pk', AttributeType: 'S' }, // FLOW#<flowId>
        { AttributeName: 'gsi1sk', AttributeType: 'S' }, // EXECUTION#<timestamp>
        { AttributeName: 'gsi2pk', AttributeType: 'S' }, // WORKSPACE#<id>#STATUS#<status>
        { AttributeName: 'gsi2sk', AttributeType: 'S' }, // TIMESTAMP#<timestamp>
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'GSI1-FlowExecutions',
          KeySchema: [
            { AttributeName: 'gsi1pk', KeyType: 'HASH' },
            { AttributeName: 'gsi1sk', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
        {
          IndexName: 'GSI2-WorkspaceExecutions',
          KeySchema: [
            { AttributeName: 'gsi2pk', KeyType: 'HASH' },
            { AttributeName: 'gsi2sk', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    };
  }

  /**
   * Context Table Schema
   * Stores: Context chains, pod relationships, execution context snapshots
   */
  private createContextTableSchema(): CreateTableCommand['input'] {
    return {
      TableName: this.contextTableName,
      KeySchema: [
        { AttributeName: 'pk', KeyType: 'HASH' }, // EXECUTION#<execId> or FLOW#<flowId>
        { AttributeName: 'sk', KeyType: 'RANGE' }, // CONTEXT#<timestamp> or POD#<podId>
      ],
      AttributeDefinitions: [
        { AttributeName: 'pk', AttributeType: 'S' },
        { AttributeName: 'sk', AttributeType: 'S' },
        { AttributeName: 'gsi1pk', AttributeType: 'S' }, // POD#<podId>
        { AttributeName: 'gsi1sk', AttributeType: 'S' }, // USED_IN#<flowId>#<timestamp>
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'GSI1-PodContextUsage',
          KeySchema: [
            { AttributeName: 'gsi1pk', KeyType: 'HASH' },
            { AttributeName: 'gsi1sk', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    };
  }

  /**
   * Put item into table
   */
  async putItem(tableName: string, item: Record<string, any>): Promise<void> {
    if (!this.isEnabled || !this.dynamoClient) {
      this.logger.debug(`[DynamoDB LOG] Put item in ${tableName}`);
      return;
    }

    try {
      const command = new PutItemCommand({
        TableName: tableName,
        Item: marshall(item, { removeUndefinedValues: true }),
      });

      await this.dynamoClient.send(command);
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
    } catch (error: any) {
      this.logger.error('❌ DynamoDB delete item error:', error);
      throw new InternalServerErrorException(`Failed to delete item: ${error.message}`);
    }
  }

  /**
   * Query items from table (supports GSI)
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
        IndexName: options.indexName,
        KeyConditionExpression: options.keyConditionExpression,
        ExpressionAttributeValues: marshall(options.expressionAttributeValues),
        ExpressionAttributeNames: options.expressionAttributeNames,
        Limit: options.limit,
        ScanIndexForward: options.scanIndexForward !== false,
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

    const batches = [];
    for (let i = 0; i < items.length; i += 25) {
      batches.push(items.slice(i, i + 25));
    }

    try {
      for (const batch of batches) {
        const command = new BatchWriteItemCommand({
          RequestItems: {
            [tableName]: batch.map((item) => ({
              PutRequest: { Item: marshall(item, { removeUndefinedValues: true }) },
            })),
          },
        });

        await this.dynamoClient.send(command);
      }

      this.logger.log(`${items.length} items batch written to table`);
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
   * Batch get items (alias for batchGet with better chunking)
   */
  async batchGetItems(tableName: string, keys: Record<string, any>[]): Promise<any[]> {
    if (!this.isEnabled || !this.dynamoClient) {
      this.logger.debug(`[DynamoDB LOG] Batch get ${keys.length} items from ${tableName}`);
      return [];
    }

    if (keys.length === 0) return [];

    // DynamoDB BatchGetItem has 100 item limit, chunk into batches
    const chunks: Record<string, any>[][] = [];
    for (let i = 0; i < keys.length; i += 100) {
      chunks.push(keys.slice(i, i + 100));
    }

    try {
      const results = await Promise.all(
        chunks.map(async (chunk) => {
          const command = new BatchGetItemCommand({
            RequestItems: {
              [tableName]: {
                Keys: chunk.map((key) => marshall(key)),
              },
            },
          });

          const response = await this.dynamoClient!.send(command);
          const items = response.Responses?.[tableName] || [];
          return items.map((item) => unmarshall(item));
        }),
      );

      const flatResults = results.flat();
      this.logger.debug(
        `Batch fetched ${flatResults.length}/${keys.length} items from ${tableName}`,
      );
      return flatResults;
    } catch (error: any) {
      this.logger.error('DynamoDB batch get items error:', error);
      throw new InternalServerErrorException(`Failed to batch get items: ${error.message}`);
    }
  }

  /**
   * Helper: Get all pods in a flow with their context
   */
  async queryPodsByFlow(flowId: string): Promise<Record<string, any>[]> {
    const { items } = await this.query({
      tableName: this.podTableName,
      indexName: 'GSI1-FlowPods',
      keyConditionExpression: 'gsi1pk = :flowId',
      expressionAttributeValues: {
        ':flowId': `FLOW#${flowId}`,
      },
      scanIndexForward: true,
    });

    return items;
  }

  /**
   * Helper: Get pod content with all context
   */
  async getPodWithContext(workspaceId: string, flowId: string, podId: string) {
    return this.getItem(this.podTableName, {
      pk: `WORKSPACE#${workspaceId}`,
      sk: `FLOW#${flowId}#POD#${podId}`,
    });
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
      isProduction: this.isProduction,
      podTableName: this.podTableName,
      executionTableName: this.executionTableName,
      contextTableName: this.contextTableName,
      endpoint: this.configService.get<string>('AWS_DYNAMODB_ENDPOINT'),
    };
  }

  /**
   * Get table names
   */
  getTableNames() {
    return {
      pods: this.podTableName,
      executions: this.executionTableName,
      context: this.contextTableName,
    };
  }
}
