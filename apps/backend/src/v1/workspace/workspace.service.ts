import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
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
import { WorkspaceType, WorkspaceRole, InvitationStatus, AuthType } from '@actopod/schema';
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
} from './types/workspace.types';

/**
 * Service handling all workspace-related business logic
 *
 * @description Manages workspaces, members, invitations, and API keys with
 * role-based access control and granular permissions
 *
 * @class V1WorkspaceService
 * @version 1.0.0
 * @author Actopod Team
 */
@Injectable()
export class V1WorkspaceService {
  private readonly logger = new Logger(V1WorkspaceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: AwsSesEmailService,
    private readonly configService: ConfigService,
  ) {}

  // ==================== WORKSPACE CRUD ====================

  /**
   * Get all workspaces for the current user
   *
   * @description Retrieves all workspaces where the user is a member,
   * including membership details, role, permissions, and aggregate counts
   *
   * @param {string} userId - Current user ID
   * @returns {Promise<WorkspaceListItem[]>} Array of workspaces with metadata
   *
   * @example
   * const workspaces = await workspaceService.getAllWorkspaces('user_123');
   * // Returns: [{ id: 'ws_1', name: 'My Workspace', type: 'TEAM', ... }]
   */
  async getAllWorkspaces(userId: string): Promise<WorkspaceListItem[]> {
    const workspaceUsers = await this.prisma.workspaceUser.findMany({
      where: { userId },
      include: {
        workspace: {
          include: {
            _count: {
              select: {
                members: true,
                canvases: true,
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
      canvasCount: wu.workspace._count.canvases,
      joinedAt: wu.joinedAt,
      createdAt: wu.workspace.createdAt,
      updatedAt: wu.workspace.updatedAt,
    }));
  }

  /**
   * Get detailed workspace information by ID
   *
   * @description Retrieves complete workspace details including all members,
   * counts, and current user's role/permissions
   *
   * @param {string} workspaceId - Workspace ID
   * @param {string} userId - Current user ID
   * @returns {Promise<WorkspaceDetails>} Complete workspace information
   *
   * @throws {ForbiddenException} If user is not a workspace member
   * @throws {NotFoundException} If workspace doesn't exist
   *
   * @example
   * const workspace = await workspaceService.getWorkspaceById('ws_123', 'user_456');
   */
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
            canvases: true,
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
      ...workspace,
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

  /**
   * Create a new TEAM workspace
   *
   * @description Creates a new workspace with the creator as OWNER with full permissions.
   * PERSONAL workspaces cannot be created via this endpoint (auto-created on registration)
   *
   * @param {string} userId - Creator user ID
   * @param {WorkspaceCreateDto} dto - Workspace creation data
   * @returns {Promise<any>} Created workspace with members
   *
   * @throws {BadRequestException} If attempting to create PERSONAL workspace
   *
   * @example
   * const workspace = await workspaceService.createWorkspace('user_123', {
   *   name: 'My Team',
   *   type: WorkspaceType.TEAM
   * });
   */
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

  /**
   * Update workspace name
   *
   * @description Updates workspace name. Requires canManageMembers permission
   *
   * @param {string} workspaceId - Workspace ID
   * @param {string} userId - Current user ID
   * @param {WorkspaceUpdateDto} dto - Update data
   * @returns {Promise<any>} Updated workspace
   *
   * @throws {ForbiddenException} If user lacks canManageMembers permission
   */
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

  /**
   * Delete workspace
   *
   * @description Permanently deletes workspace. Only OWNER can delete.
   * PERSONAL workspaces cannot be deleted
   *
   * @param {string} workspaceId - Workspace ID
   * @param {string} userId - Current user ID
   * @returns {Promise<MessageResponse>} Success message
   *
   * @throws {ForbiddenException} If user is not OWNER
   * @throws {BadRequestException} If attempting to delete PERSONAL workspace
   * @throws {NotFoundException} If workspace not found
   */
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

  // ==================== MEMBERS ====================

  /**
   * Get all members of a workspace
   *
   * @description Retrieves all workspace members with their roles and permissions
   *
   * @param {string} workspaceId - Workspace ID
   * @param {string} userId - Current user ID
   * @returns {Promise<WorkspaceMemberResponse[]>} Array of workspace members
   *
   * @throws {ForbiddenException} If user is not a workspace member
   */
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

  /**
   * Add existing user to workspace
   *
   * @description Adds a user to workspace by email. Requires canManageMembers permission
   *
   * @param {string} workspaceId - Workspace ID
   * @param {string} userId - Current user ID (manager)
   * @param {WorkspaceAddMemberDto} dto - Member data
   * @returns {Promise<WorkspaceMemberResponse>} Created member record
   *
   * @throws {ForbiddenException} If user lacks canManageMembers permission
   * @throws {NotFoundException} If target user not found
   * @throws {ConflictException} If user already a member
   */
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

    this.logger.log(`Member added to workspace ${workspaceId}: ${targetUser.email}`);
    return member as WorkspaceMemberResponse;
  }

  /**
   * Update member role and permissions
   *
   * @description Updates existing member's role and permissions.
   * Cannot modify workspace OWNER
   *
   * @param {string} workspaceId - Workspace ID
   * @param {string} targetUserId - User ID to update
   * @param {string} currentUserId - Current user ID (manager)
   * @param {WorkspaceUpdateMemberDto} dto - Update data
   * @returns {Promise<WorkspaceMemberResponse>} Updated member record
   *
   * @throws {ForbiddenException} If attempting to modify OWNER or lacking permission
   * @throws {NotFoundException} If member not found
   */
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

    this.logger.log(`Member updated in workspace ${workspaceId}: ${targetUserId}`);
    return updatedMember as WorkspaceMemberResponse;
  }

  /**
   * Remove member from workspace
   *
   * @description Removes a member from workspace. Cannot remove OWNER.
   * Requires canManageMembers permission
   *
   * @param {string} workspaceId - Workspace ID
   * @param {string} targetUserId - User ID to remove
   * @param {string} currentUserId - Current user ID (manager)
   * @returns {Promise<MessageResponse>} Success message
   *
   * @throws {ForbiddenException} If attempting to remove OWNER or lacking permission
   * @throws {NotFoundException} If member not found
   */
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

    this.logger.log(`Member removed from workspace ${workspaceId}: ${targetUserId}`);
    return { message: 'Member removed successfully' };
  }

  // ==================== INVITATIONS ====================

  /**
   * Send workspace invitation via email
   *
   * @description Sends email invitation to join workspace. Token expires in 7 days.
   * Requires canInviteMembers permission
   *
   * @param {string} workspaceId - Workspace ID
   * @param {string} userId - Current user ID (inviter)
   * @param {WorkspaceSendInvitationDto} dto - Invitation data
   * @returns {Promise<InvitationResponse & MessageResponse>} Created invitation with success message
   *
   * @throws {ForbiddenException} If user lacks canInviteMembers permission
   * @throws {NotFoundException} If workspace not found
   * @throws {ConflictException} If user already member or already invited
   */
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

    this.logger.log(`Invitation sent for workspace ${workspaceId} to ${dto.email}`);
    return {
      ...(invitation as InvitationResponse),
      message: 'Invitation sent successfully',
    };
  }

