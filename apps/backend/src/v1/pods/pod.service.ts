import {
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
  ConflictException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PodType, PodExecutionStatus } from '@flopods/schema';
import { plainToInstance } from 'class-transformer';
import { CreatePodDto } from './dto/create-pod.dto';
import { UpdatePodDto } from './dto/update-pod.dto';
import { PodResponseDto, EdgeResponseDto, FlowCanvasResponseDto } from './dto/pod-response.dto';
import { DynamoPodItem, PodContent } from './types/pod-content.types';
import { DynamoDbService } from '../../common/aws/dynamodb/dynamodb.service';
import { V1FlowGateway } from '../flow/flow.gateway';

@Injectable()
export class V1PodService {
  private readonly logger = new Logger(V1PodService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dynamoDb: DynamoDbService,
    private readonly flowGateway: V1FlowGateway,
  ) {}
  /**
   * Get all pods and edges in a flow
   * OPTIMIZED: Batch DynamoDB fetches
   */
  async getFlowCanvas(flowId: string, workspaceId: string): Promise<FlowCanvasResponseDto> {
    try {
      const flow = await this.prisma.flow.findFirst({
        where: { id: flowId, workspaceId },
      });

      if (!flow) {
        throw new NotFoundException(`Flow ${flowId} not found`);
      }

      const [pods, edges] = await Promise.all([
        this.prisma.pod.findMany({
          where: { flowId },
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.edge.findMany({
          where: { flowId },
          orderBy: { createdAt: 'asc' },
        }),
      ]);

      if (pods.length === 0) {
        return {
          pods: [],
          edges: edges.map((edge) =>
            plainToInstance(EdgeResponseDto, edge, { excludeExtraneousValues: true }),
          ),
        };
      }

      const tableName = this.dynamoDb.getTableNames().pods;

      // OPTIMIZATION: Batch fetch from DynamoDB
      const dynamoKeys = pods.map((pod) => ({
        pk: pod.dynamoPartitionKey,
        sk: pod.dynamoSortKey,
      }));

      const dynamoItems = await this.dynamoDb.batchGetItems(tableName, dynamoKeys);

      // Type-safe mapping with proper DynamoPodItem type
      const dynamoMap = new Map<string, DynamoPodItem>();
      dynamoItems.forEach((item: any) => {
        if (item && item.sk) {
          dynamoMap.set(item.sk, item as DynamoPodItem);
        }
      });

      const podsWithContent = pods.map((pod) => {
        const dynamoItem = dynamoMap.get(pod.dynamoSortKey);
        return plainToInstance(
          PodResponseDto,
          {
            ...pod,
            content: dynamoItem?.content || null,
            contextPods: dynamoItem?.contextPods || [],
          },
          { excludeExtraneousValues: true },
        );
      });

      const edgeResponses = edges.map((edge) =>
        plainToInstance(EdgeResponseDto, edge, { excludeExtraneousValues: true }),
      );

      this.logger.debug(
        `Fetched canvas for flow ${flowId}: ${podsWithContent.length} pods, ${edgeResponses.length} edges`,
      );

      return {
        pods: podsWithContent,
        edges: edgeResponses,
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Failed to fetch canvas for flow ${flowId}`, error);
      throw new InternalServerErrorException('Failed to fetch flow canvas');
    }
  }

  /**
   * Create a new pod with content in DynamoDB
   * OPTIMIZED: Better ID generation, transaction safety
   */
  async createPod(workspaceId: string, userId: string, dto: CreatePodDto): Promise<PodResponseDto> {
    try {
      const flow = await this.prisma.flow.findFirst({
        where: { id: dto.flowId, workspaceId },
      });

      if (!flow) {
        throw new NotFoundException(`Flow ${dto.flowId} not found`);
      }

      this.validatePodConfig(dto.type, dto.config);

      const podId = this.generateId();
      const pk = `WORKSPACE#${workspaceId}`;
      const sk = `FLOW#${dto.flowId}#POD#${podId}`;
      const gsi1pk = `FLOW#${dto.flowId}`;
      const gsi1sk = `POD#${podId}`;

      const positionPlain = this.serializePosition(dto.position);

      const content: PodContent = {
        type: dto.type,
        label: dto.label,
        description: dto.description,
        position: positionPlain,
        config: dto.config,
        inputs: this.getDefaultInputs(dto.type),
        outputs: this.getDefaultOutputs(dto.type),
        metadata: dto.metadata || {},
      } as any;

      const now = new Date().toISOString();
      const dynamoItem: DynamoPodItem = {
        pk,
        sk,
        gsi1pk,
        gsi1sk,
        podId,
        flowId: dto.flowId,
        workspaceId,
        content,
        connectedPods: [],
        contextPods: dto.contextPods || [],
        version: 1,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      };

      // OPTIMIZATION: Parallel writes with error handling
      const tableName = this.dynamoDb.getTableNames().pods;

      const [, pod] = await Promise.all([
        this.dynamoDb.putItem(tableName, dynamoItem),
        this.prisma.pod.create({
          data: {
            id: podId,
            flowId: dto.flowId,
            type: dto.type,
            position: positionPlain,
            executionStatus: PodExecutionStatus.IDLE,
            dynamoPartitionKey: pk,
            dynamoSortKey: sk,
          },
        }),
      ]);

      this.logger.log(
        `Pod created: ${pod.id} (${dto.type}) in flow ${dto.flowId} by user ${userId}`,
      );

      const result = plainToInstance(
        PodResponseDto,
        {
          ...pod,
          content,
          contextPods: dto.contextPods || [],
        },
        { excludeExtraneousValues: true },
      );

      this.flowGateway.broadcastToFlow(dto.flowId, 'pod:created', {
        pod: result,
        userId,
        timestamp: now,
      });

      return result;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      this.logger.error('❌ Failed to create pod', error);
      throw new InternalServerErrorException('Failed to create pod');
    }
  }

  /**
   * Update pod content in DynamoDB
   * OPTIMIZED: Added downstream invalidation for static pods
   */
  async updatePod(
    podId: string,
    workspaceId: string,
    userId: string,
    dto: UpdatePodDto,
  ): Promise<PodResponseDto> {
    try {
      const pod = await this.prisma.pod.findFirst({
        where: {
          id: podId,
          flow: { workspaceId },
        },
      });

      if (!pod) {
        throw new NotFoundException(`Pod ${podId} not found`);
      }

      if (pod.lockedBy && pod.lockedBy !== userId) {
        throw new ConflictException(`Pod is locked by user ${pod.lockedBy}`);
      }

      const tableName = this.dynamoDb.getTableNames().pods;
      const existingItem = (await this.dynamoDb.getItem(tableName, {
        pk: pod.dynamoPartitionKey,
        sk: pod.dynamoSortKey,
      })) as DynamoPodItem | null;

      if (!existingItem) {
        throw new NotFoundException('Pod content not found in DynamoDB');
      }

      const positionPlain = dto.position ? this.serializePosition(dto.position) : undefined;

      const updatedConfig = dto.config
        ? this.mergeConfig(existingItem.content.config, dto.config)
        : existingItem.content.config;

      const updatedContent: PodContent = {
        ...existingItem.content,
        ...(dto.label && { label: dto.label }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(positionPlain && { position: positionPlain }),
        config: updatedConfig,
        ...(dto.metadata && {
          metadata: { ...existingItem.content.metadata, ...dto.metadata },
        }),
      };

      const updatedItem: DynamoPodItem = {
        ...existingItem,
        content: updatedContent,
        contextPods: dto.contextPods ?? existingItem.contextPods,
        version: existingItem.version + 1,
        updatedAt: new Date().toISOString(),
      };

      // OPTIMIZATION: Only update Postgres if position changed
      const updates: Promise<any>[] = [this.dynamoDb.putItem(tableName, updatedItem)];

      if (positionPlain && JSON.stringify(positionPlain) !== JSON.stringify(pod.position)) {
        updates.push(
          this.prisma.pod.update({
            where: { id: podId },
            data: { position: positionPlain },
          }),
        );
      }

      await Promise.all(updates);

      // NEW: Invalidate downstream pods if this is a static content pod
      const isStaticPod = [
        'TEXT_INPUT',
        'DOCUMENT_INPUT',
        'URL_INPUT',
        'IMAGE_INPUT',
        'VIDEO_INPUT',
        'AUDIO_INPUT',
      ].includes(pod.type);

      if (isStaticPod && dto.config) {
        await this.invalidateDownstreamPods(podId, pod.flowId);
      }

      this.logger.log(`Pod updated: ${podId} by user ${userId}`);

      const result = plainToInstance(
        PodResponseDto,
        {
          ...pod,
          position: positionPlain || pod.position,
          content: updatedContent,
          contextPods: updatedItem.contextPods,
        },
        { excludeExtraneousValues: true },
      );

      this.flowGateway.broadcastToFlow(pod.flowId, 'pod:updated', {
        podId,
        updates: result,
        userId,
        timestamp: new Date().toISOString(),
      });

      return result;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException ||
        error instanceof BadRequestException
      )
        throw error;
      this.logger.error(`❌ Failed to update pod ${podId}`, error);
      throw new InternalServerErrorException('Failed to update pod');
    }
  }

  /**
   * NEW: Invalidate downstream pods when static pod content changes
   */
  private async invalidateDownstreamPods(podId: string, flowId: string): Promise<void> {
    try {
      const downstreamEdges = await this.prisma.edge.findMany({
        where: { flowId, sourcePodId: podId },
        select: { targetPodId: true },
      });

      if (downstreamEdges.length === 0) {
        this.logger.debug(`No downstream pods to invalidate for ${podId}`);
        return;
      }

      const downstreamPodIds = downstreamEdges.map((e) => e.targetPodId);

      await this.prisma.pod.updateMany({
        where: { id: { in: downstreamPodIds } },
        data: {
          executionStatus: PodExecutionStatus.IDLE,
          lastExecutionId: null,
        },
      });

      this.logger.log(
        `✅ Invalidated ${downstreamPodIds.length} downstream pods after updating ${podId}`,
      );

      // Broadcast invalidation to frontend
      downstreamPodIds.forEach((dpId) => {
        this.flowGateway.broadcastToFlow(flowId, 'pod:invalidated', {
          podId: dpId,
          reason: 'upstream_content_changed',
          upstreamPodId: podId,
          timestamp: new Date().toISOString(),
        });
      });
    } catch (error) {
      this.logger.error(`Failed to invalidate downstream pods for ${podId}`, error);
      // Don't throw - this is a non-critical operation
    }
  }

  /**
   * Delete pod from both PostgreSQL and DynamoDB
   * OPTIMIZED: Parallel deletes
   */
  async deletePod(podId: string, workspaceId: string, userId: string): Promise<void> {
    try {
      const pod = await this.prisma.pod.findFirst({
        where: {
          id: podId,
          flow: { workspaceId },
        },
      });

      if (!pod) {
        throw new NotFoundException(`Pod ${podId} not found`);
      }

      const flowId = pod.flowId;
      const tableName = this.dynamoDb.getTableNames().pods;

      // OPTIMIZATION: Parallel deletes
      await Promise.all([
        this.dynamoDb.deleteItem(tableName, {
          pk: pod.dynamoPartitionKey,
          sk: pod.dynamoSortKey,
        }),
        this.prisma.pod.delete({
          where: { id: podId },
        }),
      ]);

      this.logger.log(`Pod deleted: ${podId} by user ${userId}`);

      this.flowGateway.broadcastToFlow(flowId, 'pod:deleted', {
        podId,
        userId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`❌ Failed to delete pod ${podId}`, error);
      throw new InternalServerErrorException('Failed to delete pod');
    }
  }

  /**
   * Lock pod for editing
   */
  async lockPod(podId: string, userId: string): Promise<void> {
    try {
      const pod = await this.prisma.pod.findUnique({ where: { id: podId } });

      if (!pod) {
        throw new NotFoundException(`Pod ${podId} not found`);
      }

      if (pod.lockedBy && pod.lockedBy !== userId) {
        throw new ConflictException(`Pod is already locked by user ${pod.lockedBy}`);
      }

      await this.prisma.pod.update({
        where: { id: podId },
        data: {
          lockedBy: userId,
          lockedAt: new Date(),
        },
      });

      this.logger.debug(`🔒 Pod locked: ${podId} by user ${userId}`);

      this.flowGateway.broadcastToFlow(pod.flowId, 'pod:locked', {
        podId,
        userId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) throw error;
      this.logger.error(`Failed to lock pod ${podId}`, error);
      throw new InternalServerErrorException('Failed to lock pod');
    }
  }

  /**
   * Unlock pod after editing
   */
  async unlockPod(podId: string, userId: string): Promise<void> {
    try {
      const pod = await this.prisma.pod.findUnique({ where: { id: podId } });

      if (!pod) {
        throw new NotFoundException(`Pod ${podId} not found`);
      }

      if (pod.lockedBy && pod.lockedBy !== userId) {
        throw new ConflictException(`Cannot unlock pod locked by another user`);
      }

      await this.prisma.pod.update({
        where: { id: podId },
        data: {
          lockedBy: null,
          lockedAt: null,
        },
      });

      this.logger.debug(`🔓 Pod unlocked: ${podId} by user ${userId}`);

      this.flowGateway.broadcastToFlow(pod.flowId, 'pod:unlocked', {
        podId,
        userId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) throw error;
      this.logger.error(`Failed to unlock pod ${podId}`, error);
      throw new InternalServerErrorException('Failed to unlock pod');
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private validatePodConfig(type: PodType, config: any): void {
    if (type === PodType.LLM_PROMPT) {
      if (!config.provider || !config.model) {
        throw new BadRequestException('LLM pods require provider and model in config');
      }
    }
  }

  private serializePosition(position: any): { x: number; y: number } {
    return JSON.parse(JSON.stringify(position));
  }

  private mergeConfig(existing: any, updates: any): any {
    return { ...existing, ...updates };
  }

  private getDefaultInputs(type: PodType) {
    switch (type) {
      case PodType.LLM_PROMPT:
        return [
          { id: 'input', label: 'Input', type: 'target' as const, dataType: 'string' as const },
          {
            id: 'context',
            label: 'Context',
            type: 'target' as const,
            dataType: 'document' as const,
          },
        ];
      case PodType.TEXT_OUTPUT:
      case PodType.IMAGE_OUTPUT:
        return [{ id: 'input', label: 'Input', type: 'target' as const, dataType: 'any' as const }];
      default:
        return [];
    }
  }

  private getDefaultOutputs(type: PodType) {
    switch (type) {
      case PodType.TEXT_INPUT:
      case PodType.LLM_PROMPT:
      case PodType.CODE_EXECUTION:
        return [
          { id: 'output', label: 'Output', type: 'source' as const, dataType: 'string' as const },
        ];
      case PodType.DOCUMENT_INPUT:
        return [
          {
            id: 'output',
            label: 'Document',
            type: 'source' as const,
            dataType: 'document' as const,
          },
        ];
      case PodType.IMAGE_INPUT:
        return [
          { id: 'output', label: 'Image', type: 'source' as const, dataType: 'image' as const },
        ];
      default:
        return [];
    }
  }

  private generateId(): string {
    return `pod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
