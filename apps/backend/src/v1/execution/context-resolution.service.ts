import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PodType } from '@flopods/schema';
import { PrismaService } from '../../prisma/prisma.service';
import { DynamoDbService } from '../../common/aws/dynamodb/dynamodb.service';

export interface ResolvedContext {
  podId: string;
  output: string;
  executionId?: string;
  timestamp: Date;
}

export interface ContextChain {
  pod: {
    id: string;
    type: PodType;
  };
  context: ResolvedContext[];
  variables: Record<string, string>;
}

@Injectable()
export class V1ContextResolutionService {
  private readonly logger = new Logger(V1ContextResolutionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dynamoDb: DynamoDbService,
  ) {}

  /**
   * ✅ BEST: Resolve FULL conversation context with OPTIONAL pins
   */
  async resolveFullContext(
    podId: string,
    flowId: string,
    contextMappings?: Array<{
      sourcePodId: string;
      pinnedExecutionId: string | null;
    }>,
  ): Promise<ContextChain> {
    const pod = await this.prisma.pod.findUnique({
      where: { id: podId },
      select: { id: true, type: true },
    });

    if (!pod) {
      throw new NotFoundException(`Pod ${podId} not found`);
    }

    const upstreamPodIds = await this.getUpstreamPods(podId, flowId);

    if (upstreamPodIds.length === 0) {
      return { pod, context: [], variables: {} };
    }

    // Build mapping of pod → execution ID (if pinned)
    const executionMap = new Map<string, string | null>();
    if (contextMappings) {
      for (const mapping of contextMappings) {
        executionMap.set(mapping.sourcePodId, mapping.pinnedExecutionId);
      }
    }

    // For each upstream pod:
    const contextPromises = upstreamPodIds.map(async (upstreamPodId) => {
      const pinnedExecutionId = executionMap.get(upstreamPodId);

      if (pinnedExecutionId) {
        // ✅ Use ONLY this specific pinned execution
        const pinned = await this.getPinnedPodOutput(upstreamPodId, pinnedExecutionId);
        return pinned ? [pinned] : [];
      } else {
        // ✅ Use ALL executions (full conversation history)
        return await this.getAllPodOutputs(upstreamPodId, 50);
      }
    });

    const allContexts = await Promise.all(contextPromises);

    // Build variables
    const variables: Record<string, string> = {};
    const flatContexts: ResolvedContext[] = [];

    for (const contexts of allContexts) {
      if (contexts.length > 0) {
        const podId = contexts[0].podId;

        // ✅ Parse and reconstruct as proper conversation
        const conversationParts: string[] = [];

        for (const ctx of contexts) {
          try {
            const turnData = JSON.parse(ctx.output);
            if (turnData.user) {
              conversationParts.push(`[User]: ${turnData.user}`);
            }
            if (turnData.assistant) {
              conversationParts.push(`[Assistant]: ${turnData.assistant}`);
            }
          } catch {
            // Fallback if not JSON
            conversationParts.push(ctx.output);
          }
        }

        variables[podId] = conversationParts.join('\n\n');
        flatContexts.push(...contexts);
      }
    }

    this.logger.debug(
      `✅ Resolved context for pod ${podId}: ${flatContexts.length} messages from ${upstreamPodIds.length} upstream pods`,
    );

    return { pod, context: flatContexts, variables };
  }

  /**
   * Resolve latest context only (backward compatible)
   */
  async resolveContext(podId: string, flowId: string): Promise<ContextChain> {
    const pod = await this.prisma.pod.findUnique({
      where: { id: podId },
      select: {
        id: true,
        type: true,
      },
    });

    if (!pod) {
      throw new NotFoundException(`Pod ${podId} not found`);
    }

    const upstreamEdges = await this.prisma.edge.findMany({
      where: {
        flowId,
        targetPodId: podId,
      },
      select: {
        sourcePodId: true,
      },
    });

    if (upstreamEdges.length === 0) {
      this.logger.debug(`Pod ${podId} has no upstream dependencies`);
      return {
        pod,
        context: [],
        variables: {},
      };
    }

    const upstreamPodIds = upstreamEdges.map((e: { sourcePodId: string }) => e.sourcePodId);

    const contextPromises = upstreamPodIds.map((upstreamPodId: string) => {
      return this.getLatestPodOutput(upstreamPodId);
    });

    const resolvedContexts = await Promise.all(contextPromises);
    const validContexts = resolvedContexts.filter(
      (c: ResolvedContext | null): c is ResolvedContext => c !== null,
    );

    const variables: Record<string, string> = {};
    for (const ctx of validContexts) {
      variables[ctx.podId] = ctx.output;
    }

    this.logger.debug(`Resolved ${validContexts.length} context items for pod ${podId}`);

    return {
      pod,
      context: validContexts,
      variables,
    };
  }

