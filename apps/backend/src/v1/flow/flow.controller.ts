import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { V1FlowService } from './flow.service';
import { GetCurrentUserId } from '../../common/decorators/user';
import { CreateFlowDto } from './dto/create-flow.dto';
import { UpdateFlowDto } from './dto/update-flow.dto';
import { FlowQueryDto } from './dto/flow-query.dto';
import { AddCollaboratorDto } from './dto/add-collaborator.dto';
import { UpdateCollaboratorDto } from './dto/update-collaborator.dto';
import {
  FlowResponseDto,
  FlowPaginatedResponseDto,
  CollaboratorResponseDto,
  ActivityLogResponseDto,
} from './dto/flow-response.dto';

@ApiTags('Flows')
@ApiBearerAuth('JWT')
@Controller({
  path: 'workspaces/:workspaceId/flows',
  version: '1',
})
@ApiUnauthorizedResponse({ description: 'Unauthorized' })
export class V1FlowController {
  constructor(private readonly flowService: V1FlowService) {}

  // ==================== FLOW CRUD ====================

  @Get()
  @ApiOperation({
    summary: 'Get all flows in workspace',
    description:
      'Returns paginated list of flows user has access to (owned, shared, or workspace-visible)',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Flows fetched successfully',
    type: FlowPaginatedResponseDto,
  })
  async getFlows(
    @Param('workspaceId') workspaceId: string,
    @GetCurrentUserId() userId: string,
    @Query(ValidationPipe) query: FlowQueryDto,
  ): Promise<FlowPaginatedResponseDto> {
    return this.flowService.getWorkspaceFlows(workspaceId, userId, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get flow by ID',
    description: 'Returns detailed flow information including pod count and collaborators',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID', type: String })
  @ApiParam({ name: 'id', description: 'Flow ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Flow fetched successfully',
    type: FlowResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Flow not found' })
  @ApiForbiddenResponse({ description: 'Access denied' })
  async getFlow(
    @Param('workspaceId') workspaceId: string,
    @Param('id') flowId: string,
    @GetCurrentUserId() userId: string,
  ): Promise<FlowResponseDto> {
    return this.flowService.getFlowById(flowId, workspaceId, userId);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new flow',
    description: 'Creates a new workflow canvas in the workspace',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID', type: String })
  @ApiResponse({
    status: 201,
    description: 'Flow created successfully',
    type: FlowResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid input or space not found' })
  async createFlow(
    @Param('workspaceId') workspaceId: string,
    @GetCurrentUserId() userId: string,
    @Body(ValidationPipe) dto: CreateFlowDto,
  ): Promise<FlowResponseDto> {
    return this.flowService.createFlow(workspaceId, userId, dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a flow',
    description: 'Updates flow metadata (name, description, space, visibility)',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID', type: String })
  @ApiParam({ name: 'id', description: 'Flow ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Flow updated successfully',
    type: FlowResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Flow not found' })
  @ApiForbiddenResponse({ description: 'Edit permission required' })
  async updateFlow(
    @Param('workspaceId') workspaceId: string,
    @Param('id') flowId: string,
    @GetCurrentUserId() userId: string,
    @Body(ValidationPipe) dto: UpdateFlowDto,
  ): Promise<FlowResponseDto> {
    return this.flowService.updateFlow(flowId, workspaceId, userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a flow',
    description: 'Permanently deletes a flow and all associated data (pods, edges, activity logs)',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID', type: String })
  @ApiParam({ name: 'id', description: 'Flow ID', type: String })
  @ApiResponse({ status: 204, description: 'Flow deleted successfully' })
  @ApiNotFoundResponse({ description: 'Flow not found' })
  @ApiForbiddenResponse({ description: 'Only owner can delete flow' })
  async deleteFlow(
    @Param('workspaceId') workspaceId: string,
    @Param('id') flowId: string,
    @GetCurrentUserId() userId: string,
  ): Promise<void> {
    await this.flowService.deleteFlow(flowId, workspaceId, userId);
  }

  // ==================== COLLABORATORS ====================

  @Get(':id/collaborators')
  @ApiOperation({
    summary: 'Get flow collaborators',
    description: 'Returns list of all users with access to this flow',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID', type: String })
  @ApiParam({ name: 'id', description: 'Flow ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Collaborators fetched successfully',
    type: [CollaboratorResponseDto],
  })
  @ApiForbiddenResponse({ description: 'View permission required' })
  async getCollaborators(
    @Param('workspaceId') workspaceId: string,
    @Param('id') flowId: string,
    @GetCurrentUserId() userId: string,
  ): Promise<CollaboratorResponseDto[]> {
    return this.flowService.getFlowCollaborators(flowId, workspaceId, userId);
  }

  @Post(':id/collaborators')
  @ApiOperation({
    summary: 'Add collaborator to flow',
    description: 'Invites a user to collaborate on this flow',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID', type: String })
  @ApiParam({ name: 'id', description: 'Flow ID', type: String })
  @ApiResponse({
    status: 201,
    description: 'Collaborator added successfully',
    type: CollaboratorResponseDto,
  })
  @ApiBadRequestResponse({ description: 'User not found or already collaborator' })
  @ApiForbiddenResponse({ description: 'Invite permission required' })
  async addCollaborator(
    @Param('workspaceId') workspaceId: string,
    @Param('id') flowId: string,
    @GetCurrentUserId() userId: string,
    @Body(ValidationPipe) dto: AddCollaboratorDto,
  ): Promise<CollaboratorResponseDto> {
    return this.flowService.addCollaborator(flowId, workspaceId, userId, dto);
  }

  @Patch(':id/collaborators/:collaboratorId')
  @ApiOperation({
    summary: 'Update collaborator permissions',
    description: 'Changes access level and granular permissions for a collaborator',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID', type: String })
  @ApiParam({ name: 'id', description: 'Flow ID', type: String })
  @ApiParam({ name: 'collaboratorId', description: 'Collaborator record ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Collaborator permissions updated',
    type: CollaboratorResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Manage permission required' })
  async updateCollaborator(
    @Param('workspaceId') workspaceId: string,
    @Param('id') flowId: string,
    @Param('collaboratorId') collaboratorId: string,
    @GetCurrentUserId() userId: string,
    @Body(ValidationPipe) dto: UpdateCollaboratorDto,
  ): Promise<CollaboratorResponseDto> {
    return this.flowService.updateCollaborator(flowId, collaboratorId, workspaceId, userId, dto);
  }

  @Delete(':id/collaborators/:collaboratorId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove collaborator from flow',
    description: 'Revokes access for a collaborator',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID', type: String })
  @ApiParam({ name: 'id', description: 'Flow ID', type: String })
  @ApiParam({ name: 'collaboratorId', description: 'Collaborator record ID', type: String })
  @ApiResponse({ status: 204, description: 'Collaborator removed successfully' })
  @ApiForbiddenResponse({ description: 'Manage permission required' })
  async removeCollaborator(
    @Param('workspaceId') workspaceId: string,
    @Param('id') flowId: string,
    @Param('collaboratorId') collaboratorId: string,
    @GetCurrentUserId() userId: string,
  ): Promise<void> {
    await this.flowService.removeCollaborator(flowId, collaboratorId, workspaceId, userId);
  }

  // ==================== ACTIVITY LOG ====================

  @Get(':id/activity')
  @ApiOperation({
    summary: 'Get flow activity log',
    description: 'Returns chronological list of all actions performed on this flow',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID', type: String })
  @ApiParam({ name: 'id', description: 'Flow ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Activity log fetched successfully',
    type: [ActivityLogResponseDto],
  })
  async getActivity(
    @Param('workspaceId') workspaceId: string,
    @Param('id') flowId: string,
    @GetCurrentUserId() userId: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<ActivityLogResponseDto[]> {
    return this.flowService.getFlowActivity(flowId, workspaceId, userId, limit);
  }
}