  /**
   * Get all pending invitations for workspace
   *
   * @description Retrieves all pending invitations for a workspace
   *
   * @param {string} workspaceId - Workspace ID
   * @param {string} userId - Current user ID
   * @returns {Promise<InvitationResponse[]>} Array of pending invitations
   *
   * @throws {ForbiddenException} If user is not a workspace member
   */
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

  /**
   * Accept workspace invitation
   *
   * @description Accepts invitation via token and adds user to workspace.
   * Validates email match and expiration
   *
   * @param {string} token - Invitation token
   * @param {string} userId - Current user ID
   * @returns {Promise<AcceptInvitationResponse>} Workspace, member info, and success message
   *
   * @throws {NotFoundException} If invitation not found
   * @throws {BadRequestException} If invitation invalid or expired
   * @throws {ForbiddenException} If email mismatch
   * @throws {ConflictException} If already a member
   */
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

    this.logger.log(`Invitation accepted: ${token} by user ${userId}`);
    return {
      workspace: invitation.workspace,
      member,
      message: 'Successfully joined workspace',
    };
  }

  /**
   * Revoke pending invitation
   *
   * @description Revokes a pending invitation. Requires canInviteMembers permission
   *
   * @param {string} invitationId - Invitation ID
   * @param {string} workspaceId - Workspace ID
   * @param {string} userId - Current user ID
   * @returns {Promise<MessageResponse>} Success message
   *
   * @throws {ForbiddenException} If user lacks canInviteMembers permission
   * @throws {NotFoundException} If invitation not found
   */
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

  /**
   * Get all API keys for workspace
   *
   * @description Retrieves all API keys (keyHash excluded for security).
   * Requires canManageApiKeys permission
   *
   * @param {string} workspaceId - Workspace ID
   * @param {string} userId - Current user ID
   * @returns {Promise<ApiKeyResponse[]>} Array of API keys
   *
   * @throws {ForbiddenException} If user lacks canManageApiKeys permission
   */
  async getApiKeys(workspaceId: string, userId: string): Promise<ApiKeyResponse[]> {
    await this.verifyPermission(workspaceId, userId, 'canManageApiKeys');

    const apiKeys = await this.prisma.providerAPIKey.findMany({
      where: { workspaceId },
      select: {
        id: true,
        provider: true,
        displayName: true,
        endpoint: true,
        authType: true,
        providerConfig: true,
        isActive: true,
        lastUsedAt: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return apiKeys as ApiKeyResponse[];
  }

  /**
   * Add new API key to workspace
   *
   * @description Adds encrypted API key for LLM provider.
   * Requires canManageApiKeys permission
   *
   * @param {string} workspaceId - Workspace ID
   * @param {string} userId - Current user ID
   * @param {WorkspaceAddApiKeyDto} dto - API key data
   * @returns {Promise<ApiKeyResponse>} Created API key (without keyHash)
   *
   * @throws {ForbiddenException} If user lacks canManageApiKeys permission
   * @throws {ConflictException} If API key name already exists for provider
   */
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

    const keyHash = this.encryptApiKey(dto.apiKey);

    const apiKey = await this.prisma.providerAPIKey.create({
      data: {
        workspaceId,
        provider: dto.provider,
        displayName: dto.displayName,
        keyHash,
        endpoint: dto.endpoint,
        authType: dto.authType ?? AuthType.BEARER_TOKEN,
        providerConfig: dto.providerConfig as any,
      },
      select: {
        id: true,
        provider: true,
        displayName: true,
        endpoint: true,
        authType: true,
        providerConfig: true,
        isActive: true,
        createdAt: true,
      },
    });

    this.logger.log(
      `API key added to workspace ${workspaceId}: ${dto.provider}/${dto.displayName}`,
    );
    return apiKey as ApiKeyResponse;
  }

  /**
   * Update existing API key
   *
   * @description Updates API key properties. If new key provided, it will be re-encrypted.
   * Requires canManageApiKeys permission
   *
   * @param {string} workspaceId - Workspace ID
   * @param {string} keyId - API key ID
   * @param {string} userId - Current user ID
   * @param {WorkspaceUpdateApiKeyDto} dto - Update data
   * @returns {Promise<ApiKeyResponse>} Updated API key
   *
   * @throws {ForbiddenException} If user lacks canManageApiKeys permission
   * @throws {NotFoundException} If API key not found
   */
  async updateApiKey(
    workspaceId: string,
    keyId: string,
    userId: string,
    dto: WorkspaceUpdateApiKeyDto,
  ): Promise<ApiKeyResponse> {
    await this.verifyPermission(workspaceId, userId, 'canManageApiKeys');

    const existing = await this.prisma.providerAPIKey.findUnique({
      where: { id: keyId },
    });

    if (!existing || existing.workspaceId !== workspaceId) {
      throw new NotFoundException('API key not found');
    }

    const updateData: any = { ...dto };

    if (dto.apiKey) {
      updateData.keyHash = this.encryptApiKey(dto.apiKey);
      delete updateData.apiKey;
    }

    const apiKey = await this.prisma.providerAPIKey.update({
      where: { id: keyId },
      data: updateData,
      select: {
        id: true,
        provider: true,
        displayName: true,
        endpoint: true,
        authType: true,
        providerConfig: true,
        isActive: true,
        createdAt: true,
        expiresAt: true,
      },
    });

    this.logger.log(`API key updated in workspace ${workspaceId}: ${keyId}`);
    return apiKey as ApiKeyResponse;
  }

  /**
   * Delete API key from workspace
   *
   * @description Permanently deletes API key. Requires canManageApiKeys permission
   *
   * @param {string} workspaceId - Workspace ID
   * @param {string} keyId - API key ID
   * @param {string} userId - Current user ID
   * @returns {Promise<MessageResponse>} Success message
   *
   * @throws {ForbiddenException} If user lacks canManageApiKeys permission
   * @throws {NotFoundException} If API key not found
   */
  async deleteApiKey(workspaceId: string, keyId: string, userId: string): Promise<MessageResponse> {
    await this.verifyPermission(workspaceId, userId, 'canManageApiKeys');

    const existing = await this.prisma.providerAPIKey.findUnique({
      where: { id: keyId },
    });

    if (!existing || existing.workspaceId !== workspaceId) {
      throw new NotFoundException('API key not found');
    }

    await this.prisma.providerAPIKey.delete({
      where: { id: keyId },
    });

    this.logger.log(`API key deleted from workspace ${workspaceId}: ${keyId}`);
    return { message: 'API key deleted successfully' };
  }

  // ==================== PRIVATE HELPERS ====================

  /**
   * Verify user is a member of workspace
   *
   * @private
   * @param {string} workspaceId - Workspace ID
   * @param {string} userId - User ID
   * @returns {Promise<any>} Workspace member record
   * @throws {ForbiddenException} If user is not a member
   */
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

  /**
   * Verify user has specific permission in workspace
   *
   * @private
   * @description OWNER role bypasses all permission checks
   * @param {string} workspaceId - Workspace ID
   * @param {string} userId - User ID
   * @param {string} permission - Permission to check
   * @returns {Promise<any>} Workspace member record
   * @throws {ForbiddenException} If user lacks required permission
   */
  private async verifyPermission(
    workspaceId: string,
    userId: string,
    permission:
      | 'canCreateCanvas'
      | 'canDeleteCanvas'
      | 'canManageBilling'
      | 'canInviteMembers'
      | 'canManageMembers'
      | 'canManageApiKeys',
  ): Promise<any> {
    const member = await this.verifyMembership(workspaceId, userId);

    if (!member[permission] && member.role !== WorkspaceRole.OWNER) {
      throw new ForbiddenException('You do not have permission to perform this action');
    }

    return member;
  }

  /**
   * Encrypt API key using AES-256-GCM
   *
   * @private
   * @param {string} apiKey - Plain text API key
   * @returns {string} Encrypted string in format: iv:authTag:encrypted
   */
  private encryptApiKey(apiKey: string): string {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(this.configService.get('API_KEY_ENCRYPTION_SECRET')!, 'hex');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);

    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }
}