  /**
   * Resolve context with support for pinned executions
   */
  async resolveContextWithPins(
    podId: string,
    flowId: string,
    contextMappings?: Array<{
      sourcePodId: string;
      pinnedExecutionId: string | null;
    }>,
  ): Promise<ContextChain> {
    const pod = await this.prisma.pod.findUnique({
      where: { id: podId },
      select: {
        id: true,
        type: true,
      },
    });

    if (!pod) {
      throw new NotFoundException(`Pod ${podId} not found`);
    }

    const upstreamEdges = await this.prisma.edge.findMany({
      where: {
        flowId,
        targetPodId: podId,
      },
      select: {
        sourcePodId: true,
      },
    });

    if (upstreamEdges.length === 0) {
      this.logger.debug(`Pod ${podId} has no upstream dependencies`);
      return {
        pod,
        context: [],
        variables: {},
      };
    }

    const upstreamPodIds = upstreamEdges.map((e: { sourcePodId: string }) => e.sourcePodId);

    // Build mapping of pod → execution ID
    const executionMap = new Map<string, string | null>();
    if (contextMappings) {
      for (const mapping of contextMappings) {
        executionMap.set(mapping.sourcePodId, mapping.pinnedExecutionId);
      }
    }

    const contextPromises = upstreamPodIds.map((upstreamPodId: string) => {
      const pinnedExecutionId = executionMap.get(upstreamPodId);

      if (pinnedExecutionId) {
        // Use specific pinned execution
        return this.getPinnedPodOutput(upstreamPodId, pinnedExecutionId);
      } else {
        // Use latest execution (default behavior)
        return this.getLatestPodOutput(upstreamPodId);
      }
    });

    const resolvedContexts = await Promise.all(contextPromises);
    const validContexts = resolvedContexts.filter(
      (c: ResolvedContext | null): c is ResolvedContext => c !== null,
    );

    const variables: Record<string, string> = {};
    for (const ctx of validContexts) {
      variables[ctx.podId] = ctx.output;
    }

    this.logger.debug(
      `Resolved ${validContexts.length} context items for pod ${podId} (${contextMappings?.length || 0} pinned)`,
    );

    return {
      pod,
      context: validContexts,
      variables,
    };
  }

  /**
   * ✅ Get upstream pod IDs
   */
  private async getUpstreamPods(podId: string, flowId: string): Promise<string[]> {
    const upstreamEdges = await this.prisma.edge.findMany({
      where: {
        flowId,
        targetPodId: podId,
      },
      select: {
        sourcePodId: true,
      },
    });

    return upstreamEdges.map((e) => e.sourcePodId);
  }

  /**
   * ✅ FIXED: Get ALL completed executions as proper messages
   */
  private async getAllPodOutputs(podId: string, limit: number = 50): Promise<ResolvedContext[]> {
    const executions = await this.prisma.podExecution.findMany({
      where: {
        podId,
        status: 'COMPLETED',
      },
      orderBy: {
        finishedAt: 'asc',
      },
      select: {
        id: true,
        responseMetadata: true,
        finishedAt: true,
        requestMetadata: true,
      },
      take: limit,
    });

    const contexts: ResolvedContext[] = [];

    for (const exec of executions) {
      const userInput = (exec.requestMetadata as any)?.userInput || '';
      const assistantOutput = this.extractOutputFromResponse(exec.responseMetadata);

      if (!assistantOutput || !exec.finishedAt) continue;

      // ✅ Store as JSON so it can be parsed back into messages
      const turnData = {
        user: userInput,
        assistant: assistantOutput,
      };

      contexts.push({
        podId,
        output: JSON.stringify(turnData), // Store structured data
        executionId: exec.id,
        timestamp: exec.finishedAt,
      });
    }

    return contexts;
  }

