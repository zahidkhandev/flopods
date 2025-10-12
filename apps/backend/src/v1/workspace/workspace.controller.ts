import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { V1WorkspaceService } from './workspace.service';
import { GetCurrentUserId } from '../../common/decorators/user';
import { WorkspaceCreateDto } from './dto/workspace-create.dto';
import { WorkspaceUpdateDto } from './dto/workspace-update.dto';
import { WorkspaceAddMemberDto } from './dto/workspace-add-member.dto';
import { WorkspaceUpdateMemberDto } from './dto/workspace-update-member.dto';
import { WorkspaceSendInvitationDto } from './dto/workspace-send-invitation.dto';
import { WorkspaceAddApiKeyDto } from './dto/workspace-add-api-key.dto';
import { WorkspaceUpdateApiKeyDto } from './dto/workspace-update-api-key.dto';
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
 * V1 Workspace Controller
 *
 * @description Handles all workspace-related HTTP endpoints including:
 * - Workspace CRUD operations
 * - Member management
 * - Invitation system
 * - API key management for LLM providers
 *
 * @version 1.0.0
 * @author Actopod Team
 * @requires Authentication via JWT Access Token
 */
@ApiTags('Workspaces')
@ApiBearerAuth()
@Controller({ path: 'workspaces', version: '1' })
export class V1WorkspaceController {
  constructor(private readonly workspaceService: V1WorkspaceService) {}

  // ==================== WORKSPACE CRUD ====================

