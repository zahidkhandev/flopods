// src/modules/workspace/workspace.controller.ts

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
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { V1WorkspaceService } from './workspace.service';
import { GetCurrentUserId } from '../../common/decorators/user';
import { WorkspaceCreateDto } from './dto/workspace-create.dto';
import { WorkspaceUpdateDto } from './dto/workspace-update.dto';
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
  MessageResponse,
  UsageMetricResponse,
  ApiKeyUsageStats,
} from './types/workspace.types';
import { Public } from '../../common/decorators/common';

@ApiTags('Workspaces')
@ApiBearerAuth()
@Controller({ path: 'workspaces', version: '1' })
export class V1WorkspaceController {
  constructor(private readonly workspaceService: V1WorkspaceService) {}

  @Get()
  @ApiOperation({
    summary: 'List all workspaces for current user',
    description:
      'Retrieves all workspaces where the user is a member, ordered by join date (newest first)',
  })
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
          type: { type: 'string', enum: ['PERSONAL', 'TEAM'], example: 'TEAM' },
          role: { type: 'string', enum: ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'], example: 'OWNER' },
          permissions: {
            type: 'object',
            properties: {
              canCreateCanvas: { type: 'boolean' },
              canDeleteCanvas: { type: 'boolean' },
              canManageBilling: { type: 'boolean' },
              canInviteMembers: { type: 'boolean' },
              canManageMembers: { type: 'boolean' },
              canManageApiKeys: { type: 'boolean' },
            },
          },
          memberCount: { type: 'number', example: 5 },
          canvasCount: { type: 'number', example: 12 },
          joinedAt: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token' })
  async getAllWorkspaces(@GetCurrentUserId() userId: string): Promise<WorkspaceListItem[]> {
    return this.workspaceService.getAllWorkspaces(userId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get workspace details by ID',
    description:
      'Retrieves detailed workspace information including members, counts, and permissions',
  })
  @ApiParam({ name: 'id', description: 'Workspace ID (CUID)', example: 'clx123abc' })
  @ApiResponse({ status: 200, description: 'Workspace details retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not a workspace member' })
  @ApiResponse({ status: 404, description: 'Not Found - Workspace does not exist' })
  async getWorkspaceById(
    @Param('id') id: string,
    @GetCurrentUserId() userId: string,
  ): Promise<WorkspaceDetails> {
    return this.workspaceService.getWorkspaceById(id, userId);
  }

  @Get(':id/stats')
  @ApiOperation({
    summary: 'Get workspace statistics and analytics',
    description: 'Retrieves aggregate counts and role distribution for workspace',
  })
  @ApiParam({ name: 'id', description: 'Workspace ID', example: 'clx123abc' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not a workspace member' })
  @ApiResponse({ status: 404, description: 'Not Found - Workspace does not exist' })
  async getWorkspaceStats(@Param('id') id: string, @GetCurrentUserId() userId: string) {
    return this.workspaceService.getWorkspaceStats(id, userId);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new workspace',
    description:
      'Creates a new TEAM workspace with creator as OWNER (PERSONAL workspaces auto-created)',
  })
  @ApiResponse({ status: 201, description: 'Workspace created successfully' })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid input or PERSONAL workspace attempt',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createWorkspace(
    @Body() dto: WorkspaceCreateDto,
    @GetCurrentUserId() userId: string,
  ): Promise<any> {
    return this.workspaceService.createWorkspace(userId, dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update workspace name',
    description: 'Updates workspace name (requires canManageMembers permission)',
  })
  @ApiParam({ name: 'id', description: 'Workspace ID', example: 'clx123abc' })
  @ApiResponse({ status: 200, description: 'Workspace updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Not Found - Workspace does not exist' })
  async updateWorkspace(
    @Param('id') id: string,
    @Body() dto: WorkspaceUpdateDto,
    @GetCurrentUserId() userId: string,
  ): Promise<any> {
    return this.workspaceService.updateWorkspace(id, userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete workspace',
    description: 'Permanently deletes workspace (OWNER only, not PERSONAL workspaces)',
  })
  @ApiParam({ name: 'id', description: 'Workspace ID', example: 'clx123abc' })
  @ApiResponse({ status: 200, description: 'Workspace deleted successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request - Cannot delete PERSONAL workspace' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only OWNER can delete' })
  @ApiResponse({ status: 404, description: 'Not Found - Workspace does not exist' })
  async deleteWorkspace(
    @Param('id') id: string,
    @GetCurrentUserId() userId: string,
  ): Promise<MessageResponse> {
    return this.workspaceService.deleteWorkspace(id, userId);
  }

  @Post(':id/transfer-ownership/:userId')
  @ApiOperation({
    summary: 'Transfer workspace ownership',
    description: 'Transfers ownership to another member (current OWNER becomes ADMIN)',
  })
  @ApiParam({ name: 'id', description: 'Workspace ID', example: 'clx123abc' })
  @ApiParam({ name: 'userId', description: 'New owner user ID', example: 'user_456' })
  @ApiResponse({ status: 200, description: 'Ownership transferred successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only OWNER can transfer' })
  @ApiResponse({ status: 404, description: 'Not Found - Workspace or user not found' })
  async transferOwnership(
    @Param('id') id: string,
    @Param('userId') newOwnerId: string,
    @GetCurrentUserId() currentUserId: string,
  ) {
    return this.workspaceService.transferOwnership(id, currentUserId, newOwnerId);
  }

  // ==========================================
  // MEMBER MANAGEMENT
  // ==========================================

  @Get(':id/members')
  @ApiOperation({
    summary: 'List all workspace members',
    description: 'Retrieves all members with roles, permissions, and profile info',
  })
  @ApiParam({ name: 'id', description: 'Workspace ID', example: 'clx123abc' })
  @ApiResponse({ status: 200, description: 'Members retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not a workspace member' })
  @ApiResponse({ status: 404, description: 'Not Found - Workspace does not exist' })
  async getMembers(
    @Param('id') id: string,
    @GetCurrentUserId() userId: string,
  ): Promise<WorkspaceMemberResponse[]> {
    return this.workspaceService.getMembers(id, userId);
  }

  @Patch(':id/members/:userId')
  @ApiOperation({
    summary: 'Update member role and permissions',
    description: 'Updates member role/permissions (cannot modify OWNER, requires canManageMembers)',
  })
  @ApiParam({ name: 'id', description: 'Workspace ID', example: 'clx123abc' })
  @ApiParam({ name: 'userId', description: 'Target user ID', example: 'user_456' })
  @ApiResponse({ status: 200, description: 'Member updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Cannot modify OWNER or insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Not Found - Member not found' })
  async updateMember(
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @Body() dto: WorkspaceUpdateMemberDto,
    @GetCurrentUserId() currentUserId: string,
  ): Promise<WorkspaceMemberResponse> {
    return this.workspaceService.updateMember(id, targetUserId, currentUserId, dto);
  }

  /**
   * Remove member from workspace
   *
   * @description Removes a member from the workspace. Cannot remove workspace
   * OWNER. Auto-converts TEAM workspace to PERSONAL if only 1 member remains.
   * Requires `canManageMembers` permission.
   *
   * @param {string} id - Workspace unique identifier
   * @param {string} targetUserId - User ID of member to remove
   * @returns {Promise<MessageResponse>} Success confirmation message
   *
   * @throws {401} Unauthorized - Invalid or missing JWT token
   * @throws {403} Forbidden - Cannot remove OWNER or insufficient permissions
   * @throws {404} Not Found - Member not found
   *
   * @example
   * ```
   * DELETE /api/v1/workspaces/clx123abc/members/user_456
   * Authorization: Bearer <your_jwt_token>
   * ```
   */
  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Remove member from workspace',
    description: 'Removes member (cannot remove OWNER, requires canManageMembers)',
  })
  @ApiParam({ name: 'id', description: 'Workspace ID', example: 'clx123abc' })
  @ApiParam({ name: 'userId', description: 'Target user ID', example: 'user_456' })
  @ApiResponse({ status: 200, description: 'Member removed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Cannot remove OWNER or insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Not Found - Member not found' })
  async removeMember(
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @GetCurrentUserId() currentUserId: string,
  ): Promise<MessageResponse> {
    return this.workspaceService.removeMember(id, targetUserId, currentUserId);
  }

  @Post(':id/invitations')
  @ApiOperation({
    summary: 'Send workspace invitation',
    description: 'Sends email invitation with 7-day token (requires canInviteMembers)',
  })
  @ApiParam({ name: 'id', description: 'Workspace ID', example: 'clx123abc' })
  @ApiResponse({ status: 201, description: 'Invitation sent successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Not Found - Workspace does not exist' })
  @ApiResponse({ status: 409, description: 'Conflict - User already invited or is member' })
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
   * @description Retrieves all pending invitations for the workspace.
   * Shows email, role, permissions, expiration date, and invitation status.
   * Ordered by creation date (newest first).
   *
   * @param {string} id - Workspace unique identifier
   * @returns {Promise<InvitationResponse[]>} Array of pending invitations
   *
   * @throws {401} Unauthorized - Invalid or missing JWT token
   * @throws {403} Forbidden - User is not a workspace member
   * @throws {404} Not Found - Workspace does not exist
   *
   * @example
   * ```
   * GET /api/v1/workspaces/clx123abc/invitations
   * Authorization: Bearer <your_jwt_token>
   * ```
   */
  @Get(':id/invitations')
  @ApiOperation({
    summary: 'List pending invitations',
    description: 'Retrieves all pending workspace invitations',
  })
  @ApiParam({ name: 'id', description: 'Workspace ID', example: 'clx123abc' })
  @ApiResponse({ status: 200, description: 'Invitations retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not a workspace member' })
  @ApiResponse({ status: 404, description: 'Not Found - Workspace does not exist' })
  async getInvitations(
    @Param('id') id: string,
    @GetCurrentUserId() userId: string,
  ): Promise<InvitationResponse[]> {
    return this.workspaceService.getInvitations(id, userId);
  }

  /**
   * GET INVITATION DETAILS (PUBLIC - No Auth Required)
   * This endpoint should be accessible without authentication
   */
  @Get('invitations/:token/details')
  @Public()
  @ApiOperation({
    summary: 'Get invitation details (public)',
    description:
      'Get workspace invitation details for preview before acceptance. No authentication required.',
  })
  @ApiParam({
    name: 'token',
    description: 'Invitation token',
    example: 'ff08ff32428b36add715719515d133d806ae0b759792952dd6815931827cc92d',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Invitation details retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Invitation not found',
  })
  async getInvitationDetails(@Param('token') token: string) {
    return this.workspaceService.getInvitationDetails(token);
  }

  @Post('invitations/:token/accept')
  @ApiOperation({
    summary: 'Accept workspace invitation',
    description: 'Accept a workspace invitation and join the workspace. Requires authentication.',
  })
  @ApiParam({
    name: 'token',
    description: 'Invitation token',
    example: 'ff08ff32428b36add715719515d133d806ae0b759792952dd6815931827cc92d',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Invitation accepted successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invitation is invalid, expired, or already used',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Email mismatch - invitation sent to different email',
  })
  async acceptInvitation(@Param('token') token: string, @GetCurrentUserId() userId: string) {
    return this.workspaceService.acceptInvitation(token, userId);
  }

  @Delete(':id/invitations/:invitationId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revoke pending invitation',
    description: 'Revokes invitation (requires canInviteMembers)',
  })
  @ApiParam({ name: 'id', description: 'Workspace ID', example: 'clx123abc' })
  @ApiParam({ name: 'invitationId', description: 'Invitation ID', example: 'inv_789' })
  @ApiResponse({ status: 200, description: 'Invitation revoked successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Not Found - Invitation not found' })
  async revokeInvitation(
    @Param('id') id: string,
    @Param('invitationId') invitationId: string,
    @GetCurrentUserId() userId: string,
  ): Promise<MessageResponse> {
    return this.workspaceService.revokeInvitation(invitationId, id, userId);
  }

