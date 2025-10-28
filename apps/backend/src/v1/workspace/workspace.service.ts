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
import { WorkspaceUpdateMemberDto } from './dto/workspace-update-member.dto';
import { WorkspaceSendInvitationDto } from './dto/workspace-send-invitation.dto';
import { WorkspaceAddApiKeyDto } from './dto/workspace-add-api-key.dto';
import { WorkspaceUpdateApiKeyDto } from './dto/workspace-update-api-key.dto';
import { WorkspaceType, WorkspaceRole, InvitationStatus, NotificationType } from '@flopods/schema';
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
  InvitationDetailsResponse,
} from './types/workspace.types';
import { V1NotificationService } from '../notification/notification.service';

/**
 * PRODUCTION-GRADE Workspace Service
 * Features:
 * - AES-256-GCM encryption (12-byte IV, new standard)
 * - Backward compatibility (16-byte IV, legacy format)
 * - Auto workspace type switching (PERSONAL ↔ TEAM)
 * - Comprehensive error handling
 * - Audit logging
 * - Permission management
 */
@Injectable()
export class V1WorkspaceService {
  private readonly logger = new Logger(V1WorkspaceService.name);
  private readonly encryptionKey: Buffer;
  private readonly encryptionAlgorithm = 'aes-256-gcm';
  private readonly NEW_IV_LENGTH = 12; // 96-bit IV (GCM standard)
  private readonly OLD_IV_LENGTH = 16; // 128-bit IV (legacy)
  private readonly AUTH_TAG_LENGTH = 16; // 128-bit auth tag

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: AwsSesEmailService,
    private readonly configService: ConfigService,
    private readonly notificationService: V1NotificationService,
  ) {
    this.encryptionKey = this.initializeEncryption();
  }

  /**
   * Initialize and validate encryption key
   */
  private initializeEncryption(): Buffer {
    try {
      const key = this.configService.get<string>('API_KEY_ENCRYPTION_SECRET');

      if (!key) {
        const errorMsg =
          'CRITICAL: API_KEY_ENCRYPTION_SECRET environment variable is not set. ' +
          "Generate one using: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"";
        this.logger.error(errorMsg);
        throw new Error(errorMsg);
      }

      // Validate hex format
      if (!/^[0-9a-fA-F]{64}$/.test(key)) {
        throw new Error(
          'API_KEY_ENCRYPTION_SECRET must be a 64-character hexadecimal string (32 bytes). ' +
            "Generate using: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
        );
      }

      const keyBuffer = Buffer.from(key, 'hex');

      if (keyBuffer.length !== 32) {
        throw new Error(
          `API_KEY_ENCRYPTION_SECRET must be exactly 32 bytes (64 hex characters). Current: ${keyBuffer.length} bytes`,
        );
      }

      this.logger.log('✅ Encryption key validated successfully');
      return keyBuffer;
    } catch (error) {
      this.logger.error('Failed to initialize encryption:', error);
      throw error;
    }
  }

  // ==================== WORKSPACE CRUD ====================

  /**
   * AUTO-SWITCH WORKSPACE TYPE LOGIC
   * - 1 member = PERSONAL
   * - 2+ members = TEAM
   */
  private async autoSwitchWorkspaceType(workspaceId: string): Promise<void> {
    try {
      const memberCount = await this.prisma.workspaceUser.count({
        where: { workspaceId },
      });

      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { type: true },
      });

      if (!workspace) return;

      // Switch to TEAM if 2+ members
      if (memberCount >= 2 && workspace.type === WorkspaceType.PERSONAL) {
        await this.prisma.workspace.update({
          where: { id: workspaceId },
          data: { type: WorkspaceType.TEAM },
        });
        this.logger.log(
          `🔄 Workspace ${workspaceId} auto-switched to TEAM (${memberCount} members)`,
        );
      }

      // Switch to PERSONAL if only 1 member
      if (memberCount === 1 && workspace.type === WorkspaceType.TEAM) {
        await this.prisma.workspace.update({
          where: { id: workspaceId },
          data: { type: WorkspaceType.PERSONAL },
        });
        this.logger.log(`🔄 Workspace ${workspaceId} auto-switched to PERSONAL (1 member)`);
      }
    } catch (error) {
      this.logger.error(`Failed to auto-switch workspace type for ${workspaceId}:`, error);
      // Don't throw - this is a non-critical operation
    }
  }

  async getAllWorkspaces(userId: string): Promise<WorkspaceListItem[]> {
    try {
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
    } catch (error) {
      this.logger.error(`Failed to get workspaces for user ${userId}:`, error);
      throw new InternalServerErrorException('Failed to fetch workspaces');
    }
  }

  async getWorkspaceById(workspaceId: string, userId: string): Promise<WorkspaceDetails> {
    try {
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
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) throw error;
      this.logger.error(`Failed to get workspace ${workspaceId}:`, error);
      throw new InternalServerErrorException('Failed to fetch workspace');
    }
  }

  async createWorkspace(userId: string, dto: WorkspaceCreateDto): Promise<any> {
    try {
      const workspace = await this.prisma.workspace.create({
        data: {
          name: dto.name,
          type: dto.type ?? WorkspaceType.PERSONAL,
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

      this.logger.log(`✅ Workspace created: ${workspace.id} by user ${userId}`);
      return workspace;
    } catch (error) {
      this.logger.error('Failed to create workspace:', error);
      throw new InternalServerErrorException('Failed to create workspace');
    }
  }

  async updateWorkspace(
    workspaceId: string,
    userId: string,
    dto: WorkspaceUpdateDto,
  ): Promise<any> {
    try {
      await this.verifyPermission(workspaceId, userId, 'canManageMembers');

      const workspace = await this.prisma.workspace.update({
        where: { id: workspaceId },
        data: { name: dto.name },
      });

      this.logger.log(`✅ Workspace updated: ${workspaceId} by user ${userId}`);
      return workspace;
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) throw error;
      this.logger.error(`Failed to update workspace ${workspaceId}:`, error);
      throw new InternalServerErrorException('Failed to update workspace');
    }
  }

  async deleteWorkspace(workspaceId: string, userId: string): Promise<MessageResponse> {
    try {
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

      this.logger.log(`✅ Workspace deleted: ${workspaceId} by user ${userId}`);
      return { message: 'Workspace deleted successfully' };
    } catch (error) {
      if (
        error instanceof ForbiddenException ||
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      )
        throw error;
      this.logger.error(`Failed to delete workspace ${workspaceId}:`, error);
      throw new InternalServerErrorException('Failed to delete workspace');
    }
  }

  async transferOwnership(
    workspaceId: string,
    currentOwnerId: string,
    newOwnerId: string,
  ): Promise<MessageResponse> {
    try {
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

      this.logger.log(`✅ Ownership transferred: ${currentOwnerId} → ${newOwnerId}`);
      return { message: 'Ownership transferred successfully' };
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) throw error;
      this.logger.error('Failed to transfer ownership:', error);
      throw new InternalServerErrorException('Failed to transfer ownership');
    }
  }

  async getWorkspaceStats(workspaceId: string, userId: string) {
    try {
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

      if (!stats) {
        throw new NotFoundException('Workspace not found');
      }

      return {
        totalMembers: stats._count.members,
        totalFlows: stats._count.flows,
        totalDocuments: stats._count.documents,
        totalApiKeys: stats._count.apiKeys,
        roleDistribution: {
          owners: stats.members.filter((m) => m.role === WorkspaceRole.OWNER).length,
          admins: stats.members.filter((m) => m.role === WorkspaceRole.ADMIN).length,
          members: stats.members.filter((m) => m.role === WorkspaceRole.MEMBER).length,
        },
      };
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) throw error;
      this.logger.error(`Failed to get workspace stats for ${workspaceId}:`, error);
      throw new InternalServerErrorException('Failed to fetch workspace stats');
    }
  }

  // ==================== MEMBERS ====================

  async getMembers(workspaceId: string, userId: string): Promise<WorkspaceMemberResponse[]> {
    try {
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
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      this.logger.error(`Failed to get members for workspace ${workspaceId}:`, error);
      throw new InternalServerErrorException('Failed to fetch members');
    }
  }

  async updateMember(
    workspaceId: string,
    targetUserId: string,
    currentUserId: string,
    dto: WorkspaceUpdateMemberDto,
  ): Promise<WorkspaceMemberResponse> {
    try {
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

      this.logger.log(`✅ Member updated: ${targetUserId} in workspace ${workspaceId}`);
      return updatedMember as WorkspaceMemberResponse;
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) throw error;
      this.logger.error(`Failed to update member ${targetUserId}:`, error);
      throw new InternalServerErrorException('Failed to update member');
    }
  }

  async removeMember(
    workspaceId: string,
    targetUserId: string,
    currentUserId: string,
  ): Promise<MessageResponse> {
    try {
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

      // Auto-switch workspace type
      await this.autoSwitchWorkspaceType(workspaceId);

      this.logger.log(`✅ Member removed: ${targetUserId} from workspace ${workspaceId}`);
      return { message: 'Member removed successfully' };
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) throw error;
      this.logger.error(`Failed to remove member ${targetUserId}:`, error);
      throw new InternalServerErrorException('Failed to remove member');
    }
  }

  // ==================== INVITATIONS ====================

  async sendInvitation(
    workspaceId: string,
    userId: string,
    dto: WorkspaceSendInvitationDto,
  ): Promise<InvitationResponse & MessageResponse> {
    try {
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

      // Create in-app notification if user exists
      if (existingUser) {
        await this.notificationService.createNotification({
          userId: existingUser.id,
          type: NotificationType.WORKSPACE_INVITATION,
          title: `Workspace Invitation: ${workspace.name}`,
          body: `You've been invited to join ${workspace.name} as ${dto.role ?? WorkspaceRole.MEMBER}`,
          entityType: 'workspace_invitation',
          entityId: invitation.id,
          metadata: {
            workspaceId,
            workspaceName: workspace.name,
            role: dto.role ?? WorkspaceRole.MEMBER,
            inviterName: userId,
          },
          actionUrl: `/workspace/invite/${token}`,
          expiresAt: invitation.expiresAt,
        });
      }

      const inviteLink = `${this.configService.get('FRONTEND_URL')}/workspace/invite/${token}`;

      await this.emailService.sendEmail({
        to: dto.email,
        subject: `You've been invited to join ${workspace.name} on Flopods`,
        bodyHtml: workspaceInvitationTemplate(
          workspace.name,
          inviteLink,
          dto.role ?? WorkspaceRole.MEMBER,
        ),
      });

      this.logger.log(`✅ Invitation sent to ${dto.email} for workspace ${workspaceId}`);
      return {
        ...(invitation as InvitationResponse),
        message: 'Invitation sent successfully',
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException ||
        error instanceof ForbiddenException
      )
        throw error;
      this.logger.error('Failed to send invitation:', error);
      throw new InternalServerErrorException('Failed to send invitation');
    }
  }

  async getInvitations(workspaceId: string, userId: string): Promise<InvitationResponse[]> {
    try {
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
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      this.logger.error(`Failed to get invitations for workspace ${workspaceId}:`, error);
      throw new InternalServerErrorException('Failed to fetch invitations');
    }
  }

  async acceptInvitation(token: string, userId: string): Promise<AcceptInvitationResponse> {
    try {
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

      const permissions = (invitation.permissions as Record<string, boolean> | null) || {};

      const defaultPermissions = {
        canCreateCanvas: true,
        canDeleteCanvas: false,
        canInviteMembers: false,
        canManageMembers: false,
        canManageApiKeys: false,
        canManageBilling: false,
      };

      const member = await this.prisma.workspaceUser.create({
        data: {
          userId,
          workspaceId: invitation.workspaceId,
          role: invitation.role,
          canCreateCanvas: permissions.canCreateCanvas ?? defaultPermissions.canCreateCanvas,
          canDeleteCanvas: permissions.canDeleteCanvas ?? defaultPermissions.canDeleteCanvas,
          canInviteMembers: permissions.canInviteMembers ?? defaultPermissions.canInviteMembers,
          canManageMembers: permissions.canManageMembers ?? defaultPermissions.canManageMembers,
          canManageApiKeys: permissions.canManageApiKeys ?? defaultPermissions.canManageApiKeys,
          canManageBilling: permissions.canManageBilling ?? defaultPermissions.canManageBilling,
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

      // Auto-switch workspace type
      await this.autoSwitchWorkspaceType(invitation.workspaceId);

      // Notify workspace admins/owner
      const admins = await this.prisma.workspaceUser.findMany({
        where: {
          workspaceId: invitation.workspaceId,
          role: { in: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN] },
        },
      });

      for (const admin of admins) {
        await this.notificationService.createNotification({
          userId: admin.userId,
          type: NotificationType.WORKSPACE_MEMBER_JOINED,
          title: 'New Member Joined',
          body: `${user.name || user.email} has joined ${invitation.workspace.name}`,
          entityType: 'workspace',
          entityId: invitation.workspaceId,
          metadata: {
            workspaceId: invitation.workspaceId,
            newMemberEmail: user.email,
            newMemberName: user.name,
            role: invitation.role,
          },
          actionUrl: `/settings?tab=members`,
        });
      }

      this.logger.log(`✅ Invitation accepted: ${token} by user ${userId}`);
      return {
        workspace: invitation.workspace,
        member,
        message: 'Successfully joined workspace',
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof ConflictException
      )
        throw error;
      this.logger.error('Failed to accept invitation:', error);
      throw new InternalServerErrorException('Failed to accept invitation');
    }
  }

  async getInvitationDetails(token: string): Promise<InvitationDetailsResponse> {
    try {
      const invitation = await this.prisma.workspaceInvitation.findUnique({
        where: { token },
        include: { workspace: true },
      });

      if (!invitation) {
        throw new NotFoundException('Invitation not found');
      }

      if (invitation.status !== InvitationStatus.PENDING) {
        throw new BadRequestException(`Invitation is ${invitation.status.toLowerCase()}`);
      }

      return {
        workspace: {
          id: invitation.workspace.id,
          name: invitation.workspace.name,
          type: invitation.workspace.type,
        },
        email: invitation.email,
        role: invitation.role,
        permissions: invitation.permissions as Record<string, boolean> | null,
        expiresAt: invitation.expiresAt,
        status: invitation.status,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      this.logger.error('Failed to get invitation details:', error);
      throw new InternalServerErrorException('Failed to fetch invitation details');
    }
  }

  async revokeInvitation(
    invitationId: string,
    workspaceId: string,
    userId: string,
  ): Promise<MessageResponse> {
    try {
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

      this.logger.log(`✅ Invitation revoked: ${invitationId}`);
      return { message: 'Invitation revoked successfully' };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) throw error;
      this.logger.error(`Failed to revoke invitation ${invitationId}:`, error);
      throw new InternalServerErrorException('Failed to revoke invitation');
    }
  }

  // ==================== API KEYS ====================

  async getApiKeys(workspaceId: string, userId: string): Promise<ApiKeyResponse[]> {
    try {
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
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      this.logger.error(`Failed to get API keys for workspace ${workspaceId}:`, error);
      throw new InternalServerErrorException('Failed to fetch API keys');
    }
  }

  async addApiKey(
    workspaceId: string,
    userId: string,
    dto: WorkspaceAddApiKeyDto,
  ): Promise<ApiKeyResponse> {
    try {
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

      const keyHash = this.encryptApiKey(dto.apiKey);

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

      this.logger.log(`✅ API key added: ${dto.provider}/${dto.displayName} by user ${userId}`);

      return {
        ...apiKey,
        totalTokens: apiKey.totalTokens.toString(),
        totalCost: Number(apiKey.totalCost),
      } as ApiKeyResponse;
    } catch (error) {
      if (error instanceof ConflictException || error instanceof ForbiddenException) throw error;
      this.logger.error('Failed to add API key:', error);
      throw new InternalServerErrorException('Failed to add API key');
    }
  }

  async updateApiKey(
    workspaceId: string,
    keyId: string,
    userId: string,
    dto: WorkspaceUpdateApiKeyDto,
  ): Promise<ApiKeyResponse> {
    try {
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
        updateData.keyHash = this.encryptApiKey(dto.apiKey);
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

      this.logger.log(`✅ API key updated: ${keyId} by user ${userId}`);

      return {
        ...apiKey,
        totalTokens: apiKey.totalTokens.toString(),
        totalCost: Number(apiKey.totalCost),
      } as ApiKeyResponse;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException ||
        error instanceof ForbiddenException
      )
        throw error;
      this.logger.error(`Failed to update API key ${keyId}:`, error);
      throw new InternalServerErrorException('Failed to update API key');
    }
  }

  async deleteApiKey(workspaceId: string, keyId: string, userId: string): Promise<MessageResponse> {
    try {
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

      this.logger.log(`✅ API key deleted: ${keyId} by user ${userId}`);

      return { message: 'API key deleted successfully' };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) throw error;
      this.logger.error(`Failed to delete API key ${keyId}:`, error);
      throw new InternalServerErrorException('Failed to delete API key');
    }
  }

  async getApiKeyUsageStats(workspaceId: string, userId: string): Promise<ApiKeyUsageStats> {
    try {
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

      const totalTokensConsumed = apiKeys.reduce(
        (sum, k) => sum + BigInt(k.totalTokens),
        BigInt(0),
      );

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
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      this.logger.error(`Failed to get usage stats for workspace ${workspaceId}:`, error);
      throw new InternalServerErrorException('Failed to fetch usage stats');
    }
  }

  async getUsageMetrics(
    workspaceId: string,
    keyId: string,
    userId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<UsageMetricResponse[]> {
    try {
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
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      this.logger.error(`Failed to get usage metrics for key ${keyId}:`, error);
      throw new InternalServerErrorException('Failed to fetch usage metrics');
    }
  }

  async getDecryptedApiKey(keyId: string, workspaceId: string): Promise<string> {
    try {
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

      return this.decryptApiKey(apiKey.keyHash);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Failed to decrypt API key ${keyId}:`, error);
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
   * Encrypt API key using AES-256-GCM with NEW 12-byte IV format
   * Format: iv:authTag:encrypted
   */
  private encryptApiKey(plaintext: string): string {
    try {
      if (!plaintext || typeof plaintext !== 'string' || plaintext.trim().length === 0) {
        throw new Error('Cannot encrypt empty API key');
      }

      const iv = crypto.randomBytes(this.NEW_IV_LENGTH);
      const cipher = crypto.createCipheriv(this.encryptionAlgorithm, this.encryptionKey, iv);

      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      if (authTag.length !== this.AUTH_TAG_LENGTH) {
        throw new Error(`Invalid auth tag length: ${authTag.length}`);
      }

      const result = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;

      this.logger.debug('API key encrypted successfully with 12-byte IV');
      return result;
    } catch (error) {
      this.logger.error('Encryption failed:', error);
      throw new InternalServerErrorException(
        `Failed to encrypt API key: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Decrypt API key with BACKWARD COMPATIBILITY for both 12-byte and 16-byte IV formats
   * Format: iv:authTag:encrypted
   */
  private decryptApiKey(encryptedData: string): string {
    try {
      if (!encryptedData || typeof encryptedData !== 'string') {
        throw new Error('Invalid encrypted data');
      }

      const parts = encryptedData.split(':');

      if (parts.length !== 3) {
        throw new Error(`Invalid encrypted data format: expected 3 parts, got ${parts.length}`);
      }

      const [ivHex, authTagHex, encrypted] = parts;

      if (!ivHex || !authTagHex || !encrypted) {
        throw new Error('One or more encrypted data components are empty');
      }

      if (
        !/^[0-9a-fA-F]+$/.test(ivHex) ||
        !/^[0-9a-fA-F]+$/.test(authTagHex) ||
        !/^[0-9a-fA-F]+$/.test(encrypted)
      ) {
        throw new Error('Encrypted data contains invalid hexadecimal characters');
      }

      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      const ivLength = iv.length;

      if (ivLength !== this.NEW_IV_LENGTH && ivLength !== this.OLD_IV_LENGTH) {
        throw new Error(
          `Invalid IV length: expected ${this.NEW_IV_LENGTH} bytes (new) or ${this.OLD_IV_LENGTH} bytes (legacy), got ${ivLength} bytes`,
        );
      }

      if (ivLength === this.OLD_IV_LENGTH) {
        this.logger.warn(
          `Decrypting API key with legacy 16-byte IV format. Consider re-encrypting with the new 12-byte format.`,
        );
      }

      if (authTag.length !== this.AUTH_TAG_LENGTH) {
        throw new Error(`Invalid auth tag length: ${authTag.length} bytes`);
      }

      const decipher = crypto.createDecipheriv(this.encryptionAlgorithm, this.encryptionKey, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      if (!decrypted || decrypted.length === 0) {
        throw new Error('Decryption produced empty result');
      }

      this.logger.debug(`API key decrypted successfully (IV length: ${ivLength} bytes)`);
      return decrypted;
    } catch (error) {
      this.logger.error('Decryption failed:', error);

      if (error instanceof Error) {
        if (error.message.includes('Unsupported state') || error.message.includes('auth')) {
          throw new InternalServerErrorException(
            'Authentication failed: API key may be corrupted or tampered with',
          );
        }
        if (error.message.includes('bad decrypt')) {
          throw new InternalServerErrorException(
            'Decryption failed: Incorrect encryption key or corrupted data',
          );
        }
      }

      throw new InternalServerErrorException(
        `Failed to decrypt API key: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
