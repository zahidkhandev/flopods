// execution.controller.ts

import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ExecutionService } from './execution.service';
import { ExecutionQueueService } from './execution-queue.service';
import { ExecutePodDto } from './dto/execute-pod.dto';
import {
  ExecutionResultDto,
  ExecutionHistoryItemDto,
  ExecutionDetailDto,
} from './dto/execution-response.dto';
import { GetCurrentUserId } from '../../common/decorators/user';

@ApiTags('Executions')
@Controller('v1/workspaces/:workspaceId/executions')
@ApiBearerAuth()
export class V1ExecutionController {
  constructor(
    private readonly executionService: ExecutionService,
    private readonly queueService: ExecutionQueueService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Execute a pod',
    description:
      'Execute a pod with specified LLM configuration. Supports both sync and async execution modes.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID', example: 'cm2abc123' })
  @ApiResponse({
    status: 200,
    description: 'Execution completed (sync) or queued (async)',
    type: ExecutionResultDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid request or missing API key' })
  @ApiResponse({ status: 404, description: 'Pod not found' })
  async executePod(
    @Param('workspaceId') workspaceId: string,
    @GetCurrentUserId('id') userId: string,
    @Body() dto: ExecutePodDto,
  ): Promise<ExecutionResultDto | { executionId: string; status: string }> {
    if (dto.async) {
      // Queue execution for background processing
      const pod = await this.executionService['prisma'].pod.findFirst({
        where: { id: dto.podId },
        select: { flowId: true },
      });

      if (!pod) {
        throw new Error('Pod not found');
      }

      const executionId = `exec_${Date.now()}`;
      await this.queueService.queueExecution({
        executionId,
        podId: dto.podId,
        workspaceId,
        userId,
        flowId: pod.flowId,
        messages: dto.messages,
        provider: dto.provider, // Already LLMProvider type
        model: dto.model,
        temperature: dto.temperature,
        maxTokens: dto.maxTokens,
        thinkingBudget: dto.thinkingBudget,
      });

      return {
        executionId,
        status: 'queued',
      };
    }

    // Execute synchronously
    return this.executionService.executePod({
      ...dto,
      workspaceId,
      userId,
    });
  }

  @Get('pod/:podId')
  @ApiOperation({ summary: 'Get pod execution history' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiParam({ name: 'podId', description: 'Pod ID', example: 'pod_1234567890_abc123' })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiResponse({ status: 200, type: [ExecutionHistoryItemDto] })
  async getPodExecutions(
    @Param('podId') podId: string,
    @Query('limit') limit?: string,
  ): Promise<ExecutionHistoryItemDto[]> {
    return this.executionService.getPodExecutions(podId, limit ? parseInt(limit, 10) : 10);
  }

  @Get(':executionId')
  @ApiOperation({ summary: 'Get execution details' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiParam({ name: 'executionId', description: 'Execution ID', example: 'exec_cm2abc123' })
  @ApiResponse({ status: 200, type: ExecutionDetailDto })
  @ApiResponse({ status: 404, description: 'Execution not found' })
  async getExecution(@Param('executionId') executionId: string): Promise<ExecutionDetailDto> {
    return this.executionService.getExecution(executionId);
  }

  @Delete(':executionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel queued execution' })
  @ApiParam({ name: 'executionId', description: 'Execution ID' })
  @ApiResponse({ status: 204, description: 'Execution cancelled' })
  async cancelExecution(@Param('executionId') executionId: string): Promise<void> {
    await this.queueService.cancelExecution(executionId);
  }

  @Get('queue/metrics')
  @ApiOperation({ summary: 'Get queue metrics' })
  @ApiResponse({ status: 200, description: 'Queue metrics' })
  async getQueueMetrics() {
    return this.queueService.getQueueMetrics();
  }

  @Get(':executionId/status')
  @ApiOperation({ summary: 'Get execution queue status' })
  @ApiParam({ name: 'executionId', description: 'Execution ID' })
  @ApiResponse({ status: 200, description: 'Execution queue status' })
  async getExecutionStatus(@Param('executionId') executionId: string) {
    return this.queueService.getExecutionQueueStatus(executionId);
  }
}
