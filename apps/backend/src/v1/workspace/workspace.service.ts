// src/modules/workspace/workspace.service.ts

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AwsSesEmailService } from '../../common/aws/ses/ses-email.service';
import { ConfigService } from '@nestjs/config';
import { WorkspaceCreateDto } from './dto/workspace-create.dto';
import { WorkspaceUpdateDto } from './dto/workspace-update.dto';
import { WorkspaceAddMemberDto } from './dto/workspace-add-member.dto';
import { WorkspaceUpdateMemberDto } from './dto/workspace-update-member.dto';
import { WorkspaceSendInvitationDto } from './dto/workspace-send-invitation.dto';
import { WorkspaceAddApiKeyDto } from './dto/workspace-add-api-key.dto';
import { WorkspaceUpdateApiKeyDto } from './dto/workspace-update-api-key.dto';
import { WorkspaceType, WorkspaceRole, InvitationStatus } from '@actopod/schema';
import * as crypto from 'crypto';
import { workspaceInvitationTemplate } from '../../common/aws/ses/templates/workspace/invitation.template';
import {
  WorkspaceListItem,
  WorkspaceDetails,
  WorkspaceMemberResponse,
  ApiKeyResponse,
  InvitationResponse,
  AcceptInvitationResponse,
  MessageResponse,
  ApiKeyUsageStats,
  UsageMetricResponse,
} from './types/workspace.types';

/**
 * Service handling all workspace-related business logic
 * Production-grade with AES-256-GCM encryption for API keys
 */
