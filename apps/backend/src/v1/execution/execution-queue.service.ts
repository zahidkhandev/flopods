// execution-queue.service.ts

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { V1ExecutionService } from './execution.service';
import { V1FlowGateway } from '../flow/flow.gateway';
import { PrismaService } from '../../prisma/prisma.service';
import { LLMProvider, PodExecutionStatus } from '@actopod/schema';
import { QueueFactory } from '../../common/queue/queue.factory';
import { QueueAdapter } from '../../common/queue/queue-adapter.interface';

export type ExecutionJobData = {
  executionId: string;
  podId: string;
  workspaceId: string;
  userId: string;
  flowId: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  provider?: LLMProvider;
  model?: string;
  systemPrompt?: string; // ADD THIS
  temperature?: number;
  maxTokens?: number;
  topP?: number; // ADD THIS
  presencePenalty?: number; // ADD THIS
  frequencyPenalty?: number; // ADD THIS
  thinkingBudget?: number;
  responseFormat?: 'text' | 'json_object' | 'json'; // ADD THIS
};

@Injectable()
export class V1ExecutionQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(V1ExecutionQueueService.name);
  private executionQueue: QueueAdapter;

  constructor(
    private readonly config: ConfigService,
    private readonly queueFactory: QueueFactory,
    private readonly executionService: V1ExecutionService,
    private readonly flowGateway: V1FlowGateway,
    private readonly prisma: PrismaService,
  ) {
    this.executionQueue = this.queueFactory.createQueue('pod-executions', 10);

    this.executionQueue.process(async (job: any) => {
      return this.processExecution(job);
    });

    this.logger.log('✅ Execution queue service initialized with streaming support');
  }

  async queueExecution(data: ExecutionJobData): Promise<string> {
    try {
      const jobId = await this.executionQueue.add('execute-pod', data, {
        jobId: data.executionId,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });

      this.logger.log(
        `📋 Queued execution ${data.executionId} for pod ${data.podId} (provider: ${data.provider || 'default'})`,
      );

      this.flowGateway.broadcastToFlow(data.flowId, 'execution:queued', {
        executionId: data.executionId,
        podId: data.podId,
        status: PodExecutionStatus.QUEUED,
        timestamp: new Date(),
      });

      return jobId;
    } catch (error) {
      this.logger.error(
        `Failed to queue execution ${data.executionId}:`,
        error instanceof Error ? error.message : 'Unknown error',
      );
      throw error;
    }
  }

  private async processExecution(job: any) {
    const { executionId, podId, workspaceId, userId, flowId, ...params } = job.data;

    this.logger.log(
      `🚀 Processing execution ${executionId} (attempt ${job.attemptsMade || 1}/${job.opts?.attempts || 3})`,
    );

    try {
      await this.updateExecutionStatus(executionId, PodExecutionStatus.RUNNING);

      this.flowGateway.broadcastToFlow(flowId, 'execution:running', {
        executionId,
        podId,
        status: PodExecutionStatus.RUNNING,
        timestamp: new Date(),
      });

      // Execute with ALL parameters passed through
      const result = await this.executionService.executePod({
        podId,
        workspaceId,
        userId,
        messages: params.messages,
        provider: params.provider,
        model: params.model,
        systemPrompt: params.systemPrompt, // PASS THIS
        temperature: params.temperature,
        maxTokens: params.maxTokens,
        topP: params.topP, // PASS THIS
        presencePenalty: params.presencePenalty, // PASS THIS
        frequencyPenalty: params.frequencyPenalty, // PASS THIS
        thinkingBudget: params.thinkingBudget,
        responseFormat: params.responseFormat, // PASS THIS
      });

      this.logger.log(`✅ Execution ${executionId} completed successfully`);

      this.flowGateway.broadcastToFlow(flowId, 'execution:completed', {
        executionId,
        podId,
        status: PodExecutionStatus.COMPLETED,
        result,
        timestamp: new Date(),
      });

      return result;
    } catch (error) {
      this.logger.error(
        `❌ Execution ${executionId} failed (attempt ${job.attemptsMade || 1}):`,
        error instanceof Error ? error.message : 'Unknown error',
      );

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorCode = error instanceof Error ? error.name : 'UNKNOWN_ERROR';

      await this.updateExecutionStatus(executionId, PodExecutionStatus.ERROR, errorMessage);

      this.flowGateway.broadcastToFlow(flowId, 'execution:error', {
        executionId,
        podId,
        status: PodExecutionStatus.ERROR,
        error: errorMessage,
        errorCode,
        timestamp: new Date(),
      });

      throw error;
    }
  }

  private async updateExecutionStatus(
    executionId: string,
    status: PodExecutionStatus,
    errorMessage?: string,
  ): Promise<void> {
    try {
      await this.prisma.podExecution.update({
        where: { id: executionId },
        data: {
          status,
          ...(status === PodExecutionStatus.RUNNING && { startedAt: new Date() }),
          ...(errorMessage && {
            errorMessage,
            errorCode: 'EXECUTION_ERROR',
            finishedAt: new Date(),
          }),
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to update execution status for ${executionId}:`,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  async getQueueMetrics() {
    try {
      const metrics = await this.executionQueue.getMetrics();

      this.logger.debug(
        `Queue metrics: waiting=${metrics.waiting}, active=${metrics.active}, completed=${metrics.completed}, failed=${metrics.failed}`,
      );

      return metrics;
    } catch (error) {
      this.logger.error('Failed to get queue metrics:', error);
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
      };
    }
  }

  async cancelExecution(executionId: string): Promise<boolean> {
    try {
      const cancelled = await this.executionQueue.cancel(executionId);

      if (cancelled) {
        await this.updateExecutionStatus(executionId, PodExecutionStatus.CANCELLED);
        this.logger.log(`🛑 Cancelled execution ${executionId}`);
        return true;
      }

      this.logger.warn(`Failed to cancel execution ${executionId} - job not found in queue`);
      return false;
    } catch (error) {
      this.logger.error(
        `Error cancelling execution ${executionId}:`,
        error instanceof Error ? error.message : 'Unknown error',
      );
      return false;
    }
  }

  async getExecutionQueueStatus(executionId: string) {
    try {
      return await this.executionQueue.getJobStatus(executionId);
    } catch (error) {
      this.logger.error(
        `Failed to get queue status for ${executionId}:`,
        error instanceof Error ? error.message : 'Unknown error',
      );
      return null;
    }
  }

  async onModuleDestroy() {
    try {
      this.logger.log('🛑 Shutting down execution queue...');
      await this.executionQueue.close();
      this.logger.log('✅ Execution queue closed successfully');
    } catch (error) {
      this.logger.error('Error closing execution queue:', error);
    }
  }
}
