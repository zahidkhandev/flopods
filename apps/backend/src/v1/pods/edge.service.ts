import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  forwardRef,
  Inject,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { DynamoDbService } from '../../common/aws/dynamodb/dynamodb.service';
import { plainToInstance } from 'class-transformer';
import { CreateEdgeDto } from './dto/create-edge.dto';
import { EdgeResponseDto } from './dto/pod-response.dto';
import { V1FlowGateway } from '../flow/flow.gateway';
import { V1ContextResolutionService } from '../execution/context-resolution.service';

@Injectable()
export class V1EdgeService {
  private readonly logger = new Logger(V1EdgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dynamoDb: DynamoDbService,
    private readonly flowGateway: V1FlowGateway,
    @Inject(forwardRef(() => V1ContextResolutionService))
    private readonly contextResolution: V1ContextResolutionService,
  ) {}

  /**
   * Create an edge connection between two pods
   */
  async createEdge(
    workspaceId: string,
    userId: string,
    dto: CreateEdgeDto,
  ): Promise<EdgeResponseDto> {
    try {
      // Verify flow exists in workspace
      const flow = await this.prisma.flow.findFirst({
        where: { id: dto.flowId, workspaceId },
      });

      if (!flow) {
        throw new NotFoundException(`Flow ${dto.flowId} not found`);
      }

      // Verify both pods exist in the flow
      const [sourcePod, targetPod] = await Promise.all([
        this.prisma.pod.findFirst({
          where: { id: dto.sourcePodId, flowId: dto.flowId },
        }),
        this.prisma.pod.findFirst({
          where: { id: dto.targetPodId, flowId: dto.flowId },
        }),
      ]);

      if (!sourcePod) {
        throw new BadRequestException(`Source pod ${dto.sourcePodId} not found in flow`);
      }

      if (!targetPod) {
        throw new BadRequestException(`Target pod ${dto.targetPodId} not found in flow`);
      }

      // Prevent self-loops
      if (dto.sourcePodId === dto.targetPodId) {
        throw new BadRequestException('Cannot create edge from pod to itself');
      }

      // Check for duplicate edges
      const existingEdge = await this.prisma.edge.findFirst({
        where: {
          flowId: dto.flowId,
          sourcePodId: dto.sourcePodId,
          targetPodId: dto.targetPodId,
          sourceHandle: dto.sourceHandle || null,
          targetHandle: dto.targetHandle || null,
        },
      });

      if (existingEdge) {
        throw new BadRequestException('Edge already exists between these pods and handles');
      }

      // Create edge in PostgreSQL
      const edge = await this.prisma.edge.create({
        data: {
          flowId: dto.flowId,
          sourcePodId: dto.sourcePodId,
          targetPodId: dto.targetPodId,
          sourceHandle: dto.sourceHandle,
          targetHandle: dto.targetHandle,
          animated: dto.animated || false,
        },
      });

      await this.contextResolution.invalidatePodContext(dto.targetPodId, dto.flowId);

      this.logger.log(
        `🔄 Invalidated context for target pod ${dto.targetPodId} after edge creation`,
      );

      // Update DynamoDB connectedPods
      const tableName = this.dynamoDb.getTableNames().pods;
      try {
        const sourceItem = await this.dynamoDb.getItem(tableName, {
          pk: sourcePod.dynamoPartitionKey,
          sk: sourcePod.dynamoSortKey,
        });

        if (sourceItem) {
          const updatedConnectedPods = [
            ...new Set([...(sourceItem.connectedPods || []), dto.targetPodId]),
          ];
          await this.dynamoDb.putItem(tableName, {
            ...sourceItem,
            connectedPods: updatedConnectedPods,
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (dynamoError) {
        this.logger.warn(
          `Failed to update connectedPods in DynamoDB for pod ${dto.sourcePodId}:`,
          dynamoError,
        );
      }

      this.logger.log(
        `✅ Edge created: ${edge.id} (${dto.sourcePodId} → ${dto.targetPodId}) by user ${userId}`,
      );

      const result = plainToInstance(EdgeResponseDto, edge, {
        excludeExtraneousValues: true,
      });

      // Broadcast to all users with context invalidation flag
      this.flowGateway.broadcastToFlow(dto.flowId, 'edge:created', {
        edge: result,
        targetPodId: dto.targetPodId,
        contextInvalidated: true,
        userId,
        timestamp: new Date().toISOString(),
      });

      return result;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      this.logger.error('❌ Failed to create edge', error);
      throw new InternalServerErrorException('Failed to create edge');
    }
  }

  /**
   * Delete an edge connection
   */
  async deleteEdge(edgeId: string, workspaceId: string, userId: string): Promise<void> {
    try {
      // Fetch edge with related pods
      const edge = await this.prisma.edge.findFirst({
        where: {
          id: edgeId,
          flow: { workspaceId },
        },
        include: {
          sourcePod: true,
          targetPod: true,
        },
      });

      if (!edge) {
        throw new NotFoundException(`Edge ${edgeId} not found`);
      }

      const flowId = edge.flowId;
      const targetPodId = edge.targetPodId;

      // Delete edge from PostgreSQL FIRST
      await this.prisma.edge.delete({
        where: { id: edgeId },
      });

      // ✅ CRITICAL: Invalidate target pod's context after connection removal
      await this.contextResolution.invalidatePodContext(targetPodId, flowId);

      this.logger.log(`🔄 Invalidated context for target pod ${targetPodId} after edge deletion`);

      // Update DynamoDB connectedPods
      const tableName = this.dynamoDb.getTableNames().pods;
      try {
        const sourceItem = await this.dynamoDb.getItem(tableName, {
          pk: edge.sourcePod.dynamoPartitionKey,
          sk: edge.sourcePod.dynamoSortKey,
        });

        if (sourceItem) {
          const updatedConnectedPods = (sourceItem.connectedPods || []).filter(
            (podId: string) => podId !== edge.targetPodId,
          );
          await this.dynamoDb.putItem(tableName, {
            ...sourceItem,
            connectedPods: updatedConnectedPods,
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (dynamoError) {
        this.logger.warn(
          `Failed to update connectedPods in DynamoDB for pod ${edge.sourcePodId}:`,
          dynamoError,
        );
      }

      this.logger.log(`✅ Edge deleted: ${edgeId} by user ${userId}`);

      // Broadcast deletion with context invalidation flag
      this.flowGateway.broadcastToFlow(flowId, 'edge:deleted', {
        edgeId,
        targetPodId,
        contextInvalidated: true,
        userId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`❌ Failed to delete edge ${edgeId}`, error);
      throw new InternalServerErrorException('Failed to delete edge');
    }
  }
}