@Injectable()
export class V1WorkspaceService {
  private readonly logger = new Logger(V1WorkspaceService.name);
  private readonly encryptionKey: Buffer;
  private readonly encryptionAlgorithm = 'aes-256-gcm';

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: AwsSesEmailService,
    private readonly configService: ConfigService,
  ) {
    const key = this.configService.get<string>('API_KEY_ENCRYPTION_SECRET');

    if (!key) {
      this.logger.error('API_KEY_ENCRYPTION_SECRET is not set in environment variables');
      throw new Error(
        'API_KEY_ENCRYPTION_SECRET must be set in environment variables. ' +
          "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
      );
    }

    try {
      this.encryptionKey = Buffer.from(key, 'hex');
    } catch (error) {
      this.logger.error('Failed to parse API_KEY_ENCRYPTION_SECRET as hex', error);
      throw new Error(
        'API_KEY_ENCRYPTION_SECRET must be a valid hex string. ' +
          "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
      );
    }

    if (this.encryptionKey.length !== 32) {
      this.logger.error(
        `Invalid encryption key length: ${this.encryptionKey.length} bytes (expected 32 bytes)`,
      );
      throw new Error(
        `API_KEY_ENCRYPTION_SECRET must be exactly 32 bytes (64 hex characters). ` +
          `Current length: ${this.encryptionKey.length} bytes. ` +
          `Generate a valid key with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
      );
    }

    this.logger.log('✅ Encryption key validated successfully');
  }

  // ==================== WORKSPACE CRUD ====================

  async getAllWorkspaces(userId: string): Promise<WorkspaceListItem[]> {
    const workspaceUsers = await this.prisma.workspaceUser.findMany({
      where: { userId },
      include: {
        workspace: {
          include: {
            _count: {
              select: {
                members: true,
                flows: true,
              },
            },
          },
        },
      },
      orderBy: {
        joinedAt: 'desc',
      },
    });

    return workspaceUsers.map((wu) => ({
      id: wu.workspace.id,
      name: wu.workspace.name,
      type: wu.workspace.type,
      role: wu.role,
      permissions: {
        canCreateCanvas: wu.canCreateCanvas,
        canDeleteCanvas: wu.canDeleteCanvas,
        canManageBilling: wu.canManageBilling,
        canInviteMembers: wu.canInviteMembers,
        canManageMembers: wu.canManageMembers,
        canManageApiKeys: wu.canManageApiKeys,
      },
      memberCount: wu.workspace._count.members,
      canvasCount: wu.workspace._count.flows,
      joinedAt: wu.joinedAt,
      createdAt: wu.workspace.createdAt,
      updatedAt: wu.workspace.updatedAt,
    }));
  }

  async getWorkspaceById(workspaceId: string, userId: string): Promise<WorkspaceDetails> {
    const member = await this.prisma.workspaceUser.findUnique({
      where: {
        userId_workspaceId: { userId, workspaceId },
      },
    });

    if (!member) {
      throw new ForbiddenException('You do not have access to this workspace');
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                image: true,
              },
            },
          },
        },
        _count: {
          select: {
            flows: true,
            documents: true,
            apiKeys: true,
          },
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    return {
      id: workspace.id,
      name: workspace.name,
      type: workspace.type,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
      members: workspace.members,
      _count: workspace._count,
      currentUserRole: member.role,
      currentUserPermissions: {
        canCreateCanvas: member.canCreateCanvas,
        canDeleteCanvas: member.canDeleteCanvas,
        canManageBilling: member.canManageBilling,
        canInviteMembers: member.canInviteMembers,
        canManageMembers: member.canManageMembers,
        canManageApiKeys: member.canManageApiKeys,
      },
    };
  }

  async createWorkspace(userId: string, dto: WorkspaceCreateDto): Promise<any> {
    if (dto.type === WorkspaceType.PERSONAL) {
      throw new BadRequestException('Personal workspaces cannot be created manually');
    }

    const workspace = await this.prisma.workspace.create({
      data: {
        name: dto.name,
        type: dto.type,
        members: {
          create: {
            userId,
            role: WorkspaceRole.OWNER,
            canCreateCanvas: true,
            canDeleteCanvas: true,
            canManageBilling: true,
            canInviteMembers: true,
            canManageMembers: true,
            canManageApiKeys: true,
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                image: true,
              },
            },
          },
        },
      },
    });

    this.logger.log(`Workspace created: ${workspace.id} by user ${userId}`);
    return workspace;
  }

  async updateWorkspace(
    workspaceId: string,
    userId: string,
    dto: WorkspaceUpdateDto,
  ): Promise<any> {
    await this.verifyPermission(workspaceId, userId, 'canManageMembers');

    const workspace = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { name: dto.name },
    });

    this.logger.log(`Workspace updated: ${workspaceId} by user ${userId}`);
    return workspace;
  }

  async deleteWorkspace(workspaceId: string, userId: string): Promise<MessageResponse> {
    const member = await this.prisma.workspaceUser.findUnique({
      where: {
        userId_workspaceId: { userId, workspaceId },
      },
    });

    if (!member || member.role !== WorkspaceRole.OWNER) {
      throw new ForbiddenException('Only workspace owners can delete workspaces');
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (workspace.type === WorkspaceType.PERSONAL) {
      throw new BadRequestException('Personal workspaces cannot be deleted');
    }

    await this.prisma.workspace.delete({
      where: { id: workspaceId },
    });

    this.logger.log(`Workspace deleted: ${workspaceId} by user ${userId}`);
    return { message: 'Workspace deleted successfully' };
  }

  async transferOwnership(
    workspaceId: string,
    currentOwnerId: string,
    newOwnerId: string,
  ): Promise<MessageResponse> {
    const currentOwner = await this.prisma.workspaceUser.findUnique({
      where: { userId_workspaceId: { userId: currentOwnerId, workspaceId } },
    });

    if (!currentOwner || currentOwner.role !== WorkspaceRole.OWNER) {
      throw new ForbiddenException('Only the workspace owner can transfer ownership');
    }

    const newOwner = await this.prisma.workspaceUser.findUnique({
      where: { userId_workspaceId: { userId: newOwnerId, workspaceId } },
    });

    if (!newOwner) {
      throw new NotFoundException('Target user is not a member of this workspace');
    }

    await this.prisma.$transaction([
      this.prisma.workspaceUser.update({
        where: { userId_workspaceId: { userId: currentOwnerId, workspaceId } },
        data: { role: WorkspaceRole.ADMIN },
      }),
      this.prisma.workspaceUser.update({
        where: { userId_workspaceId: { userId: newOwnerId, workspaceId } },
        data: {
          role: WorkspaceRole.OWNER,
          canCreateCanvas: true,
          canDeleteCanvas: true,
          canManageBilling: true,
          canInviteMembers: true,
          canManageMembers: true,
          canManageApiKeys: true,
        },
      }),
    ]);

    this.logger.log(`Ownership transferred: ${currentOwnerId} → ${newOwnerId}`);
    return { message: 'Ownership transferred successfully' };
  }

  async getWorkspaceStats(workspaceId: string, userId: string) {
    await this.verifyMembership(workspaceId, userId);

    const stats = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        _count: {
          select: {
            members: true,
            flows: true,
            documents: true,
            apiKeys: true,
          },
        },
        members: {
          select: { role: true },
        },
      },
    });

    return {
      totalMembers: stats!._count.members,
      totalFlows: stats!._count.flows,
      totalDocuments: stats!._count.documents,
      totalApiKeys: stats!._count.apiKeys,
      roleDistribution: {
        owners: stats!.members.filter((m) => m.role === WorkspaceRole.OWNER).length,
        admins: stats!.members.filter((m) => m.role === WorkspaceRole.ADMIN).length,
        members: stats!.members.filter((m) => m.role === WorkspaceRole.MEMBER).length,
      },
    };
  }

  // ==================== MEMBERS ====================

  async getMembers(workspaceId: string, userId: string): Promise<WorkspaceMemberResponse[]> {
    await this.verifyMembership(workspaceId, userId);

    const members = await this.prisma.workspaceUser.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
          },
        },
      },
      orderBy: {
        joinedAt: 'desc',
      },
    });

    return members as WorkspaceMemberResponse[];
  }

  async addMember(
    workspaceId: string,
    userId: string,
    dto: WorkspaceAddMemberDto,
  ): Promise<WorkspaceMemberResponse> {
    await this.verifyPermission(workspaceId, userId, 'canManageMembers');

    const targetUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    const existing = await this.prisma.workspaceUser.findUnique({
      where: {
        userId_workspaceId: { userId: targetUser.id, workspaceId },
      },
    });

    if (existing) {
      throw new ConflictException('User is already a member of this workspace');
    }

    const member = await this.prisma.workspaceUser.create({
      data: {
        userId: targetUser.id,
        workspaceId,
        role: dto.role ?? WorkspaceRole.MEMBER,
        canCreateCanvas: dto.canCreateCanvas ?? true,
        canDeleteCanvas: dto.canDeleteCanvas ?? false,
        canInviteMembers: dto.canInviteMembers ?? false,
        canManageMembers: dto.canManageMembers ?? false,
        canManageApiKeys: dto.canManageApiKeys ?? false,
        invitedBy: userId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
          },
        },
      },
    });

    this.logger.log(`Member added: ${targetUser.email} to workspace ${workspaceId}`);
    return member as WorkspaceMemberResponse;
  }

  async updateMember(
    workspaceId: string,
    targetUserId: string,
    currentUserId: string,
    dto: WorkspaceUpdateMemberDto,
  ): Promise<WorkspaceMemberResponse> {
    await this.verifyPermission(workspaceId, currentUserId, 'canManageMembers');

    const targetMember = await this.prisma.workspaceUser.findUnique({
      where: {
        userId_workspaceId: { userId: targetUserId, workspaceId },
      },
    });

    if (!targetMember) {
      throw new NotFoundException('Member not found');
    }

    if (targetMember.role === WorkspaceRole.OWNER) {
      throw new ForbiddenException('Cannot modify workspace owner');
    }

    const updatedMember = await this.prisma.workspaceUser.update({
      where: {
        userId_workspaceId: { userId: targetUserId, workspaceId },
      },
      data: dto,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
          },
        },
      },
    });

    this.logger.log(`Member updated: ${targetUserId}`);
    return updatedMember as WorkspaceMemberResponse;
  }

  async removeMember(
    workspaceId: string,
    targetUserId: string,
    currentUserId: string,
  ): Promise<MessageResponse> {
    await this.verifyPermission(workspaceId, currentUserId, 'canManageMembers');

    const targetMember = await this.prisma.workspaceUser.findUnique({
      where: {
        userId_workspaceId: { userId: targetUserId, workspaceId },
      },
    });

    if (!targetMember) {
      throw new NotFoundException('Member not found');
    }

    if (targetMember.role === WorkspaceRole.OWNER) {
      throw new ForbiddenException('Cannot remove workspace owner');
    }

    await this.prisma.workspaceUser.delete({
      where: {
        userId_workspaceId: { userId: targetUserId, workspaceId },
      },
    });

    this.logger.log(`Member removed: ${targetUserId}`);
    return { message: 'Member removed successfully' };
  }

  // ==================== INVITATIONS ====================

  async sendInvitation(
    workspaceId: string,
    userId: string,
    dto: WorkspaceSendInvitationDto,
  ): Promise<InvitationResponse & MessageResponse> {
    await this.verifyPermission(workspaceId, userId, 'canInviteMembers');

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      const isMember = await this.prisma.workspaceUser.findUnique({
        where: {
          userId_workspaceId: { userId: existingUser.id, workspaceId },
        },
      });

      if (isMember) {
        throw new ConflictException('User is already a member of this workspace');
      }
    }

    const existing = await this.prisma.workspaceInvitation.findFirst({
      where: {
        workspaceId,
        email: dto.email,
        status: InvitationStatus.PENDING,
      },
    });

    if (existing) {
      throw new ConflictException('An invitation has already been sent to this email');
    }

    const token = crypto.randomBytes(32).toString('hex');

    const invitation = await this.prisma.workspaceInvitation.create({
      data: {
        workspaceId,
        email: dto.email,
        role: dto.role ?? WorkspaceRole.MEMBER,
        permissions: dto.permissions as any,
        invitedBy: userId,
        invitedUserId: existingUser?.id,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const inviteLink = `${this.configService.get('FRONTEND_URL')}/workspace/invite/${token}`;

    await this.emailService.sendEmail({
      to: dto.email,
      subject: `You've been invited to join ${workspace.name} on Actopod`,
      bodyHtml: workspaceInvitationTemplate(
        workspace.name,
        inviteLink,
        dto.role ?? WorkspaceRole.MEMBER,
      ),
    });

    this.logger.log(`Invitation sent to ${dto.email}`);
    return {
      ...(invitation as InvitationResponse),
      message: 'Invitation sent successfully',
    };
  }

  async getInvitations(workspaceId: string, userId: string): Promise<InvitationResponse[]> {
    await this.verifyMembership(workspaceId, userId);

    const invitations = await this.prisma.workspaceInvitation.findMany({
      where: {
        workspaceId,
        status: InvitationStatus.PENDING,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return invitations as InvitationResponse[];
  }

  async acceptInvitation(token: string, userId: string): Promise<AcceptInvitationResponse> {
    const invitation = await this.prisma.workspaceInvitation.findUnique({
      where: { token },
      include: { workspace: true },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Invitation is no longer valid');
    }

    if (invitation.expiresAt < new Date()) {
      await this.prisma.workspaceInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED },
      });
      throw new BadRequestException('Invitation has expired');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.email !== invitation.email) {
      throw new ForbiddenException('This invitation was sent to a different email address');
    }

    const existing = await this.prisma.workspaceUser.findUnique({
      where: {
        userId_workspaceId: { userId, workspaceId: invitation.workspaceId },
      },
    });

    if (existing) {
      throw new ConflictException('You are already a member of this workspace');
    }

    const permissions = (invitation.permissions as Record<string, boolean>) || {};

    const member = await this.prisma.workspaceUser.create({
      data: {
        userId,
        workspaceId: invitation.workspaceId,
        role: invitation.role,
        canCreateCanvas: permissions.canCreateCanvas ?? true,
        canDeleteCanvas: permissions.canDeleteCanvas ?? false,
        canInviteMembers: permissions.canInviteMembers ?? false,
        canManageMembers: permissions.canManageMembers ?? false,
        canManageApiKeys: permissions.canManageApiKeys ?? false,
        invitedBy: invitation.invitedBy,
      },
    });

    await this.prisma.workspaceInvitation.update({
      where: { id: invitation.id },
      data: {
        status: InvitationStatus.ACCEPTED,
        acceptedAt: new Date(),
      },
    });

    this.logger.log(`Invitation accepted: ${token}`);
    return {
      workspace: invitation.workspace,
      member,
      message: 'Successfully joined workspace',
    };
  }

  async revokeInvitation(
    invitationId: string,
    workspaceId: string,
    userId: string,
  ): Promise<MessageResponse> {
    await this.verifyPermission(workspaceId, userId, 'canInviteMembers');

    const invitation = await this.prisma.workspaceInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation || invitation.workspaceId !== workspaceId) {
      throw new NotFoundException('Invitation not found');
    }

    await this.prisma.workspaceInvitation.update({
      where: { id: invitationId },
      data: { status: InvitationStatus.REVOKED },
    });

    this.logger.log(`Invitation revoked: ${invitationId}`);
    return { message: 'Invitation revoked successfully' };
  }

  // ==================== API KEYS ====================

  async getApiKeys(workspaceId: string, userId: string): Promise<ApiKeyResponse[]> {
    await this.verifyPermission(workspaceId, userId, 'canManageApiKeys');

    const apiKeys = await this.prisma.providerAPIKey.findMany({
      where: { workspaceId },
      select: {
        id: true,
        provider: true,
        displayName: true,
        isActive: true,
        lastUsedAt: true,
        createdAt: true,
        usageCount: true,
        totalTokens: true,
        totalCost: true,
        lastErrorAt: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return apiKeys.map((key) => ({
      ...key,
      totalTokens: key.totalTokens.toString(),
      totalCost: Number(key.totalCost),
    })) as ApiKeyResponse[];
  }

  async addApiKey(
    workspaceId: string,
    userId: string,
    dto: WorkspaceAddApiKeyDto,
  ): Promise<ApiKeyResponse> {
    await this.verifyPermission(workspaceId, userId, 'canManageApiKeys');

    const existing = await this.prisma.providerAPIKey.findUnique({
      where: {
        workspaceId_provider_displayName: {
          workspaceId,
          provider: dto.provider,
          displayName: dto.displayName,
        },
      },
    });

    if (existing) {
      throw new ConflictException('An API key with this name already exists for this provider');
    }

    let keyHash: string;
    try {
      keyHash = this.encryptApiKey(dto.apiKey);
    } catch (error) {
      this.logger.error('Failed to encrypt API key', error);
      throw new InternalServerErrorException('Failed to encrypt API key. Please contact support.');
    }

    const apiKey = await this.prisma.providerAPIKey.create({
      data: {
        workspaceId,
        provider: dto.provider,
        displayName: dto.displayName,
        keyHash,
        createdById: userId,
      },
      select: {
        id: true,
        provider: true,
        displayName: true,
        isActive: true,
        lastUsedAt: true,
        createdAt: true,
        usageCount: true,
        totalTokens: true,
        totalCost: true,
        lastErrorAt: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    this.logger.log(`API key added: ${dto.provider}/${dto.displayName} by user ${userId}`);

    return {
      ...apiKey,
      totalTokens: apiKey.totalTokens.toString(),
      totalCost: Number(apiKey.totalCost),
    } as ApiKeyResponse;
  }

  async updateApiKey(
    workspaceId: string,
    keyId: string,
    userId: string,
    dto: WorkspaceUpdateApiKeyDto,
  ): Promise<ApiKeyResponse> {
    await this.verifyPermission(workspaceId, userId, 'canManageApiKeys');

    const existing = await this.prisma.providerAPIKey.findFirst({
      where: {
        id: keyId,
        workspaceId,
      },
    });

    if (!existing) {
      throw new NotFoundException('API key not found');
    }

    if (dto.displayName && dto.displayName !== existing.displayName) {
      const duplicate = await this.prisma.providerAPIKey.findUnique({
        where: {
          workspaceId_provider_displayName: {
            workspaceId,
            provider: existing.provider,
            displayName: dto.displayName,
          },
        },
      });

      if (duplicate) {
        throw new ConflictException('An API key with this name already exists');
      }
    }

    const updateData: any = {};

    if (dto.displayName !== undefined) {
      updateData.displayName = dto.displayName;
    }

    if (dto.isActive !== undefined) {
      updateData.isActive = dto.isActive;
    }

    if (dto.apiKey) {
      try {
        updateData.keyHash = this.encryptApiKey(dto.apiKey);
      } catch (error) {
        this.logger.error('Failed to encrypt API key', error);
        throw new InternalServerErrorException(
          'Failed to encrypt API key. Please contact support.',
        );
      }
    }

    const apiKey = await this.prisma.providerAPIKey.update({
      where: { id: keyId },
      data: updateData,
      select: {
        id: true,
        provider: true,
        displayName: true,
        isActive: true,
        lastUsedAt: true,
        createdAt: true,
        usageCount: true,
        totalTokens: true,
        totalCost: true,
        lastErrorAt: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    this.logger.log(`API key updated: ${keyId} by user ${userId}`);

    return {
      ...apiKey,
      totalTokens: apiKey.totalTokens.toString(),
      totalCost: Number(apiKey.totalCost),
    } as ApiKeyResponse;
  }

  async deleteApiKey(workspaceId: string, keyId: string, userId: string): Promise<MessageResponse> {
    await this.verifyPermission(workspaceId, userId, 'canManageApiKeys');

    const apiKey = await this.prisma.providerAPIKey.findFirst({
      where: {
        id: keyId,
        workspaceId,
      },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    await this.prisma.providerAPIKey.delete({
      where: { id: keyId },
    });

    this.logger.log(`API key deleted: ${keyId} by user ${userId}`);

    return { message: 'API key deleted successfully' };
  }

  async getApiKeyUsageStats(workspaceId: string, userId: string): Promise<ApiKeyUsageStats> {
    await this.verifyPermission(workspaceId, userId, 'canManageApiKeys');

    const apiKeys = await this.prisma.providerAPIKey.findMany({
      where: { workspaceId },
      select: {
        provider: true,
        isActive: true,
        usageCount: true,
        totalTokens: true,
        totalCost: true,
      },
    });

    const totalKeys = apiKeys.length;
    const activeKeys = apiKeys.filter((k) => k.isActive).length;
    const inactiveKeys = totalKeys - activeKeys;

    const providerBreakdown = apiKeys.reduce(
      (acc, key) => {
        acc[key.provider] = (acc[key.provider] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const totalUsageCount = apiKeys.reduce((sum, k) => sum + k.usageCount, 0);

    const totalTokensConsumed = apiKeys.reduce((sum, k) => sum + BigInt(k.totalTokens), BigInt(0));

    const totalCostIncurred = apiKeys.reduce((sum, k) => sum + Number(k.totalCost), 0);

    return {
      totalKeys,
      activeKeys,
      inactiveKeys,
      providerBreakdown,
      totalUsageCount,
      totalTokensConsumed: totalTokensConsumed.toString(),
      totalCostIncurred,
    };
  }

  async getUsageMetrics(
    workspaceId: string,
    keyId: string,
    userId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<UsageMetricResponse[]> {
    await this.verifyPermission(workspaceId, userId, 'canManageApiKeys');

    const whereClause: any = { workspaceId, keyId };
    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) whereClause.date.gte = startDate;
      if (endDate) whereClause.date.lte = endDate;
    }

    const metrics = await this.prisma.usageMetric.findMany({
      where: whereClause,
      orderBy: { date: 'desc' },
      take: 30,
    });

    return metrics.map((m) => ({
      id: m.id,
      date: m.date,
      requestCount: m.requestCount,
      successCount: m.successCount,
      errorCount: m.errorCount,
      promptTokens: m.promptTokens.toString(),
      completionTokens: m.completionTokens.toString(),
      totalTokens: m.totalTokens.toString(),
      estimatedCost: Number(m.estimatedCost),
    }));
  }

  async getDecryptedApiKey(keyId: string, workspaceId: string): Promise<string> {
    const apiKey = await this.prisma.providerAPIKey.findFirst({
      where: {
        id: keyId,
        workspaceId,
        isActive: true,
      },
      select: {
        keyHash: true,
      },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found or inactive');
    }

    try {
      return this.decryptApiKey(apiKey.keyHash);
    } catch (error) {
      this.logger.error(`Failed to decrypt API key ${keyId}`, error);
      throw new InternalServerErrorException('Failed to decrypt API key');
    }
  }

  // ==================== PRIVATE HELPERS ====================

  private async verifyMembership(workspaceId: string, userId: string): Promise<any> {
    const member = await this.prisma.workspaceUser.findUnique({
      where: {
        userId_workspaceId: { userId, workspaceId },
      },
    });

    if (!member) {
      throw new ForbiddenException('You do not have access to this workspace');
    }

    return member;
  }

  private async verifyPermission(
    workspaceId: string,
    userId: string,
    permission: string,
  ): Promise<any> {
    const member = await this.verifyMembership(workspaceId, userId);

    if (member.role === WorkspaceRole.OWNER) {
      return member;
    }

    if (!(member as any)[permission]) {
      throw new ForbiddenException('You do not have permission to perform this action');
    }

    return member;
  }

  /**
   * Encrypt API key using AES-256-GCM
   * Format: iv:authTag:encrypted
   */
  private encryptApiKey(apiKey: string): string {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.encryptionAlgorithm, this.encryptionKey, iv);

      let encrypted = cipher.update(apiKey, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error) {
      this.logger.error('Encryption failed', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new InternalServerErrorException(`Failed to encrypt API key: ${errorMessage}`);
    }
  }

  /**
   * Decrypt API key using AES-256-GCM
   * Format: iv:authTag:encrypted
   */
  private decryptApiKey(keyHash: string): string {
    try {
      const parts = keyHash.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted key format');
      }

      const [ivHex, authTagHex, encrypted] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      const decipher = crypto.createDecipheriv(this.encryptionAlgorithm, this.encryptionKey, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error('Decryption failed', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new InternalServerErrorException(`Failed to decrypt API key: ${errorMessage}`);
    }
  }
}
