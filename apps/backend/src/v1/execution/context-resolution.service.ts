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
  category: 'LIVE_DATA' | 'HISTORY';
  type: PodType;
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

const STATIC_CONTENT_POD_TYPES: PodType[] = [
  'TEXT_INPUT',
  'DOCUMENT_INPUT',
  'URL_INPUT',
  'IMAGE_INPUT',
  'VIDEO_INPUT',
  'AUDIO_INPUT',
];

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

    await this.prisma.pod.update({
      where: { id: podId },
      data: {
        executionStatus: 'IDLE',
        lastExecutionId: null,
      },
    });
  }

  async resolveFullContext(
    podId: string,
    flowId: string,
    contextMappings?: Array<{
      sourcePodId: string;
      pinnedExecutionId: string | null;
    }>,
    maxTokens: number = 100000,
  ): Promise<ContextChain> {
    const pod = await this.prisma.pod.findUnique({
      where: { id: podId },
      select: { id: true, type: true },
    });

    if (!pod) {
      throw new NotFoundException(`Pod ${podId} not found`);
    }

    const allAncestorPods = await this.getRecursiveUpstreamPodsWithTypes(podId, flowId);

    this.logger.debug(
      `Pod ${podId} has ${allAncestorPods.length} total ancestor pods (recursive): [${allAncestorPods.map((p) => `${p.id}:${p.type}`).join(', ')}]`,
    );

    if (allAncestorPods.length === 0) {
      return { pod, context: [], variables: {} };
    }

    const staticContentPods = allAncestorPods.filter((p) =>
      STATIC_CONTENT_POD_TYPES.includes(p.type),
    );
    const executablePods = allAncestorPods.filter(
      (p) => !STATIC_CONTENT_POD_TYPES.includes(p.type),
    );

    this.logger.debug(
      `Split into ${staticContentPods.length} static pods and ${executablePods.length} executable pods`,
    );

    const contextResults: ResolvedContext[] = [];
    let totalTokensUsed = 0;

    if (staticContentPods.length > 0) {
      const staticContexts = await this.fetchStaticPodContents(
        staticContentPods.map((p) => ({ id: p.id, type: p.type })),
        maxTokens - totalTokensUsed,
      );

      for (const ctx of staticContexts) {
        const tokens = this.estimateTokens(ctx.output);
        if (totalTokensUsed + tokens <= maxTokens) {
          contextResults.push(ctx);
          totalTokensUsed += tokens;
        }
      }

      this.logger.log(`Fetched ${staticContexts.length} static content pods (TEXT_INPUT, etc.)`);
    }

    if (executablePods.length > 0 && totalTokensUsed < maxTokens) {
      const pinnedMap = new Map<string, string>();
      const defaultPodIds: string[] = [];

      if (contextMappings) {
        for (const mapping of contextMappings) {
          if (mapping.pinnedExecutionId) {
            pinnedMap.set(mapping.sourcePodId, mapping.pinnedExecutionId);
          }
        }
      }

      executablePods.forEach((p) => {
        if (!pinnedMap.has(p.id)) {
          defaultPodIds.push(p.id);
        }
      });

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
            const turnData = { user: userInput, assistant: output };
            const turnText = JSON.stringify(turnData);
            const turnTokens = this.estimateTokens(turnText);

            if (totalTokensUsed + turnTokens <= maxTokens) {
              contextResults.push({
                podId: exec.podId,
                output: turnText,
                executionId: exec.id,
                timestamp: exec.finishedAt!,
                category: 'HISTORY',
                type: 'LLM_PROMPT',
              });
              totalTokensUsed += turnTokens;
            }
          }
        }
      }

      if (defaultPodIds.length > 0 && totalTokensUsed < maxTokens) {
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
          `Fetched ${allExecutions.length} total executions from ${defaultPodIds.length} executable ancestor pods`,
        );

        const grouped = new Map<string, typeof allExecutions>();
        allExecutions.forEach((exec) => {
          if (!grouped.has(exec.podId)) grouped.set(exec.podId, []);
          grouped.get(exec.podId)!.push(exec);
        });

        this.logger.debug(`Grouped into ${grouped.size} ancestor pods with execution history`);

        for (const [pId, execs] of grouped.entries()) {
          const sorted = execs.sort((a, b) => b.finishedAt!.getTime() - a.finishedAt!.getTime());

          this.logger.debug(`Processing ${sorted.length} executions from ancestor pod ${pId}`);

          for (const exec of sorted) {
            const output = this.extractOutputFromResponse(exec.responseMetadata);
            const userInput = (exec.requestMetadata as any)?.userInput || '';

            if (output) {
              const turnData = { user: userInput, assistant: output };
              const turnText = JSON.stringify(turnData);
              const turnTokens = this.estimateTokens(turnText);

              if (totalTokensUsed + turnTokens > maxTokens) {
                this.logger.warn(
                  `Reached token limit (${totalTokensUsed}/${maxTokens}). Stopping context collection.`,
                );
                break;
              }

              contextResults.push({
                podId: pId,
                output: turnText,
                executionId: exec.id,
                timestamp: exec.finishedAt!,
                category: 'HISTORY',
                type: 'LLM_PROMPT',
              });
              totalTokensUsed += turnTokens;
            }
          }

          if (totalTokensUsed >= maxTokens) break;
        }
      }
    }

    const formattedContext = this.buildHierarchicalContextString(contextResults);
    const variables = {
      ...this.buildVariablesFromContext(contextResults),
      SYSTEM_CONTEXT_STRING: formattedContext,
    };

    this.logger.log(
      `Resolved ${contextResults.length} context items from ${new Set(contextResults.map((c) => c.podId)).size} ancestor pods | Tokens used: ${totalTokensUsed}/${maxTokens}`,
    );

    return { pod, context: contextResults, variables };
  }

  private buildHierarchicalContextString(contexts: ResolvedContext[]): string {
    const liveData = contexts.filter((c) => c.category === 'LIVE_DATA');
    const history = contexts.filter((c) => c.category === 'HISTORY');

    history.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    let prompt = '';

    if (liveData.length > 0) {
      prompt += `### 🟢 CURRENT INPUT DATA (Highest Priority)\\n`;
      prompt += `Treat the information below as the absolute ground truth. It supersedes any information found in conversation history.\\n\\n`;

      for (const ctx of liveData) {
        prompt += `**Source (${ctx.type}):** ${ctx.output}\\n\\n`;
      }
      prompt += `---\\n\\n`;
    }

    if (history.length > 0) {
      prompt += `### 🟡 PREVIOUS CONVERSATION HISTORY (Context Only)\\n`;
      prompt += `The following is a log of previous interactions. Note that this history might contain outdated conclusions. If this history contradicts the "Current Input Data" above, IGNORE the history and use the Input Data.\\n\\n`;

      for (const ctx of history) {
        try {
          const json = JSON.parse(ctx.output);
          prompt += `**Timestamp:** ${ctx.timestamp.toISOString()}\\n`;
          if (json.user) prompt += `User: ${json.user}\\n`;
          if (json.assistant) prompt += `Assistant: ${json.assistant}\\n`;
          prompt += `\\n`;
        } catch (e) {
          prompt += `**Output:** ${ctx.output}\\n\\n`;
        }
      }
    }

    return prompt;
  }

  private async fetchStaticPodContents(
    pods: Array<{ id: string; type: PodType }>,
    maxTokens: number,
  ): Promise<ResolvedContext[]> {
    if (pods.length === 0) return [];

    const podDetails = await this.prisma.pod.findMany({
      where: { id: { in: pods.map((p) => p.id) } },
      select: {
        id: true,
        type: true,
        dynamoPartitionKey: true,
        dynamoSortKey: true,
        createdAt: true,
        documentId: true,
      },
    });

    const documentIds = podDetails.filter((p) => p.documentId).map((p) => p.documentId!);

    const documentsMap = new Map<string, any>();
    if (documentIds.length > 0) {
      const documents = await this.prisma.document.findMany({
        where: { id: { in: documentIds } },
        select: {
          id: true,
          name: true,
          fileType: true,
          sizeInBytes: true,
        },
      });
      documents.forEach((doc) => documentsMap.set(doc.id, doc));
    }

    const results: ResolvedContext[] = [];
    const tableName = this.dynamoDb.getTableNames().pods;
    let tokensUsed = 0;

    for (const pod of podDetails) {
      try {
        const item = (await this.dynamoDb.getItem(tableName, {
          pk: pod.dynamoPartitionKey,
          sk: pod.dynamoSortKey,
        })) as any;

        if (!item?.content) {
          this.logger.warn(`No DynamoDB content found for pod ${pod.id}`);
          continue;
        }

        let output: string | null = null;

        if (pod.type === 'TEXT_INPUT') {
          output = item.content?.config?.content;
        } else if (pod.type === 'DOCUMENT_INPUT') {
          if (pod.documentId && documentsMap.has(pod.documentId)) {
            const document = documentsMap.get(pod.documentId);
            output = `Document: ${document.name} (${document.fileType})`;
          } else {
            output =
              item.content?.config?.documentName ||
              item.content?.config?.documentId ||
              'Document input attached';
          }
        } else if (pod.type === 'URL_INPUT') {
          output = item.content?.config?.url;
        } else if (['IMAGE_INPUT', 'VIDEO_INPUT', 'AUDIO_INPUT'].includes(pod.type)) {
          output =
            item.content?.config?.fileName ||
            item.content?.config?.url ||
            `${pod.type.replace('_INPUT', '')} input attached`;
        }

        if (output && typeof output === 'string') {
          const tokens = this.estimateTokens(output);

          if (tokensUsed + tokens <= maxTokens) {
            results.push({
              podId: pod.id,
              output,
              timestamp: pod.createdAt,
              category: 'LIVE_DATA',
              type: pod.type,
            });
            tokensUsed += tokens;

            this.logger.debug(
              `Fetched static content from pod ${pod.id} (${pod.type}): "${output.substring(0, 50)}..."`,
            );
          }
        }
      } catch (error) {
        this.logger.error(`Failed to fetch DynamoDB content for pod ${pod.id}: ${error}`);
      }
    }

    return results;
  }

  private async getRecursiveUpstreamPodsWithTypes(
    podId: string,
    flowId: string,
    visited: Set<string> = new Set(),
  ): Promise<Array<{ id: string; type: PodType }>> {
    if (visited.has(podId)) return [];
    visited.add(podId);

    const edges = await this.prisma.edge.findMany({
      where: { flowId, targetPodId: podId },
      select: {
        sourcePodId: true,
        sourcePod: {
          select: {
            id: true,
            type: true,
          },
        },
      },
    });

    if (edges.length === 0) return [];

    const allAncestors = edges.map((e) => ({
      id: e.sourcePod.id,
      type: e.sourcePod.type,
    }));

    for (const edge of edges) {
      const ancestorsOfUpstream = await this.getRecursiveUpstreamPodsWithTypes(
        edge.sourcePodId,
        flowId,
        visited,
      );
      allAncestors.push(...ancestorsOfUpstream);
    }

    const uniqueMap = new Map(allAncestors.map((p) => [p.id, p]));
    return Array.from(uniqueMap.values());
  }

  private estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }

  async resolveContext(podId: string, flowId: string): Promise<ContextChain> {
    return this.resolveContextWithPins(podId, flowId);
  }

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
            category: 'HISTORY',
            type: 'LLM_PROMPT',
          });
        }
      }
    }

    if (latestPodIds.length > 0) {
      const latestExecutions = await this.prisma.podExecution.findMany({
        where: {
          podId: { in: latestPodIds },
          status: 'COMPLETED',
        },
        distinct: ['podId'],
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
            category: 'HISTORY',
            type: 'LLM_PROMPT',
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
      variables[key] = val.join('\\n\\n');
    });
    return variables;
  }

  private async getUpstreamPods(podId: string, flowId: string): Promise<string[]> {
    const upstreamEdges = await this.prisma.edge.findMany({
      where: { flowId, targetPodId: podId },
      select: { sourcePodId: true },
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
        return parts.map((p: any) => p.text || '').join('\\n');
      }
      if (responseMetadata?.choices?.[0]?.message?.content) {
        return responseMetadata.choices[0].message.content;
      }
      if (Array.isArray(responseMetadata?.content)) {
        const textBlocks = responseMetadata.content.filter((block: any) => block.type === 'text');
        return textBlocks.map((block: any) => block.text).join('\\n');
      }
      return null;
    } catch (err) {
      this.logger.error('Failed to extract output from response', err);
      return null;
    }
  }

  interpolateVariables(text: string, variables: Record<string, string>): string {
    let result = text;
    const variableRegex = /\\{\\{([a-zA-Z0-9_-]+)(?:\\.output)?\\}\\}/g;
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
    return text.replace(/[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]/g, '').trim();
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
      category: 'HISTORY',
      type: 'LLM_PROMPT',
    }));
  }
}