  /**
   * Get all workspaces for current user
   *
   * @description Returns all workspaces where the authenticated user is a member,
   * including role, permissions, and aggregate counts
   *
   * @returns {Promise<WorkspaceListItem[]>} Array of workspaces
   *
   * @example
   * GET /api/v1/workspaces
   * Headers: { Authorization: 'Bearer <access_token>' }
   */
  @Get()
  @ApiOperation({ summary: 'Get all workspaces for current user' })
  @ApiResponse({
    status: 200,
    description: 'Workspaces retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'clx123abc' },
          name: { type: 'string', example: 'My Team Workspace' },
          type: { type: 'string', enum: ['PERSONAL', 'TEAM'] },
          role: { type: 'string', enum: ['OWNER', 'ADMIN', 'MEMBER'] },
          permissions: { type: 'object' },
          memberCount: { type: 'number' },
          canvasCount: { type: 'number' },
        },
      },
    },
  })
  async getAllWorkspaces(@GetCurrentUserId() userId: string): Promise<WorkspaceListItem[]> {
    return this.workspaceService.getAllWorkspaces(userId);
  }

  /**
   * Get workspace details by ID
   *
   * @description Returns complete workspace information including all members,
   * counts, and current user's role/permissions
   *
   * @param {string} id - Workspace ID
   * @returns {Promise<WorkspaceDetails>} Complete workspace data
   *
   * @example
   * GET /api/v1/workspaces/clx123abc
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get workspace details by ID' })
  @ApiResponse({ status: 200, description: 'Workspace details retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Access denied - not a workspace member' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async getWorkspaceById(
    @Param('id') id: string,
    @GetCurrentUserId() userId: string,
  ): Promise<WorkspaceDetails> {
    return this.workspaceService.getWorkspaceById(id, userId);
  }

  /**
   * Create a new workspace
   *
   * @description Creates a new TEAM workspace with creator as OWNER.
   * PERSONAL workspaces are auto-created during registration
   *
   * @param {WorkspaceCreateDto} dto - Workspace creation data
   * @returns {Promise<any>} Created workspace
   *
   * @example
   * POST /api/v1/workspaces
   * Body: { "name": "My Team", "type": "TEAM" }
   */
  @Post()
  @ApiOperation({ summary: 'Create a new workspace (TEAM type only)' })
  @ApiResponse({ status: 201, description: 'Workspace created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input - cannot create PERSONAL workspace' })
  async createWorkspace(
    @Body() dto: WorkspaceCreateDto,
    @GetCurrentUserId() userId: string,
  ): Promise<any> {
    return this.workspaceService.createWorkspace(userId, dto);
  }

  /**
   * Update workspace
   *
   * @description Updates workspace name. Requires canManageMembers permission
   *
   * @param {string} id - Workspace ID
   * @param {WorkspaceUpdateDto} dto - Update data
   * @returns {Promise<any>} Updated workspace
   *
   * @example
   * PATCH /api/v1/workspaces/clx123abc
   * Body: { "name": "Updated Team Name" }
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update workspace name' })
  @ApiResponse({ status: 200, description: 'Workspace updated successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async updateWorkspace(
    @Param('id') id: string,
    @Body() dto: WorkspaceUpdateDto,
    @GetCurrentUserId() userId: string,
  ): Promise<any> {
    return this.workspaceService.updateWorkspace(id, userId, dto);
  }

  /**
   * Delete workspace
   *
   * @description Permanently deletes workspace. Only OWNER can delete.
   * PERSONAL workspaces cannot be deleted
   *
   * @param {string} id - Workspace ID
   * @returns {Promise<MessageResponse>} Success message
   *
   * @example
   * DELETE /api/v1/workspaces/clx123abc
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete workspace (OWNER only, not PERSONAL workspaces)' })
  @ApiResponse({ status: 200, description: 'Workspace deleted successfully' })
  @ApiResponse({ status: 403, description: 'Only owners can delete workspaces' })
  @ApiResponse({ status: 400, description: 'Cannot delete PERSONAL workspace' })
  async deleteWorkspace(
    @Param('id') id: string,
    @GetCurrentUserId() userId: string,
  ): Promise<MessageResponse> {
    return this.workspaceService.deleteWorkspace(id, userId);
  }

  // ==================== MEMBERS ====================

  /**
   * Get workspace members
   *
   * @description Returns all members of a workspace with their roles and permissions
   *
   * @param {string} id - Workspace ID
   * @returns {Promise<WorkspaceMemberResponse[]>} Array of workspace members
   *
   * @example
   * GET /api/v1/workspaces/clx123abc/members
   */
  @Get(':id/members')
  @ApiOperation({ summary: 'Get all members of a workspace' })
  @ApiResponse({ status: 200, description: 'Members retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Not a workspace member' })
  async getMembers(
    @Param('id') id: string,
    @GetCurrentUserId() userId: string,
  ): Promise<WorkspaceMemberResponse[]> {
    return this.workspaceService.getMembers(id, userId);
  }

  /**
   * Add member to workspace
   *
   * @description Adds existing user to workspace by email.
   * Requires canManageMembers permission
   *
   * @param {string} id - Workspace ID
   * @param {WorkspaceAddMemberDto} dto - Member data
   * @returns {Promise<WorkspaceMemberResponse>} Created member record
   *
   * @example
   * POST /api/v1/workspaces/clx123abc/members
   * Body: { "email": "user@example.com", "role": "MEMBER", "canCreateCanvas": true }
   */
  @Post(':id/members')
  @ApiOperation({ summary: 'Add member to workspace (requires canManageMembers)' })
  @ApiResponse({ status: 201, description: 'Member added successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'User already a member' })
  async addMember(
    @Param('id') id: string,
    @Body() dto: WorkspaceAddMemberDto,
    @GetCurrentUserId() userId: string,
  ): Promise<WorkspaceMemberResponse> {
    return this.workspaceService.addMember(id, userId, dto);
  }

  /**
   * Update workspace member
   *
   * @description Updates member's role and permissions. Cannot modify OWNER.
   * Requires canManageMembers permission
   *
   * @param {string} id - Workspace ID
   * @param {string} userId - User ID to update
   * @param {WorkspaceUpdateMemberDto} dto - Update data
   * @returns {Promise<WorkspaceMemberResponse>} Updated member record
   *
   * @example
   * PATCH /api/v1/workspaces/clx123abc/members/user_456
   * Body: { "role": "ADMIN", "canDeleteCanvas": true }
   */
  @Patch(':id/members/:userId')
  @ApiOperation({ summary: 'Update member role and permissions' })
  @ApiResponse({ status: 200, description: 'Member updated successfully' })
  @ApiResponse({ status: 403, description: 'Cannot modify OWNER or insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async updateMember(
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @Body() dto: WorkspaceUpdateMemberDto,
    @GetCurrentUserId() currentUserId: string,
  ): Promise<WorkspaceMemberResponse> {
    return this.workspaceService.updateMember(id, targetUserId, currentUserId, dto);
  }

  /**
   * Remove workspace member
   *
   * @description Removes member from workspace. Cannot remove OWNER.
   * Requires canManageMembers permission
   *
   * @param {string} id - Workspace ID
   * @param {string} userId - User ID to remove
   * @returns {Promise<MessageResponse>} Success message
   *
   * @example
   * DELETE /api/v1/workspaces/clx123abc/members/user_456
   */
  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove member from workspace' })
  @ApiResponse({ status: 200, description: 'Member removed successfully' })
  @ApiResponse({ status: 403, description: 'Cannot remove OWNER or insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async removeMember(
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @GetCurrentUserId() currentUserId: string,
  ): Promise<MessageResponse> {
    return this.workspaceService.removeMember(id, targetUserId, currentUserId);
  }

  // ==================== INVITATIONS ====================

  /**
   * Send workspace invitation
   *
   * @description Sends email invitation to join workspace. Token expires in 7 days.
   * Requires canInviteMembers permission
   *
   * @param {string} id - Workspace ID
   * @param {WorkspaceSendInvitationDto} dto - Invitation data
   * @returns {Promise<InvitationResponse & MessageResponse>} Created invitation
   *
   * @example
   * POST /api/v1/workspaces/clx123abc/invitations
   * Body: { "email": "new@example.com", "role": "MEMBER" }
   */
  @Post(':id/invitations')
  @ApiOperation({ summary: 'Send workspace invitation (requires canInviteMembers)' })
  @ApiResponse({ status: 201, description: 'Invitation sent successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 409, description: 'User already invited or is a member' })
  async sendInvitation(
    @Param('id') id: string,
    @Body() dto: WorkspaceSendInvitationDto,
    @GetCurrentUserId() userId: string,
  ): Promise<InvitationResponse & MessageResponse> {
    return this.workspaceService.sendInvitation(id, userId, dto);
  }

  /**
   * Get pending invitations
   *
   * @description Returns all pending invitations for workspace
   *
   * @param {string} id - Workspace ID
   * @returns {Promise<InvitationResponse[]>} Array of pending invitations
   *
   * @example
   * GET /api/v1/workspaces/clx123abc/invitations
   */
  @Get(':id/invitations')
  @ApiOperation({ summary: 'Get pending invitations for workspace' })
  @ApiResponse({ status: 200, description: 'Invitations retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Not a workspace member' })
  async getInvitations(
    @Param('id') id: string,
    @GetCurrentUserId() userId: string,
  ): Promise<InvitationResponse[]> {
    return this.workspaceService.getInvitations(id, userId);
  }

  /**
   * Accept workspace invitation
   *
   * @description Accepts invitation via token and joins workspace
   *
   * @param {string} token - Invitation token from email
   * @returns {Promise<AcceptInvitationResponse>} Workspace and member info
   *
   * @example
   * POST /api/v1/workspaces/invitations/abc123token/accept
   */
  @Post('invitations/:token/accept')
  @ApiOperation({ summary: 'Accept workspace invitation' })
  @ApiResponse({ status: 200, description: 'Invitation accepted, workspace joined successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired invitation' })
  @ApiResponse({ status: 403, description: 'Email mismatch' })
  @ApiResponse({ status: 409, description: 'Already a member' })
  async acceptInvitation(
    @Param('token') token: string,
    @GetCurrentUserId() userId: string,
  ): Promise<AcceptInvitationResponse> {
    return this.workspaceService.acceptInvitation(token, userId);
  }

  /**
   * Revoke invitation
   *
   * @description Revokes pending invitation. Requires canInviteMembers permission
   *
   * @param {string} id - Workspace ID
   * @param {string} invitationId - Invitation ID
   * @returns {Promise<MessageResponse>} Success message
   *
   * @example
   * DELETE /api/v1/workspaces/clx123abc/invitations/inv_789
   */
  @Delete(':id/invitations/:invitationId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke pending invitation' })
  @ApiResponse({ status: 200, description: 'Invitation revoked successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  async revokeInvitation(
    @Param('id') id: string,
    @Param('invitationId') invitationId: string,
    @GetCurrentUserId() userId: string,
  ): Promise<MessageResponse> {
    return this.workspaceService.revokeInvitation(invitationId, id, userId);
  }

  // ==================== API KEYS ====================

  /**
   * Get workspace API keys
   *
   * @description Returns all API keys for workspace (keyHash excluded).
   * Requires canManageApiKeys permission
   *
   * @param {string} id - Workspace ID
   * @returns {Promise<ApiKeyResponse[]>} Array of API keys
   *
   * @example
   * GET /api/v1/workspaces/clx123abc/api-keys
   */
  @Get(':id/api-keys')
  @ApiOperation({ summary: 'Get all API keys for workspace (requires canManageApiKeys)' })
  @ApiResponse({ status: 200, description: 'API keys retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getApiKeys(
    @Param('id') id: string,
    @GetCurrentUserId() userId: string,
  ): Promise<ApiKeyResponse[]> {
    return this.workspaceService.getApiKeys(id, userId);
  }

  /**
   * Add API key
   *
   * @description Adds encrypted API key for LLM provider.
   * Requires canManageApiKeys permission
   *
   * @param {string} id - Workspace ID
   * @param {WorkspaceAddApiKeyDto} dto - API key data
   * @returns {Promise<ApiKeyResponse>} Created API key
   *
   * @example
   * POST /api/v1/workspaces/clx123abc/api-keys
   * Body: { "provider": "OPENAI", "displayName": "Production", "apiKey": "sk-..." }
   */
  @Post(':id/api-keys')
  @ApiOperation({ summary: 'Add new API key (requires canManageApiKeys)' })
  @ApiResponse({ status: 201, description: 'API key added successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 409, description: 'API key with this name already exists' })
  async addApiKey(
    @Param('id') id: string,
    @Body() dto: WorkspaceAddApiKeyDto,
    @GetCurrentUserId() userId: string,
  ): Promise<ApiKeyResponse> {
    return this.workspaceService.addApiKey(id, userId, dto);
  }

  /**
   * Update API key
   *
   * @description Updates API key properties. If new key provided, it will be re-encrypted.
   * Requires canManageApiKeys permission
   *
   * @param {string} id - Workspace ID
   * @param {string} keyId - API key ID
   * @param {WorkspaceUpdateApiKeyDto} dto - Update data
   * @returns {Promise<ApiKeyResponse>} Updated API key
   *
   * @example
   * PATCH /api/v1/workspaces/clx123abc/api-keys/key_789
   * Body: { "displayName": "Updated Name", "isActive": false }
   */
  @Patch(':id/api-keys/:keyId')
  @ApiOperation({ summary: 'Update API key' })
  @ApiResponse({ status: 200, description: 'API key updated successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'API key not found' })
  async updateApiKey(
    @Param('id') id: string,
    @Param('keyId') keyId: string,
    @Body() dto: WorkspaceUpdateApiKeyDto,
    @GetCurrentUserId() userId: string,
  ): Promise<ApiKeyResponse> {
    return this.workspaceService.updateApiKey(id, keyId, userId, dto);
  }

  /**
   * Delete API key
   *
   * @description Permanently deletes API key. Requires canManageApiKeys permission
   *
   * @param {string} id - Workspace ID
   * @param {string} keyId - API key ID
   * @returns {Promise<MessageResponse>} Success message
   *
   * @example
   * DELETE /api/v1/workspaces/clx123abc/api-keys/key_789
   */
  @Delete(':id/api-keys/:keyId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete API key' })
  @ApiResponse({ status: 200, description: 'API key deleted successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'API key not found' })
  async deleteApiKey(
    @Param('id') id: string,
    @Param('keyId') keyId: string,
    @GetCurrentUserId() userId: string,
  ): Promise<MessageResponse> {
    return this.workspaceService.deleteApiKey(id, keyId, userId);
  }
}
