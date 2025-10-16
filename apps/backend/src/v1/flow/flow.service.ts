import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, FlowVisibility } from '@actopod/schema';
import { plainToInstance } from 'class-transformer';
import { CreateFlowDto } from './dto/create-flow.dto';
import { UpdateFlowDto } from './dto/update-flow.dto';
import { FlowQueryDto } from './dto/flow-query.dto';
import {
  FlowResponseDto,
  FlowPaginatedResponseDto,
  FlowPaginationDto,
} from './dto/flow-response.dto';

@Injectable()
export class V1FlowService {
  private readonly logger = new Logger(V1FlowService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getWorkspaceFlows(
    workspaceId: string,
    _userId: string,
    query: FlowQueryDto,
  ): Promise<FlowPaginatedResponseDto> {
    try {
      const where: Prisma.FlowWhereInput = {
        workspaceId,
        ...(query.search && {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { description: { contains: query.search, mode: 'insensitive' } },
          ],
        }),
        ...(query.visibility && { visibility: query.visibility }),
        ...(query.spaceId && { spaceId: query.spaceId }),
      };

      const [flows, totalItems] = await Promise.all([
        this.prisma.flow.findMany({
          where,
          include: {
            _count: {
              select: {
                pods: true,
                collaborators: true,
              },
            },
          },
          orderBy: { updatedAt: 'desc' },
          skip: query.skip,
          take: query.limit,
        }),
        this.prisma.flow.count({ where }),
      ]);

      const totalPages = Math.ceil(totalItems / query.limit);

      const pagination: FlowPaginationDto = {
        totalItems,
        totalPages,
        currentPage: query.page,
        pageSize: flows.length,
      };

      const data = flows.map((flow) =>
        plainToInstance(
          FlowResponseDto,
          {
            ...flow,
            podCount: flow._count.pods,
            collaboratorCount: flow._count.collaborators,
          },
          { excludeExtraneousValues: true },
        ),
      );

      return { data, pagination };
    } catch (error) {
      this.logger.error(`Failed to fetch flows for workspace ${workspaceId}`, error);
      throw new InternalServerErrorException('Failed to fetch flows');
    }
  }

  async getFlowById(
    flowId: string,
    workspaceId: string,
    _userId: string,
  ): Promise<FlowResponseDto> {
    try {
      const flow = await this.prisma.flow.findFirst({
        where: {
          id: flowId,
          workspaceId,
        },
        include: {
          _count: {
            select: {
              pods: true,
              collaborators: true,
            },
          },
        },
      });

      if (!flow) {
        throw new NotFoundException('Flow not found');
      }

      return plainToInstance(
        FlowResponseDto,
        {
          ...flow,
          podCount: flow._count.pods,
          collaboratorCount: flow._count.collaborators,
        },
        { excludeExtraneousValues: true },
      );
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Failed to fetch flow ${flowId}`, error);
      throw new InternalServerErrorException('Failed to fetch flow');
    }
  }

  async createFlow(
    workspaceId: string,
    userId: string,
    dto: CreateFlowDto,
  ): Promise<FlowResponseDto> {
    try {
      if (dto.spaceId) {
        const space = await this.prisma.space.findFirst({
          where: { id: dto.spaceId, workspaceId },
        });

        if (!space) {
          throw new BadRequestException('Space not found in this workspace');
        }
      }

      const flow = await this.prisma.flow.create({
        data: {
          workspaceId,
          spaceId: dto.spaceId,
          name: dto.name,
          description: dto.description,
          visibility: dto.visibility || FlowVisibility.PRIVATE,
          createdBy: userId,
        },
        include: {
          _count: {
            select: {
              pods: true,
              collaborators: true,
            },
          },
        },
      });

      this.logger.log(`Flow created: ${flow.id} by user ${userId}`);

      return plainToInstance(
        FlowResponseDto,
        {
          ...flow,
          podCount: flow._count.pods,
          collaboratorCount: flow._count.collaborators,
        },
        { excludeExtraneousValues: true },
      );
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error('Failed to create flow', error);
      throw new InternalServerErrorException('Failed to create flow');
    }
  }

  async updateFlow(
    flowId: string,
    workspaceId: string,
    userId: string,
    dto: UpdateFlowDto,
  ): Promise<FlowResponseDto> {
    try {
      const existingFlow = await this.prisma.flow.findFirst({
        where: {
          id: flowId,
          workspaceId,
        },
      });

      if (!existingFlow) {
        throw new NotFoundException('Flow not found');
      }

      if (dto.spaceId) {
        const space = await this.prisma.space.findFirst({
          where: { id: dto.spaceId, workspaceId },
        });

        if (!space) {
          throw new BadRequestException('Space not found in this workspace');
        }
      }

      const flow = await this.prisma.flow.update({
        where: { id: flowId },
        data: {
          ...(dto.name && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.spaceId !== undefined && { spaceId: dto.spaceId }),
          ...(dto.visibility && { visibility: dto.visibility }),
        },
        include: {
          _count: {
            select: {
              pods: true,
              collaborators: true,
            },
          },
        },
      });

      this.logger.log(`Flow updated: ${flowId} by user ${userId}`);

      return plainToInstance(
        FlowResponseDto,
        {
          ...flow,
          podCount: flow._count.pods,
          collaboratorCount: flow._count.collaborators,
        },
        { excludeExtraneousValues: true },
      );
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      this.logger.error(`Failed to update flow ${flowId}`, error);
      throw new InternalServerErrorException('Failed to update flow');
    }
  }

  async deleteFlow(flowId: string, workspaceId: string, userId: string): Promise<void> {
    try {
      const flow = await this.prisma.flow.findFirst({
        where: {
          id: flowId,
          workspaceId,
        },
      });

      if (!flow) {
        throw new NotFoundException('Flow not found');
      }

      await this.prisma.flow.delete({
        where: { id: flowId },
      });

      this.logger.log(`Flow deleted: ${flowId} by user ${userId}`);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Failed to delete flow ${flowId}`, error);
      throw new InternalServerErrorException('Failed to delete flow');
    }
  }
}
