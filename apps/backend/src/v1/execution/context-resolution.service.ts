import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PodType } from '@flopods/schema';
import { PrismaService } from '../../prisma/prisma.service';
import { DynamoDbService } from '../../common/aws/dynamodb/dynamodb.service';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { ApiKeyEncryptionService } from '../../common/services/encryption.service';

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

interface GeminiEmbeddingResponse {
  embedding?: { values?: number[] };
  error?: { message?: string; code?: string };
}

@Injectable()
export class V1ContextResolutionService {
  private readonly logger = new Logger(V1ContextResolutionService.name);
  private readonly GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
  private readonly EMBEDDING_TIMEOUT = 60000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly dynamoDb: DynamoDbService,
    private readonly configService: ConfigService,
    private readonly encryptionService: ApiKeyEncryptionService,
  ) {}

  async invalidatePodContext(podId: string, flowId: string): Promise<void> {
    this.logger.debug(`Invalidating context cache for pod ${podId}`);

    // Mark the pod as requiring context refresh
    await this.prisma.pod.update({
      where: { id: podId },
      data: {
        executionStatus: 'IDLE', // Reset execution status
        lastExecutionId: null, // Clear last execution reference
      },
    });
  }

  /**
   * OPTIMIZED: Resolve FULL conversation context (Batched Queries)
   * 1. Groups IDs.
   * 2. Fires 2 queries total (instead of N).
   * 3. Maps results back to structure.
   */
  async resolveFullContext(
    podId: string,
    flowId: string,
    contextMappings?: Array<{
      sourcePodId: string;
      pinnedExecutionId: string | null;
    }>,
    maxTokens: number = 100000, // Default safe limit
  ): Promise<ContextChain> {
    const pod = await this.prisma.pod.findUnique({
      where: { id: podId },
      select: { id: true, type: true },
    });

    if (!pod) {
      throw new NotFoundException(`Pod ${podId} not found`);
    }

    // Get ALL ancestor pods recursively
    const allAncestorPods = await this.getRecursiveUpstreamPods(podId, flowId);

    this.logger.debug(
      `Pod ${podId} has ${allAncestorPods.length} total ancestor pods (recursive): [${allAncestorPods.join(', ')}]`,
    );

    if (allAncestorPods.length === 0) {
      return { pod, context: [], variables: {} };
    }

    // --- PREPARE IDs ---
    const pinnedMap = new Map<string, string>();
    const defaultPodIds: string[] = [];

    if (contextMappings) {
      for (const mapping of contextMappings) {
        if (mapping.pinnedExecutionId) {
          pinnedMap.set(mapping.sourcePodId, mapping.pinnedExecutionId);
        }
      }
    }

    allAncestorPods.forEach((upid) => {
      if (!pinnedMap.has(upid)) {
        defaultPodIds.push(upid);
      }
    });

    const contextResults: ResolvedContext[] = [];
    let totalTokensUsed = 0;

    // --- BATCH FETCH PINNED ---
    if (pinnedMap.size > 0) {
      const pinnedExecutions = await this.prisma.podExecution.findMany({
        where: {
          id: { in: Array.from(pinnedMap.values()) },
          status: 'COMPLETED',
        },
        select: {
          id: true,
          podId: true,
          requestMetadata: true,
          responseMetadata: true,
          finishedAt: true,
        },
      });

      for (const exec of pinnedExecutions) {
        const output = this.extractOutputFromResponse(exec.responseMetadata);
        const userInput = (exec.requestMetadata as any)?.userInput || '';

        if (output) {
          const turnData = {
            user: userInput,
            assistant: output,
          };
          const turnText = JSON.stringify(turnData);
          const turnTokens = this.estimateTokens(turnText);

          if (totalTokensUsed + turnTokens <= maxTokens) {
            contextResults.push({
              podId: exec.podId,
              output: turnText,
              executionId: exec.id,
              timestamp: exec.finishedAt!,
            });
            totalTokensUsed += turnTokens;
          }
        }
      }
    }

    // --- BATCH FETCH ALL ANCESTOR HISTORY ---
    if (defaultPodIds.length > 0) {
      // Fetch ALL executions from ALL ancestor pods
      const allExecutions = await this.prisma.podExecution.findMany({
        where: {
          podId: { in: defaultPodIds },
          status: 'COMPLETED',
        },
        orderBy: { finishedAt: 'desc' },
        select: {
          id: true,
          podId: true,
          requestMetadata: true,
          responseMetadata: true,
          finishedAt: true,
        },
      });

      this.logger.debug(
        `Fetched ${allExecutions.length} total executions from ${defaultPodIds.length} ancestor pods`,
      );

      // Group by podId
      const grouped = new Map<string, typeof allExecutions>();
      allExecutions.forEach((exec) => {
        if (!grouped.has(exec.podId)) grouped.set(exec.podId, []);
        grouped.get(exec.podId)!.push(exec);
      });

      this.logger.debug(`Grouped into ${grouped.size} ancestor pods with execution history`);

      // Process each ancestor pod's history (most recent first)
      for (const [pId, execs] of grouped.entries()) {
        const sorted = execs.sort((a, b) => b.finishedAt!.getTime() - a.finishedAt!.getTime());

        this.logger.debug(`Processing ${sorted.length} executions from ancestor pod ${pId}`);

        for (const exec of sorted) {
          const output = this.extractOutputFromResponse(exec.responseMetadata);
          const userInput = (exec.requestMetadata as any)?.userInput || '';

          if (output) {
            const turnData = {
              user: userInput,
              assistant: output,
            };
            const turnText = JSON.stringify(turnData);
            const turnTokens = this.estimateTokens(turnText);

            // Stop if we'd exceed token limit
            if (totalTokensUsed + turnTokens > maxTokens) {
              this.logger.warn(
                `⚠️  Reached token limit (${totalTokensUsed}/${maxTokens}). Stopping context collection.`,
              );
              break;
            }

            contextResults.push({
              podId: pId,
              output: turnText,
              executionId: exec.id,
              timestamp: exec.finishedAt!,
            });
            totalTokensUsed += turnTokens;
          }
        }

        // Break outer loop if limit reached
        if (totalTokensUsed >= maxTokens) break;
      }
    }

    // --- FORMAT VARIABLES ---
    const variables = this.buildVariablesFromContext(contextResults);

    this.logger.log(
      `✅ Resolved ${contextResults.length} context items from ${Object.keys(variables).length} ancestor pods | Tokens used: ${totalTokensUsed}/${maxTokens}`,
    );

    return { pod, context: contextResults, variables };
  }

  /**
   * RECURSIVE: Get ALL upstream pods (direct + ancestors)
   */
  private async getRecursiveUpstreamPods(
    podId: string,
    flowId: string,
    visited: Set<string> = new Set(),
  ): Promise<string[]> {
    // Prevent infinite loops
    if (visited.has(podId)) return [];
    visited.add(podId);

    // Get direct upstream pods
    const edges = await this.prisma.edge.findMany({
      where: { flowId, targetPodId: podId },
      select: { sourcePodId: true },
    });

    const directUpstream = edges.map((e) => e.sourcePodId);

    if (directUpstream.length === 0) {
      return [];
    }

    // Recursively get upstream of upstream
    const allAncestors = [...directUpstream];

    for (const upstreamPodId of directUpstream) {
      const ancestorsOfUpstream = await this.getRecursiveUpstreamPods(
        upstreamPodId,
        flowId,
        visited,
      );
      allAncestors.push(...ancestorsOfUpstream);
    }

    // Remove duplicates
    return Array.from(new Set(allAncestors));
  }

  /**
   * Estimate tokens from text (4 chars ≈ 1 token)
   */
  private estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }

  /**
   * OPTIMIZED: Resolve latest context only
   */
  async resolveContext(podId: string, flowId: string): Promise<ContextChain> {
    return this.resolveContextWithPins(podId, flowId);
  }

  /**
   * OPTIMIZED: Resolve context with support for pinned executions (Batched)
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
      select: { id: true, type: true },
    });

    if (!pod) throw new NotFoundException(`Pod ${podId} not found`);

    const upstreamPodIds = await this.getUpstreamPods(podId, flowId);
    if (upstreamPodIds.length === 0) {
      return { pod, context: [], variables: {} };
    }

    const pinnedMap = new Map<string, string>();
    const latestPodIds: string[] = [];

    if (contextMappings) {
      for (const mapping of contextMappings) {
        if (mapping.pinnedExecutionId) {
          pinnedMap.set(mapping.sourcePodId, mapping.pinnedExecutionId);
        }
      }
    }

    upstreamPodIds.forEach((id) => {
      if (!pinnedMap.has(id)) latestPodIds.push(id);
    });

    const contextResults: ResolvedContext[] = [];

    // 1. Fetch Pinned
    if (pinnedMap.size > 0) {
      const pinnedExecutions = await this.prisma.podExecution.findMany({
        where: {
          id: { in: Array.from(pinnedMap.values()) },
          status: 'COMPLETED',
        },
        select: { id: true, podId: true, responseMetadata: true, finishedAt: true },
      });

      for (const exec of pinnedExecutions) {
        const output = this.extractOutputFromResponse(exec.responseMetadata);
        if (output) {
          contextResults.push({
            podId: exec.podId,
            output,
            executionId: exec.id,
            timestamp: exec.finishedAt!,
          });
        }
      }
    }

    // 2. Fetch Latest for others (Using Postgres DISTINCT ON logic via distinct)
    if (latestPodIds.length > 0) {
      const latestExecutions = await this.prisma.podExecution.findMany({
        where: {
          podId: { in: latestPodIds },
          status: 'COMPLETED',
        },
        distinct: ['podId'], // <--- THIS IS THE MAGIC OPTIMIZATION
        orderBy: { finishedAt: 'desc' },
        select: { id: true, podId: true, responseMetadata: true, finishedAt: true },
      });

      for (const exec of latestExecutions) {
        const output = this.extractOutputFromResponse(exec.responseMetadata);
        if (output) {
          contextResults.push({
            podId: exec.podId,
            output,
            executionId: exec.id,
            timestamp: exec.finishedAt!,
          });
        }
      }
    }

    const variables: Record<string, string> = {};
    for (const ctx of contextResults) {
      variables[ctx.podId] = ctx.output;
    }

    return { pod, context: contextResults, variables };
  }

  // --- Helpers ---

  private buildVariablesFromContext(contexts: ResolvedContext[]): Record<string, string> {
    const varsByPod = new Map<string, string[]>();

    for (const ctx of contexts) {
      if (!varsByPod.has(ctx.podId)) varsByPod.set(ctx.podId, []);
      try {
        const json = JSON.parse(ctx.output);
        if (json.user) varsByPod.get(ctx.podId)!.push(`[User]: ${json.user}`);
        if (json.assistant) varsByPod.get(ctx.podId)!.push(`[Assistant]: ${json.assistant}`);
      } catch {
        varsByPod.get(ctx.podId)!.push(ctx.output);
      }
    }

    const variables: Record<string, string> = {};
    varsByPod.forEach((val, key) => {
      variables[key] = val.join('\n\n');
    });
    return variables;
  }

  private async getUpstreamPods(podId: string, flowId: string): Promise<string[]> {
    const upstreamEdges = await this.prisma.edge.findMany({
      where: { flowId, targetPodId: podId },
      select: { sourcePodId: true, id: true },
    });

    const upstreamPodIds = upstreamEdges.map((e) => e.sourcePodId);

    this.logger.debug(
      `Pod ${podId} has ${upstreamPodIds.length} upstream connections: [${upstreamPodIds.join(', ')}]`,
    );

    return upstreamPodIds;
  }

  private extractOutputFromResponse(responseMetadata: any): string | null {
    try {
      if (responseMetadata?.content && typeof responseMetadata.content === 'string') {
        return responseMetadata.content;
      }
      if (responseMetadata?.candidates?.[0]?.content?.parts) {
        const parts = responseMetadata.candidates[0].content.parts;
        return parts.map((p: any) => p.text || '').join('\n');
      }
      if (responseMetadata?.choices?.[0]?.message?.content) {
        return responseMetadata.choices[0].message.content;
      }
      if (Array.isArray(responseMetadata?.content)) {
        const textBlocks = responseMetadata.content.filter((block: any) => block.type === 'text');
        return textBlocks.map((block: any) => block.text).join('\n');
      }
      return null;
    } catch (err) {
      this.logger.error('Failed to extract output from response', err);
      return null;
    }
  }

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

  async getExecutionOrder(flowId: string): Promise<string[]> {
    const pods = await this.prisma.pod.findMany({
      where: { flowId },
      select: { id: true },
    });

    const edges = await this.prisma.edge.findMany({
      where: { flowId },
      select: { sourcePodId: true, targetPodId: true },
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
      if (degree === 0) queue.push(podId);
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

  // --- Embedding Helpers (Still here for Worker to use) ---

  private async getByokKey(workspaceId?: string): Promise<string> {
    if (workspaceId) {
      const keyRecord = await this.prisma.providerAPIKey.findFirst({
        where: {
          workspaceId,
          provider: 'GOOGLE_GEMINI',
          isActive: true,
        },
        orderBy: { createdAt: 'desc' },
        select: { keyHash: true },
      });

      if (keyRecord) {
        try {
          return this.encryptionService.decrypt(keyRecord.keyHash);
        } catch (error) {
          throw new ForbiddenException('Failed to decrypt workspace API key');
        }
      }
    }

    const envKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!envKey || envKey.length < 20) {
      throw new ForbiddenException('No valid Gemini API key configured');
    }
    return envKey;
  }

  async generateTextEmbedding(text: string, workspaceId?: string): Promise<number[]> {
    const sanitizedText = this.sanitizeText(text);
    if (!sanitizedText || sanitizedText.length < 10) return [];

    try {
      const apiKey = await this.getByokKey(workspaceId);
      const url = `${this.GEMINI_BASE_URL}/models/embedding-001:embedContent?key=${apiKey}`;
      const response = await axios.post<GeminiEmbeddingResponse>(
        url,
        {
          model: 'models/embedding-001',
          content: { parts: [{ text: sanitizedText }] },
        },
        { timeout: this.EMBEDDING_TIMEOUT },
      );
      const embedding = response.data.embedding?.values;
      if (embedding && Array.isArray(embedding)) return embedding;
    } catch (err) {
      // Fallback
    }

    try {
      const hfApiToken = this.configService.get<string>('HUGGING_FACE_API_TOKEN');
      if (hfApiToken) {
        const hfResponse = await axios.post(
          `https://api-inference.huggingface.co/pipeline/feature-extraction/BAAI/bge-base-en-v1.5`,
          [sanitizedText],
          {
            headers: { Authorization: `Bearer ${hfApiToken}` },
            timeout: this.EMBEDDING_TIMEOUT,
          },
        );
        if (hfResponse.data && Array.isArray(hfResponse.data)) {
          return hfResponse.data[0];
        }
      }
    } catch (e) {
      this.logger.error('All embedding providers failed');
    }
    return [];
  }

  async saveChatEmbedding(
    workspaceId: string,
    userId: string,
    podId: string,
    executionId: string,
    chunkText: string,
    embedding: number[],
  ): Promise<void> {
    if (!embedding.length) return;
    const vectorString = `[${embedding.join(',')}]`;
    const vectorDimension = embedding.length;

    try {
      await this.prisma.$executeRaw`
        INSERT INTO documents."ChatEmbedding"
        (id, "workspaceId", "userId", "podId", "executionId", "chunkText",
          vector, "vectorDimension", model, metadata, "createdAt")
        VALUES (
          gen_random_uuid()::text,
          ${workspaceId},
          ${userId},
          ${podId},
          ${executionId},
          ${chunkText},
          ${vectorString}::vector(${vectorDimension}),
          ${vectorDimension},
          'embedding-001',
          '{}'::jsonb,
          NOW()
        )
      `;
    } catch (error) {
      this.logger.error(`Error saving embedding: ${error}`);
    }
  }

  private sanitizeText(text: string): string {
    return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
  }

  async semanticSearchUserContext(
    userId: string,
    query: string,
    threshold: number = 0.75,
    maxResults: number = 10,
  ): Promise<ResolvedContext[]> {
    const queryEmbedding = await this.generateTextEmbedding(query);
    if (!queryEmbedding.length) return [];

    const results = await this.prisma.$queryRaw<
      {
        id: string;
        podId: string;
        executionId: string;
        chunkText: string;
        createdAt: Date;
        similarity: number;
      }[]
    >`
    SELECT id, "podId", "executionId", "chunkText", "createdAt",
    1 - (vector <=> ${queryEmbedding}::vector) AS similarity
    FROM documents."ChatEmbedding"
    WHERE "userId" = ${userId} AND 1 - (vector <=> ${queryEmbedding}::vector) > ${threshold}
    ORDER BY similarity DESC
    LIMIT ${maxResults}
  `;
    return results.map((r) => ({
      podId: r.podId,
      output: r.chunkText,
      executionId: r.executionId,
      timestamp: r.createdAt,
    }));
  }
}
