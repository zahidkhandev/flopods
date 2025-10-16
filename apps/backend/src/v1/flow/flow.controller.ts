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
} from '@nestjs/swagger';
import { V1FlowService } from './flow.service';
import { GetCurrentUserId } from '../../common/decorators/user';
import { CreateFlowDto } from './dto/create-flow.dto';
import { UpdateFlowDto } from './dto/update-flow.dto';
import { FlowQueryDto } from './dto/flow-query.dto';
import { FlowResponseDto, FlowPaginatedResponseDto } from './dto/flow-response.dto';

@ApiTags('Flows')
@ApiBearerAuth('JWT')
@Controller({
  path: 'workspaces/:workspaceId/flows',
  version: '1',
})
@ApiUnauthorizedResponse({ description: 'Unauthorized' })
export class V1FlowController {
  constructor(private readonly flowService: V1FlowService) {}

  @Get()
  @ApiOperation({ summary: 'Get all flows in workspace' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiResponse({ status: 200, type: FlowPaginatedResponseDto })
  async getFlows(
    @Param('workspaceId') workspaceId: string,
    @GetCurrentUserId() userId: string,
    @Query(ValidationPipe) query: FlowQueryDto,
  ): Promise<FlowPaginatedResponseDto> {
    return this.flowService.getWorkspaceFlows(workspaceId, userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get flow by ID' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiParam({ name: 'id', description: 'Flow ID' })
  @ApiResponse({ status: 200, type: FlowResponseDto })
  @ApiNotFoundResponse({ description: 'Flow not found' })
  async getFlow(
    @Param('workspaceId') workspaceId: string,
    @Param('id') flowId: string,
    @GetCurrentUserId() userId: string,
  ): Promise<FlowResponseDto> {
    return this.flowService.getFlowById(flowId, workspaceId, userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new flow' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiResponse({ status: 201, type: FlowResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid input' })
  async createFlow(
    @Param('workspaceId') workspaceId: string,
    @GetCurrentUserId() userId: string,
    @Body(ValidationPipe) dto: CreateFlowDto,
  ): Promise<FlowResponseDto> {
    return this.flowService.createFlow(workspaceId, userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a flow' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiParam({ name: 'id', description: 'Flow ID' })
  @ApiResponse({ status: 200, type: FlowResponseDto })
  @ApiNotFoundResponse({ description: 'Flow not found' })
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
  @ApiOperation({ summary: 'Delete a flow' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiParam({ name: 'id', description: 'Flow ID' })
  @ApiResponse({ status: 204, description: 'Flow deleted' })
  @ApiNotFoundResponse({ description: 'Flow not found' })
  async deleteFlow(
    @Param('workspaceId') workspaceId: string,
    @Param('id') flowId: string,
    @GetCurrentUserId() userId: string,
  ): Promise<void> {
    await this.flowService.deleteFlow(flowId, workspaceId, userId);
  }
}