  // ==========================================
  // API KEY MANAGEMENT (LLM PROVIDERS)
  // ==========================================

  @Get(':id/api-keys/stats')
  @ApiOperation({
    summary: 'Get API key usage statistics',
    description: 'Retrieves aggregate stats for all workspace API keys',
  })
  @ApiParam({ name: 'id', description: 'Workspace ID', example: 'clx123abc' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Not Found - Workspace does not exist' })
  async getApiKeyUsageStats(
    @Param('id') id: string,
    @GetCurrentUserId() userId: string,
  ): Promise<ApiKeyUsageStats> {
    return this.workspaceService.getApiKeyUsageStats(id, userId);
  }

  /**
   * Get all workspace API keys
   *
   * @description Retrieves all API keys for the workspace with usage metrics.
   * Excludes sensitive keyHash for security. Includes status, usage statistics,
   * and creator info. Requires `canManageApiKeys` permission.
   *
   * @param {string} id - Workspace unique identifier
   * @returns {Promise<ApiKeyResponse[]>} Array of API keys
   *
   * @throws {401} Unauthorized - Invalid or missing JWT token
   * @throws {403} Forbidden - Insufficient permissions (requires canManageApiKeys)
   * @throws {404} Not Found - Workspace does not exist
   *
   * @example
   * ```
   * GET /api/v1/workspaces/clx123abc/api-keys
   * Authorization: Bearer <your_jwt_token>
   * ```
   */
  @Get(':id/api-keys')
  @ApiOperation({
    summary: 'List all workspace API keys',
    description: 'Retrieves all API keys with usage metrics (excludes keyHash for security)',
  })
  @ApiParam({ name: 'id', description: 'Workspace ID', example: 'clx123abc' })
  @ApiResponse({ status: 200, description: 'API keys retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Not Found - Workspace does not exist' })
  async getApiKeys(
    @Param('id') id: string,
    @GetCurrentUserId() userId: string,
  ): Promise<ApiKeyResponse[]> {
    return this.workspaceService.getApiKeys(id, userId);
  }

  /**
   * Get daily usage metrics for API key
   *
   * @description Retrieves time-series usage metrics for a specific API key,
   * aggregated by day. Includes request counts, token consumption, cost estimates.
   * Requires `canManageApiKeys` permission.
   *
   * @param {string} id - Workspace unique identifier
   * @param {string} keyId - API key unique identifier
   * @param {string} startDate - Start date (ISO 8601, optional)
   * @param {string} endDate - End date (ISO 8601, optional)
   * @returns {Promise<UsageMetricResponse[]>} Array of daily metrics (last 30 days)
   *
   * @throws {401} Unauthorized - Invalid or missing JWT token
   * @throws {403} Forbidden - Insufficient permissions (requires canManageApiKeys)
   * @throws {404} Not Found - Workspace or API key does not exist
   *
   * @example
   */
  @Get(':id/api-keys/:keyId/metrics')
  @ApiOperation({
    summary: 'Get daily usage metrics for API key',
    description: 'Retrieves time-series usage data (requests, tokens, cost)',
  })
  @ApiParam({ name: 'id', description: 'Workspace ID', example: 'clx123abc' })
  @ApiParam({ name: 'keyId', description: 'API key ID', example: 'key_789' })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Start date (ISO 8601)',
    example: '2025-10-01',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'End date (ISO 8601)',
    example: '2025-10-15',
  })
  @ApiResponse({ status: 200, description: 'Usage metrics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Not Found - Workspace or API key not found' })
  async getUsageMetrics(
    @Param('id') id: string,
    @Param('keyId') keyId: string,
    @GetCurrentUserId() userId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<UsageMetricResponse[]> {
    return this.workspaceService.getUsageMetrics(
      id,
      keyId,
      userId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  /**
   * Add new API key
   *
   * @description Adds an encrypted API key for an LLM provider.
   * Requires `canManageApiKeys` permission.
   *
   * @param {string} id - Workspace unique identifier
   * @param {WorkspaceAddApiKeyDto} dto - API key data (provider, key, name)
   * @returns {Promise<ApiKeyResponse>} Created API key (excludes keyHash)
   *
   * @throws {400} Bad Request - Invalid input
   * @throws {401} Unauthorized - Invalid or missing JWT token
   * @throws {403} Forbidden - Insufficient permissions (requires canManageApiKeys)
   * @throws {404} Not Found - Workspace does not exist
   * @throws {409} Conflict - API key name already exists for provider
   *
   * @example
   * ```
   * POST /api/v1/workspaces/clx123abc/api-keys
   * Content-Type: application/json
   * Authorization: Bearer <your_jwt_token>
   *
   * {
   *   "provider": "OPENAI",
   *   "displayName": "Production Key",
   *   "apiKey": "sk-proj-abc123..."
   * }
   * ```
   */
  @Post(':id/api-keys')
  @ApiOperation({
    summary: 'Add new API key',
    description: 'Adds encrypted LLM provider API key',
  })
  @ApiParam({ name: 'id', description: 'Workspace ID', example: 'clx123abc' })
  @ApiResponse({ status: 201, description: 'API key added successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Not Found - Workspace does not exist' })
  @ApiResponse({ status: 409, description: 'Conflict - API key name already exists' })
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
   * @description Updates API key properties. Can rotate the key value (re-encrypts).
   * Requires `canManageApiKeys` permission.
   *
   * @param {string} id - Workspace unique identifier
   * @param {string} keyId - API key unique identifier
   * @param {WorkspaceUpdateApiKeyDto} dto - Update data
   * @returns {Promise<ApiKeyResponse>} Updated API key
   *
   * @throws {400} Bad Request - Invalid input
   * @throws {401} Unauthorized - Invalid or missing JWT token
   * @throws {403} Forbidden - Insufficient permissions (requires canManageApiKeys)
   * @throws {404} Not Found - API key not found
   *
   * @example
   * ```
   * PATCH /api/v1/workspaces/clx123abc/api-keys/key_789
   * Content-Type: application/json
   * Authorization: Bearer <your_jwt_token>
   *
   * {
   *   "displayName": "Updated Production Key",
   *   "isActive": false
   * }
   * ```
   */
  @Patch(':id/api-keys/:keyId')
  @ApiOperation({
    summary: 'Update API key',
    description: 'Updates API key properties (can rotate key, requires canManageApiKeys)',
  })
  @ApiParam({ name: 'id', description: 'Workspace ID', example: 'clx123abc' })
  @ApiParam({ name: 'keyId', description: 'API key ID', example: 'key_789' })
  @ApiResponse({ status: 200, description: 'API key updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Not Found - API key not found' })
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
   * @description Permanently deletes an API key. This action cannot be undone.
   * Requires `canManageApiKeys` permission.
   *
   * @param {string} id - Workspace unique identifier
   * @param {string} keyId - API key unique identifier
   * @returns {Promise<MessageResponse>} Success confirmation message
   *
   * @throws {401} Unauthorized - Invalid or missing JWT token
   * @throws {403} Forbidden - Insufficient permissions (requires canManageApiKeys)
   * @throws {404} Not Found - API key not found
   *
   * @example
   * ```
   * DELETE /api/v1/workspaces/clx123abc/api-keys/key_789
   * Authorization: Bearer <your_jwt_token>
   * ```
   *
   * @example Response
   * ```
   * {
   *   "message": "API key deleted successfully"
   * }
   * ```
   */
  @Delete(':id/api-keys/:keyId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete API key',
    description: 'Permanently deletes API key (requires canManageApiKeys)',
  })
  @ApiParam({ name: 'id', description: 'Workspace ID', example: 'clx123abc' })
  @ApiParam({ name: 'keyId', description: 'API key ID', example: 'key_789' })
  @ApiResponse({ status: 200, description: 'API key deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Not Found - API key not found' })
  async deleteApiKey(
    @Param('id') id: string,
    @Param('keyId') keyId: string,
    @GetCurrentUserId() userId: string,
  ): Promise<MessageResponse> {
    return this.workspaceService.deleteApiKey(id, keyId, userId);
  }
}
