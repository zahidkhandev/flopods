import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DynamoDbService } from '../../common/aws/dynamodb/dynamodb.service';
import { plainToInstance } from 'class-transformer';
import { CreateEdgeDto } from './dto/create-edge.dto';
import { EdgeResponseDto } from './dto/pod-response.dto';
import { V1FlowGateway } from '../flow/flow.gateway';

@Injectable()
export class V1EdgeService {
  private readonly logger = new Logger(V1EdgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dynamoDb: DynamoDbService,
    private readonly flowGateway: V1FlowGateway,
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
      const flow = await this.prisma.flow.findFirst({
        where: { id: dto.flowId, workspaceId },
      });

      if (!flow) {
        throw new NotFoundException('Flow not found');
      }

      const [sourcePod, targetPod] = await Promise.all([
        this.prisma.pod.findFirst({
          where: { id: dto.sourcePodId, flowId: dto.flowId },
        }),
        this.prisma.pod.findFirst({
          where: { id: dto.targetPodId, flowId: dto.flowId },
        }),
      ]);

      if (!sourcePod || !targetPod) {
        throw new BadRequestException('Source or target pod not found');
      }

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

      const tableName = this.dynamoDb.getTableNames().pods;
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

      this.logger.log(`✅ Edge created: ${edge.id} (${dto.sourcePodId} → ${dto.targetPodId})`);

      const result = plainToInstance(EdgeResponseDto, edge, {
        excludeExtraneousValues: true,
      });

      // Broadcast to all users
      this.flowGateway.broadcastToFlow(dto.flowId, 'edge:created', {
        edge: result,
        userId,
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
        throw new NotFoundException('Edge not found');
      }

      const flowId = edge.flowId;

      const tableName = this.dynamoDb.getTableNames().pods;
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

      await this.prisma.edge.delete({
        where: { id: edgeId },
      });

      this.logger.log(`✅ Edge deleted: ${edgeId} by user ${userId}`);

      // Broadcast deletion
      this.flowGateway.broadcastToFlow(flowId, 'edge:deleted', {
        edgeId,
        userId,
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`❌ Failed to delete edge ${edgeId}`, error);
      throw new InternalServerErrorException('Failed to delete edge');
    }
  }
}
