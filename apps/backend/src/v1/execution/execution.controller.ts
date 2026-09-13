// File: apps/backend/src/v1/execution/execution.controller.ts

import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Response } from 'express';
import { V1ExecutionService } from './execution.service';
import { ExecutePodDto } from './dto/execute-pod.dto';
import { ExecutionHistoryItemDto, ExecutionDetailDto } from './dto/execution-response.dto';
import { GetCurrentUserId } from '../../common/decorators/user';

@ApiTags('Executions')
@Controller('workspaces/:workspaceId')
@ApiBearerAuth()
export class V1ExecutionController {
  constructor(private readonly executionService: V1ExecutionService) {}

  @Post('executions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Execute a pod with instant streaming + conversation history',
    description: `
      Execute a pod with real-time streaming response.

      **Key Features:**
      - Instant token streaming (no queuing)
      - Automatic conversation history (last 20 turns)
      - Full upstream context from connected pods
      - Variable interpolation ({{podId}})

      **Conversation History:**
      Each pod maintains its own conversation thread. The last 20 executions
      are automatically included as context for continuity.
    `,
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID', example: 'cm2abc123' })
  @ApiResponse({
    status: 200,
    description: 'Streaming execution (SSE format)',
  })
  @ApiResponse({ status: 400, description: 'Invalid request or missing API key' })
  @ApiResponse({ status: 404, description: 'Pod not found' })
  async executePod(
    @Param('workspaceId') workspaceId: string,
    @GetCurrentUserId('id') userId: string,
    @Body() dto: ExecutePodDto,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    if (!dto.podId || !dto.messages || dto.messages.length === 0) {
      res.status(400).json({
        error: 'Invalid request',
        message: 'podId and messages are required',
      });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
      const stream = this.executionService.executePod({
        podId: dto.podId,
        workspaceId,
        userId,
        messages: dto.messages,
        provider: dto.provider,
        model: dto.model,
        systemPrompt: dto.systemPrompt,
        temperature: dto.temperature,
        maxTokens: dto.maxTokens,
        topP: dto.topP,
        presencePenalty: dto.presencePenalty,
        frequencyPenalty: dto.frequencyPenalty,
        thinkingBudget: dto.thinkingBudget,
        responseFormat: dto.responseFormat,
        autoContext: dto.autoContext,
      });

      for await (const chunk of stream) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        if (typeof (res as Response & { flush?: () => void }).flush === 'function') {
          (res as Response & { flush?: () => void }).flush?.();
        }
      }

      res.write('data: [DONE]\n\n');
      if (typeof (res as Response & { flush?: () => void }).flush === 'function') {
        (res as Response & { flush?: () => void }).flush?.();
      }
      res.end();
    } catch (error) {
      res.write(
        `data: ${JSON.stringify({
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        })}\n\n`,
      );
      res.end();
    }
  }

  @Get('flows/:flowId/executions/pods/:podId')
  @ApiOperation({
    summary: 'Get execution history for a specific pod',
    description: 'Returns the latest execution history for a pod (max 100 executions)',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiParam({ name: 'flowId', description: 'Flow ID' })
  @ApiParam({ name: 'podId', description: 'Pod ID', example: 'pod_1234567890_abc123' })
  @ApiQuery({ name: 'limit', required: false, example: 10, description: 'Max 100' })
  @ApiResponse({ status: 200, type: [ExecutionHistoryItemDto] })
  async getPodExecutionsByPodId(
    @Param('podId') podId: string,
    @Query('limit') limit?: string,
  ): Promise<ExecutionHistoryItemDto[]> {
    const parsedLimit = limit ? Math.min(parseInt(limit, 10), 100) : 10;
    return this.executionService.getPodExecutions(podId, parsedLimit);
  }

  @Get('executions/:executionId')
  @ApiOperation({ summary: 'Get detailed execution information' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiParam({ name: 'executionId', description: 'Execution ID', example: 'exec_cm2abc123' })
  @ApiResponse({ status: 200, type: ExecutionDetailDto })
  @ApiResponse({ status: 404, description: 'Execution not found' })
  async getExecution(@Param('executionId') executionId: string): Promise<ExecutionDetailDto> {
    return this.executionService.getExecution(executionId);
  }
}