  /**
   * Get specific pinned execution output
   */
  private async getPinnedPodOutput(
    podId: string,
    executionId: string,
  ): Promise<ResolvedContext | null> {
    const execution = await this.prisma.podExecution.findFirst({
      where: {
        id: executionId,
        podId,
        status: 'COMPLETED',
      },
      select: {
        id: true,
        responseMetadata: true,
        finishedAt: true,
      },
    });

    if (!execution || !execution.responseMetadata) {
      this.logger.warn(`Pinned execution ${executionId} not found or incomplete for pod ${podId}`);
      return null;
    }

    const output = this.extractOutputFromResponse(execution.responseMetadata);

    if (!output) {
      this.logger.warn(`Could not extract output from pinned execution ${executionId}`);
      return null;
    }

    return {
      podId,
      output,
      executionId: execution.id,
      timestamp: execution.finishedAt!,
    };
  }

  /**
   * Get latest execution output for a pod
   */
  private async getLatestPodOutput(podId: string): Promise<ResolvedContext | null> {
    const latestExecution = await this.prisma.podExecution.findFirst({
      where: {
        podId,
        status: 'COMPLETED',
      },
      orderBy: {
        finishedAt: 'desc',
      },
      select: {
        id: true,
        responseMetadata: true,
        finishedAt: true,
      },
      take: 1,
    });

    if (!latestExecution || !latestExecution.responseMetadata) {
      this.logger.warn(`No completed execution found for pod ${podId}`);
      return null;
    }

    const output = this.extractOutputFromResponse(latestExecution.responseMetadata);

    if (!output) {
      this.logger.warn(`Could not extract output from execution ${latestExecution.id}`);
      return null;
    }

    return {
      podId,
      output,
      executionId: latestExecution.id,
      timestamp: latestExecution.finishedAt!,
    };
  }

  /**
   * Extract text output from LLM response metadata
   */
  private extractOutputFromResponse(responseMetadata: any): string | null {
    try {
      // ✅ GEMINI FORMAT - Check for streaming content first
      if (responseMetadata.content && typeof responseMetadata.content === 'string') {
        return responseMetadata.content;
      }

      // Gemini API response format
      if (responseMetadata.candidates && responseMetadata.candidates[0]) {
        const parts = responseMetadata.candidates[0].content?.parts;
        if (parts && Array.isArray(parts)) {
          const text = parts
            .map((p: any) => p.text || '')
            .filter(Boolean)
            .join('\n');
          if (text) return text;
        }
      }

      // OpenAI format
      if (responseMetadata.choices && responseMetadata.choices[0]) {
        const content = responseMetadata.choices[0].message?.content;
        if (content) return content;
      }

      // Anthropic format
      if (responseMetadata.content && Array.isArray(responseMetadata.content)) {
        const textBlocks = responseMetadata.content.filter((block: any) => block.type === 'text');
        const text = textBlocks.map((block: any) => block.text).join('\n');
        if (text) return text;
      }

      this.logger.warn(
        `Unknown response format: ${JSON.stringify(responseMetadata).substring(0, 100)}`,
      );
      return null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to extract output from response: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Interpolate variables in a string
   */
  interpolateVariables(text: string, variables: Record<string, string>): string {
    let result = text;

    const variableRegex = /\{\{([a-zA-Z0-9_-]+)(?:\.output)?\}\}/g;

    result = result.replace(variableRegex, (match, podId) => {
      const value = variables[podId];
      if (value === undefined) {
        this.logger.warn(`Variable ${podId} not found in context`);
        return match;
      }
      return value;
    });

    return result;
  }

  /**
   * Get execution order for all pods in a flow (topological sort)
   */
  async getExecutionOrder(flowId: string): Promise<string[]> {
    const pods = await this.prisma.pod.findMany({
      where: { flowId },
      select: { id: true },
    });

    const edges = await this.prisma.edge.findMany({
      where: { flowId },
      select: {
        sourcePodId: true,
        targetPodId: true,
      },
    });

    const graph = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    for (const pod of pods) {
      graph.set(pod.id, []);
      inDegree.set(pod.id, 0);
    }

    for (const edge of edges) {
      graph.get(edge.sourcePodId)!.push(edge.targetPodId);
      inDegree.set(edge.targetPodId, (inDegree.get(edge.targetPodId) || 0) + 1);
    }

    const queue: string[] = [];
    const result: string[] = [];

    for (const [podId, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(podId);
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      for (const neighbor of graph.get(current) || []) {
        inDegree.set(neighbor, inDegree.get(neighbor)! - 1);
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      }
    }

    if (result.length !== pods.length) {
      throw new Error(`Circular dependency detected in flow ${flowId}`);
    }

    return result;
  }
}
