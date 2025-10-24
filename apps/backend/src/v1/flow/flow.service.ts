import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, FlowVisibility, FlowAccessLevel, FlowActivityAction } from '@actopod/schema';
import { plainToInstance } from 'class-transformer';
import { CreateFlowDto } from './dto/create-flow.dto';
import { UpdateFlowDto } from './dto/update-flow.dto';
import { FlowQueryDto } from './dto/flow-query.dto';
import { AddCollaboratorDto } from './dto/add-collaborator.dto';
import { UpdateCollaboratorDto } from './dto/update-collaborator.dto';
import {
  FlowResponseDto,
  FlowPaginatedResponseDto,
  FlowPaginationDto,
  CollaboratorResponseDto,
  ActivityLogResponseDto,
} from './dto/flow-response.dto';

@Injectable()
export class V1FlowService {
  private readonly logger = new Logger(V1FlowService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ==================== FLOW CRUD ====================

  async getWorkspaceFlows(
    workspaceId: string,
    userId: string,
    query: FlowQueryDto,
  ): Promise<FlowPaginatedResponseDto> {
    try {
      // User can see: their own flows, flows shared with them, or workspace-visible flows
      const where: Prisma.FlowWhereInput = {
        workspaceId,
        OR: [
          { createdBy: userId },
          { collaborators: { some: { userId } } },
          { visibility: FlowVisibility.WORKSPACE },
        ],
        ...(query.search && {
          AND: [
            {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { description: { contains: query.search, mode: 'insensitive' } },
              ],
            },
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

  async getFlowById(flowId: string, workspaceId: string, userId: string): Promise<FlowResponseDto> {
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

      // Verify user has access
      await this.verifyFlowAccess(flowId, userId, 'VIEW');

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
      if (error instanceof NotFoundException || error instanceof ForbiddenException) throw error;
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

      // Log activity
      await this.logActivity(flow.id, userId, FlowActivityAction.FLOW_CREATED, {
        name: flow.name,
        visibility: flow.visibility,
      });

      this.logger.log(`✅ Flow created: ${flow.id} by user ${userId}`);

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

      // Verify edit permission
      await this.verifyFlowAccess(flowId, userId, 'EDIT');

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

      // Log activity
      await this.logActivity(flowId, userId, FlowActivityAction.FLOW_UPDATED, dto);

      this.logger.log(`✅ Flow updated: ${flowId} by user ${userId}`);

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
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      )
        throw error;
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

      // Only owner can delete
      if (flow.createdBy !== userId) {
        throw new ForbiddenException('Only the flow owner can delete this flow');
      }

      await this.prisma.flow.delete({
        where: { id: flowId },
      });

      this.logger.log(`✅ Flow deleted: ${flowId} by user ${userId}`);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) throw error;
      this.logger.error(`Failed to delete flow ${flowId}`, error);
      throw new InternalServerErrorException('Failed to delete flow');
    }
  }

  // ==================== COLLABORATOR MANAGEMENT ====================

  async getFlowCollaborators(
    flowId: string,
    workspaceId: string,
    userId: string,
  ): Promise<CollaboratorResponseDto[]> {
    try {
      await this.verifyFlowExists(flowId, workspaceId);
      await this.verifyFlowAccess(flowId, userId, 'VIEW');

      const collaborators = await this.prisma.flowCollaborator.findMany({
        where: { flowId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
        orderBy: { invitedAt: 'asc' },
      });

      return collaborators.map((collab) =>
        plainToInstance(CollaboratorResponseDto, collab, { excludeExtraneousValues: true }),
      );
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) throw error;
      this.logger.error(`Failed to fetch collaborators for flow ${flowId}`, error);
      throw new InternalServerErrorException('Failed to fetch collaborators');
    }
  }

  async addCollaborator(
    flowId: string,
    workspaceId: string,
    userId: string,
    dto: AddCollaboratorDto,
  ): Promise<CollaboratorResponseDto> {
    try {
      await this.verifyFlowExists(flowId, workspaceId);
      await this.verifyFlowAccess(flowId, userId, 'INVITE');

      // Find user by email
      const targetUser = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });

      if (!targetUser) {
        throw new BadRequestException('User with this email not found');
      }

      // Check if already collaborator
      const existing = await this.prisma.flowCollaborator.findUnique({
        where: {
          flowId_userId: {
            flowId,
            userId: targetUser.id,
          },
        },
      });

      if (existing) {
        throw new BadRequestException('User is already a collaborator on this flow');
      }

      // Check if user is owner
      const flow = await this.prisma.flow.findUnique({ where: { id: flowId } });
      if (flow?.createdBy === targetUser.id) {
        throw new BadRequestException('Cannot add owner as collaborator');
      }

      const collaborator = await this.prisma.flowCollaborator.create({
        data: {
          flowId,
          userId: targetUser.id,
          accessLevel: dto.accessLevel || FlowAccessLevel.EDITOR,
          invitedBy: userId,
          canEdit: dto.accessLevel !== FlowAccessLevel.VIEWER,
          canExecute: true,
          canDelete: false,
          canShare: false,
          canInvite: false,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      });

      // Log activity
      await this.logActivity(flowId, userId, FlowActivityAction.COLLABORATOR_ADDED, {
        collaboratorEmail: dto.email,
        accessLevel: dto.accessLevel,
      });

      this.logger.log(`✅ Collaborator added to flow ${flowId}: ${dto.email}`);

      return plainToInstance(CollaboratorResponseDto, collaborator, {
        excludeExtraneousValues: true,
      });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      )
        throw error;
      this.logger.error(`Failed to add collaborator to flow ${flowId}`, error);
      throw new InternalServerErrorException('Failed to add collaborator');
    }
  }

  async updateCollaborator(
    flowId: string,
    collaboratorId: string,
    workspaceId: string,
    userId: string,
    dto: UpdateCollaboratorDto,
  ): Promise<CollaboratorResponseDto> {
    try {
      await this.verifyFlowExists(flowId, workspaceId);
      await this.verifyFlowAccess(flowId, userId, 'MANAGE');

      const collaborator = await this.prisma.flowCollaborator.update({
        where: { id: collaboratorId, flowId },
        data: dto,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      });

      // Log activity
      await this.logActivity(flowId, userId, FlowActivityAction.COLLABORATOR_PERMISSIONS_CHANGED, {
        collaboratorId,
        changes: dto,
      });

      this.logger.log(`✅ Collaborator updated in flow ${flowId}: ${collaboratorId}`);

      return plainToInstance(CollaboratorResponseDto, collaborator, {
        excludeExtraneousValues: true,
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) throw error;
      this.logger.error(`Failed to update collaborator ${collaboratorId}`, error);
      throw new InternalServerErrorException('Failed to update collaborator');
    }
  }

  async removeCollaborator(
    flowId: string,
    collaboratorId: string,
    workspaceId: string,
    userId: string,
  ): Promise<void> {
    try {
      await this.verifyFlowExists(flowId, workspaceId);
      await this.verifyFlowAccess(flowId, userId, 'MANAGE');

      const collaborator = await this.prisma.flowCollaborator.findUnique({
        where: { id: collaboratorId },
        include: { user: true },
      });

      await this.prisma.flowCollaborator.delete({
        where: { id: collaboratorId, flowId },
      });

      // Log activity
      await this.logActivity(flowId, userId, FlowActivityAction.COLLABORATOR_REMOVED, {
        collaboratorEmail: collaborator?.user.email,
      });

      this.logger.log(`✅ Collaborator removed from flow ${flowId}: ${collaboratorId}`);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) throw error;
      this.logger.error(`Failed to remove collaborator ${collaboratorId}`, error);
      throw new InternalServerErrorException('Failed to remove collaborator');
    }
  }

  // ==================== ACTIVITY LOG ====================

  async getFlowActivity(
    flowId: string,
    workspaceId: string,
    userId: string,
    limit: number = 50,
  ): Promise<ActivityLogResponseDto[]> {
    try {
      await this.verifyFlowExists(flowId, workspaceId);
      await this.verifyFlowAccess(flowId, userId, 'VIEW');

      const activities = await this.prisma.flowActivityLog.findMany({
        where: { flowId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      // Fetch users for activities
      const userIds = activities.map((a) => a.userId).filter((id): id is string => id !== null);
      const users = await this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      });

      const userMap = new Map(users.map((u) => [u.id, u]));

      return activities.map((activity) => {
        const user = activity.userId ? userMap.get(activity.userId) || null : null;

        return plainToInstance(
          ActivityLogResponseDto,
          {
            ...activity,
            user,
          },
          { excludeExtraneousValues: true },
        );
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) throw error;
      this.logger.error(`Failed to fetch activity for flow ${flowId}`, error);
      throw new InternalServerErrorException('Failed to fetch activity log');
    }
  }

  // ==================== HELPER METHODS ====================

  private async logActivity(
    flowId: string,
    userId: string | null,
    action: FlowActivityAction,
    changeData?: any,
  ): Promise<void> {
    try {
      await this.prisma.flowActivityLog.create({
        data: {
          flowId,
          userId,
          action,
          changeData,
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to log activity for flow ${flowId}:`, error);
    }
  }

  private async verifyFlowExists(flowId: string, workspaceId: string): Promise<void> {
    const flow = await this.prisma.flow.findFirst({
      where: { id: flowId, workspaceId },
    });

    if (!flow) {
      throw new NotFoundException('Flow not found');
    }
  }

  private async verifyFlowAccess(
    flowId: string,
    userId: string,
    action: 'VIEW' | 'EDIT' | 'DELETE' | 'INVITE' | 'MANAGE',
  ): Promise<void> {
    const flow = await this.prisma.flow.findUnique({
      where: { id: flowId },
      include: {
        collaborators: {
          where: { userId },
        },
      },
    });

    if (!flow) {
      throw new NotFoundException('Flow not found');
    }

    // Owner has all permissions
    if (flow.createdBy === userId) {
      return;
    }

    // Workspace-visible flows can be viewed by workspace members
    if (action === 'VIEW' && flow.visibility === FlowVisibility.WORKSPACE) {
      return;
    }

    const collaborator = flow.collaborators[0];

    if (!collaborator) {
      throw new ForbiddenException('Access denied to this flow');
    }

    // Check specific permissions
    switch (action) {
      case 'VIEW':
        return; // All collaborators can view
      case 'EDIT':
        if (!collaborator.canEdit) {
          throw new ForbiddenException('Edit permission required');
        }
        break;
      case 'DELETE':
        if (!collaborator.canDelete) {
          throw new ForbiddenException('Delete permission required');
        }
        break;
      case 'INVITE':
        if (!collaborator.canInvite) {
          throw new ForbiddenException('Invite permission required');
        }
        break;
      case 'MANAGE':
        if (collaborator.accessLevel !== FlowAccessLevel.OWNER) {
          throw new ForbiddenException('Owner permission required');
        }
        break;
    }
  }
}
