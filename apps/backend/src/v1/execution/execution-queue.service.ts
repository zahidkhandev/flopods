import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExecutionService } from './execution.service';
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
  temperature?: number;
  maxTokens?: number;
  thinkingBudget?: number;
};

@Injectable()
export class ExecutionQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(ExecutionQueueService.name);
  private executionQueue: QueueAdapter;

  constructor(
    private readonly config: ConfigService,
    private readonly queueFactory: QueueFactory,
    private readonly executionService: ExecutionService,
    private readonly flowGateway: V1FlowGateway,
    private readonly prisma: PrismaService,
  ) {
    this.executionQueue = this.queueFactory.createQueue('pod-executions', 10);

    this.executionQueue.process(async (job: any) => {
      return this.processExecution(job);
    });
  }

  async queueExecution(data: ExecutionJobData): Promise<string> {
    const jobId = await this.executionQueue.add('execute-pod', data, {
      jobId: data.executionId,
    });

    this.logger.log(`📋 Queued execution ${data.executionId} for pod ${data.podId}`);

    this.flowGateway.broadcastToFlow(data.flowId, 'execution:queued', {
      executionId: data.executionId,
      podId: data.podId,
      status: PodExecutionStatus.QUEUED,
    });

    return jobId;
  }

  private async processExecution(job: any) {
    const { executionId, podId, workspaceId, userId, flowId, ...params } = job.data;

    this.logger.log(`🚀 Processing execution ${executionId} (attempt ${job.attemptsMade || 1})`);

    await this.updateExecutionStatus(executionId, PodExecutionStatus.RUNNING);
    this.flowGateway.broadcastToFlow(flowId, 'execution:running', {
      executionId,
      podId,
      status: PodExecutionStatus.RUNNING,
    });

    try {
      const result = await this.executionService.executePodInternal({
        executionId,
        podId,
        workspaceId,
        userId,
        ...params,
      });

      this.logger.log(`✅ Execution ${executionId} completed`);

      this.flowGateway.broadcastToFlow(flowId, 'execution:completed', {
        executionId,
        podId,
        status: PodExecutionStatus.COMPLETED,
        result,
      });

      return result;
    } catch (error) {
      this.logger.error(`❌ Execution ${executionId} failed:`, error);

      await this.updateExecutionStatus(
        executionId,
        PodExecutionStatus.ERROR,
        error instanceof Error ? error.message : 'Unknown error',
      );

      this.flowGateway.broadcastToFlow(flowId, 'execution:error', {
        executionId,
        podId,
        status: PodExecutionStatus.ERROR,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  private async updateExecutionStatus(
    executionId: string,
    status: PodExecutionStatus,
    errorMessage?: string,
  ) {
    await this.prisma.podExecution.update({
      where: { id: executionId },
      data: {
        status,
        ...(errorMessage && { errorMessage }),
      },
    });
  }

  async getQueueMetrics() {
    return this.executionQueue.getMetrics();
  }

  async cancelExecution(executionId: string): Promise<boolean> {
    const cancelled = await this.executionQueue.cancel(executionId);
    if (cancelled) {
      await this.updateExecutionStatus(executionId, PodExecutionStatus.CANCELLED);
      this.logger.log(`🛑 Cancelled execution ${executionId}`);
    }
    return cancelled;
  }

  async getExecutionQueueStatus(executionId: string) {
    return this.executionQueue.getJobStatus(executionId);
  }

  async onModuleDestroy() {
    await this.executionQueue.close();
  }
}
