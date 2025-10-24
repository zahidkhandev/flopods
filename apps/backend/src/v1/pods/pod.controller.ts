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
import { V1PodService } from './pod.service';
import { V1EdgeService } from './edge.service';
import { GetCurrentUserId } from '../../common/decorators/user';
import { CreatePodDto } from './dto/create-pod.dto';
import { UpdatePodDto } from './dto/update-pod.dto';
import { CreateEdgeDto } from './dto/create-edge.dto';
import { PodResponseDto, EdgeResponseDto, FlowCanvasResponseDto } from './dto/pod-response.dto';

@ApiTags('Pods & Edges')
@ApiBearerAuth('JWT')
@Controller({
  path: 'workspaces/:workspaceId/flows/:flowId/canvas',
  version: '1',
})
@ApiUnauthorizedResponse({ description: 'Unauthorized' })
export class V1PodController {
  constructor(
    private readonly podService: V1PodService,
    private readonly edgeService: V1EdgeService,
  ) {}

  // ==================== CANVAS ====================

  @Get()
  @ApiOperation({ summary: 'Get complete canvas (pods + edges)' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiParam({ name: 'flowId', description: 'Flow ID' })
  @ApiResponse({ status: 200, type: FlowCanvasResponseDto })
  async getCanvas(
    @Param('workspaceId') workspaceId: string,
    @Param('flowId') flowId: string,
    @GetCurrentUserId() userId: string,
  ): Promise<FlowCanvasResponseDto> {
    return this.podService.getFlowCanvas(flowId, workspaceId, userId);
  }

  // ==================== PODS ====================

  @Post('pods')
  @ApiOperation({ summary: 'Create a new pod' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiParam({ name: 'flowId', description: 'Flow ID' })
  @ApiResponse({ status: 201, type: PodResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid input' })
  async createPod(
    @Param('workspaceId') workspaceId: string,
    @GetCurrentUserId() userId: string,
    @Body(ValidationPipe) dto: CreatePodDto,
  ): Promise<PodResponseDto> {
    return this.podService.createPod(workspaceId, userId, dto);
  }

  @Patch('pods/:podId')
  @ApiOperation({ summary: 'Update a pod' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiParam({ name: 'flowId', description: 'Flow ID' })
  @ApiParam({ name: 'podId', description: 'Pod ID' })
  @ApiResponse({ status: 200, type: PodResponseDto })
  @ApiNotFoundResponse({ description: 'Pod not found' })
  async updatePod(
    @Param('workspaceId') workspaceId: string,
    @Param('podId') podId: string,
    @GetCurrentUserId() userId: string,
    @Body(ValidationPipe) dto: UpdatePodDto,
  ): Promise<PodResponseDto> {
    return this.podService.updatePod(podId, workspaceId, userId, dto);
  }

  @Delete('pods/:podId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a pod' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiParam({ name: 'flowId', description: 'Flow ID' })
  @ApiParam({ name: 'podId', description: 'Pod ID' })
  @ApiResponse({ status: 204, description: 'Pod deleted' })
  @ApiNotFoundResponse({ description: 'Pod not found' })
  async deletePod(
    @Param('workspaceId') workspaceId: string,
    @Param('podId') podId: string,
    @GetCurrentUserId() userId: string,
  ): Promise<void> {
    await this.podService.deletePod(podId, workspaceId, userId);
  }

  @Post('pods/:podId/lock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lock pod for editing' })
  @ApiParam({ name: 'podId', description: 'Pod ID' })
  @ApiResponse({ status: 200, description: 'Pod locked' })
  async lockPod(
    @Param('podId') podId: string,
    @GetCurrentUserId() userId: string,
  ): Promise<{ message: string }> {
    await this.podService.lockPod(podId, userId);
    return { message: 'Pod locked successfully' };
  }

  @Post('pods/:podId/unlock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unlock pod' })
  @ApiParam({ name: 'podId', description: 'Pod ID' })
  @ApiResponse({ status: 200, description: 'Pod unlocked' })
  async unlockPod(
    @Param('podId') podId: string,
    @GetCurrentUserId() userId: string,
  ): Promise<{ message: string }> {
    await this.podService.unlockPod(podId, userId);
    return { message: 'Pod unlocked successfully' };
  }

  // ==================== EDGES ====================

  @Post('edges')
  @ApiOperation({ summary: 'Create an edge (connection)' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiParam({ name: 'flowId', description: 'Flow ID' })
  @ApiResponse({ status: 201, type: EdgeResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid input' })
  async createEdge(
    @Param('workspaceId') workspaceId: string,
    @GetCurrentUserId() userId: string,
    @Body(ValidationPipe) dto: CreateEdgeDto,
  ): Promise<EdgeResponseDto> {
    return this.edgeService.createEdge(workspaceId, userId, dto);
  }

  @Delete('edges/:edgeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an edge' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiParam({ name: 'flowId', description: 'Flow ID' })
  @ApiParam({ name: 'edgeId', description: 'Edge ID' })
  @ApiResponse({ status: 204, description: 'Edge deleted' })
  @ApiNotFoundResponse({ description: 'Edge not found' })
  async deleteEdge(
    @Param('workspaceId') workspaceId: string,
    @Param('edgeId') edgeId: string,
    @GetCurrentUserId() userId: string,
  ): Promise<void> {
    await this.edgeService.deleteEdge(edgeId, workspaceId, userId);
  }
}
