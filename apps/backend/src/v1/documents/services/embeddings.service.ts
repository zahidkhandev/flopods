// /src/modules/v1/documents/services/embeddings.service.ts

import axios, { AxiosError } from 'axios';
import {
  Injectable,
  Logger,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentStatus, LLMProvider } from '@flopods/schema';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../prisma/prisma.service';
import { S3Service } from '../../../common/aws/s3/s3.service';
import { ApiKeyEncryptionService } from '../../../common/services/encryption.service'; // ✅ Import
import { chunkDocumentText } from '../utils';
import type { DocumentEmbeddingConfig, DocumentEmbeddingProvider } from '../types';
import { V1DocumentQueueProducer } from '../queues/document-queue.producer';
import { calculateProfitData, calculateCreditsFromCharge } from '../../../config/profit.config';
import { V1ApiKeyService } from '../../workspace/services/api-key.service';

interface GeminiEmbeddingResponse {
  embedding?: { values?: number[] };
  error?: { message?: string; code?: string };
}

interface RateLimitState {
  requestsThisMinute: number;
  lastResetTime: number;
  isRateLimited: boolean;
  consecutiveErrors: number;
  cooldownUntil: number;
}

@Injectable()
export class V1DocumentEmbeddingsService {
  private readonly logger = new Logger(V1DocumentEmbeddingsService.name);
  private readonly defaultBaseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  private readonly EMBEDDING_TIMEOUT = 60000;

  // ✅ Rate limit tracking per API key with cooldown
  private readonly rateLimitState = new Map<string, RateLimitState>();

  // ✅ Gemini Tier limits
  private readonly RATE_LIMITS = {
    FREE_TIER: {
      requestsPerMinute: 15,
      requestsPerDay: 100,
      requestsPerDayPerUser: 100,
    },
    PAID: {
      requestsPerMinute: 1000,
      requestsPerDay: 1_000_000,
      requestsPerDayPerUser: 1_000_000,
    },
  };

  // ✅ Escalating cooldown for 429 errors
  private readonly COOLDOWN = {
    FIRST_429: 5000,
    SECOND_429: 30000,
    THIRD_429: 300000,
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    private readonly configService: ConfigService,
    private readonly queueProducer: V1DocumentQueueProducer,
    private readonly encryptionService: ApiKeyEncryptionService, // ✅ Inject
    private readonly apiKeyService: V1ApiKeyService, // ✅ Inject
  ) {}

  private sanitizeText(text: string): string {
    return text
      .replace(/\0/g, '')
      .replace(/\uFFFD/g, '')
      .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
      .trim();
  }

  private async getEmbeddingPricing(): Promise<{
    pricing: any;
    provider: DocumentEmbeddingProvider;
  }> {
    const pricing = await this.prisma.modelPricingTier.findFirst({
      where: {
        provider: LLMProvider.GOOGLE_GEMINI,
        modelId: 'embedding-001',
        isActive: true,
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (!pricing) {
      throw new NotFoundException('Embedding pricing not found in database');
    }

    let providerConfig: any = {};
    if (pricing.providerConfig) {
      try {
        providerConfig = JSON.parse(pricing.providerConfig as string);
      } catch (e) {
        this.logger.warn('Failed to parse providerConfig, using defaults');
      }
    }

    const provider: DocumentEmbeddingProvider = {
      model: pricing.modelId,
      dimensions: providerConfig.dimensions || 768,
      costPer1MTokens: Number(pricing.inputTokenCost),
    };

    return { pricing, provider };
  }

  // ✅ Get or init rate limit state
  private getOrInitRateLimitState(apiKeyFingerprint: string): RateLimitState {
    if (!this.rateLimitState.has(apiKeyFingerprint)) {
      this.rateLimitState.set(apiKeyFingerprint, {
        requestsThisMinute: 0,
        lastResetTime: Date.now(),
        isRateLimited: false,
        consecutiveErrors: 0,
        cooldownUntil: 0,
      });
    }
    return this.rateLimitState.get(apiKeyFingerprint)!;
  }

  // ✅ SMART rate limiting with cooldown
  private async checkRateLimit(
    apiKeyFingerprint: string,
    tier: 'FREE_TIER' | 'PAID',
  ): Promise<void> {
    const state = this.getOrInitRateLimitState(apiKeyFingerprint);
    const limits = this.RATE_LIMITS[tier];
    const now = Date.now();

    // ✅ Check if in hard cooldown
    if (state.cooldownUntil > now) {
      const waitTime = state.cooldownUntil - now;
      this.logger.warn(
        `[Embeddings] 🛑 HARD COOLDOWN (${tier}). Waiting ${Math.round(waitTime / 1000)}s before retry. Consecutive errors: ${state.consecutiveErrors}`,
      );
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      state.cooldownUntil = 0;
      state.consecutiveErrors = 0;
      return;
    }

    // Reset minute counter if 60s passed
    if (now - state.lastResetTime > 60000) {
      state.requestsThisMinute = 0;
      state.lastResetTime = now;
    }

    // ✅ Prevent queuing more than limit per minute
    if (state.requestsThisMinute >= limits.requestsPerMinute) {
      const waitTime = 60000 - (now - state.lastResetTime);
      this.logger.warn(
        `[Embeddings] ⏳ Rate limit reached (${state.requestsThisMinute}/${limits.requestsPerMinute}). Waiting ${Math.round(waitTime / 1000)}s...`,
      );
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      state.requestsThisMinute = 0;
      state.lastResetTime = Date.now();
    }

    state.requestsThisMinute++;
  }

  // ✅ Detect tier (FREE vs PAID)
  private async detectTier(apiKey: string): Promise<'FREE_TIER' | 'PAID'> {
    if (apiKey === this.configService.get<string>('GEMINI_API_KEY')) {
      return 'FREE_TIER';
    }
    return 'PAID';
  }

  // ✅ FIXED: Use axios with smart cooldown
  private async embedChunkWithRetry(
    apiKey: string,
    text: string,
    modelId: string = 'embedding-001',
    maxRetries: number = 3,
    apiKeyFingerprint: string = 'default',
  ): Promise<number[]> {
    let lastError: Error | null = null;

    if (!apiKey || apiKey.length < 20) {
      throw new Error('Invalid API key format (too short)');
    }

    const tier = await this.detectTier(apiKey);

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        this.logger.debug(
          `[Embeddings] 🔄 Embedding attempt ${attempt + 1}/${maxRetries} (${tier})`,
        );

        // ✅ Check rate limit BEFORE making request
        await this.checkRateLimit(apiKeyFingerprint, tier);

        const url = `${this.defaultBaseUrl}/models/${modelId}:embedContent?key=${apiKey}`;

        try {
          new URL(url);
        } catch (e) {
          throw new Error('Invalid API URL constructed');
        }

        this.logger.debug(`[Embeddings] 📡 Calling: ${url.substring(0, 80)}...`);

        const response = await axios.post<GeminiEmbeddingResponse>(
          url,
          {
            model: `models/${modelId}`,
            content: { parts: [{ text }] },
          },
          {
            timeout: this.EMBEDDING_TIMEOUT,
            headers: { 'Content-Type': 'application/json' },
          },
        );

        const data = response.data;
        const embedding = data.embedding?.values;

        if (!embedding || !Array.isArray(embedding)) {
          throw new Error(`Invalid embedding response: ${JSON.stringify(data)}`);
        }

        // ✅ Success! Reset error counter
        const state = this.getOrInitRateLimitState(apiKeyFingerprint);
        state.consecutiveErrors = 0;

        this.logger.debug(`[Embeddings] ✅ Embedding succeeded (${embedding.length} dimensions)`);
        return embedding;
      } catch (error) {
        const axiosError = error as AxiosError<GeminiEmbeddingResponse>;
        const state = this.getOrInitRateLimitState(apiKeyFingerprint);

        if (axiosError.response) {
          const status = axiosError.response.status;
          const errorMsg = axiosError.response.data?.error?.message || axiosError.message;

          this.logger.error(`[Embeddings] ❌ HTTP ${status}: ${errorMsg}`);

          // ✅ Handle 429 with escalating cooldown
          if (status === 429) {
            state.consecutiveErrors++;

            let cooldownTime = this.COOLDOWN.FIRST_429;
            let cooldownLevel = 'SOFT';

            if (state.consecutiveErrors >= 3) {
              cooldownTime = this.COOLDOWN.THIRD_429;
              cooldownLevel = 'HARD';
            } else if (state.consecutiveErrors >= 2) {
              cooldownTime = this.COOLDOWN.SECOND_429;
              cooldownLevel = 'MEDIUM';
            }

            state.cooldownUntil = Date.now() + cooldownTime;
            state.isRateLimited = true;

            this.logger.error(
              `[Embeddings] 🚫 QUOTA EXCEEDED (429) - ${cooldownLevel} COOLDOWN. ` +
                `Consecutive errors: ${state.consecutiveErrors}/3. ` +
                `Waiting ${Math.round(cooldownTime / 1000)}s before next attempt...`,
            );

            if (attempt < maxRetries - 1) {
              await new Promise((resolve) => setTimeout(resolve, cooldownTime));
              continue;
            }

            throw new Error(
              `Rate limited (429) after ${state.consecutiveErrors} consecutive errors. ` +
                `Exceeded Gemini API quota. Upgrade to paid tier or wait until quota resets.`,
            );
          }

          if (status === 401 || status === 403) {
            throw new Error(`Unauthorized: Invalid or expired API key. Status: ${status}.`);
          }

          if (status === 500 || status === 503) {
            throw new Error(`Service unavailable. Status: ${status}`);
          }

          lastError = new Error(`HTTP ${status}: ${errorMsg}`);
        } else if (axiosError.request) {
          this.logger.error(`[Embeddings] ❌ No response from server: ${axiosError.message}`);
          lastError = new Error(`No response from server: ${axiosError.message}`);
        } else {
          this.logger.error(`[Embeddings] ❌ Request error: ${axiosError.message}`);
          lastError = axiosError as Error;
        }

        // ✅ Exponential backoff for non-429 errors
        if (attempt < maxRetries - 1) {
          const baseWait = Math.pow(2, attempt) * 1000;
          const jitter = Math.random() * 500;
          const totalWait = baseWait + jitter;

          this.logger.warn(
            `[Embeddings] ⚠️ Attempt ${attempt + 1} failed, retrying in ${Math.round(totalWait)}ms: ${lastError.message}`,
          );

          await new Promise((resolve) => setTimeout(resolve, totalWait));
        }
      }
    }

    throw new Error(`Failed to embed after ${maxRetries} attempts: ${lastError?.message}`);
  }

  async generateDocumentEmbeddings(documentId: string, text: string): Promise<void> {
    this.logger.log(`[Embeddings] 🚀 Starting for: ${documentId}`);

    const sanitizedText = this.sanitizeText(text);

    if (!sanitizedText || sanitizedText.length < 10) {
      throw new BadRequestException('Document text is empty or too short after sanitization');
    }

    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, workspaceId: true, name: true },
    });

    if (!document) {
      throw new BadRequestException(`Document not found: ${documentId}`);
    }

    const config = await this.getDocumentEmbeddingConfig(document.workspaceId);
    const chunks = chunkDocumentText(sanitizedText);
    const totalTokens = chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0);

    const { pricing, provider } = await this.getEmbeddingPricing();

    const actualCostUsd = (totalTokens / 1_000_000) * provider.costPer1MTokens;
    const profitData = calculateProfitData(actualCostUsd);
    const creditsToCharge = calculateCreditsFromCharge(profitData.userChargeUsd);

    this.logger.debug(
      `[Embeddings] 📊 ${chunks.length} chunks, ${totalTokens} tokens | ` +
        `Model: ${provider.model} (${provider.dimensions}d) | ` +
        `Cost: $${actualCostUsd.toFixed(6)} | Charge: $${profitData.userChargeUsd.toFixed(6)} | ` +
        `Profit: $${profitData.profitUsd.toFixed(6)}`,
    );

    const subscription = await this.prisma.subscription.findUnique({
      where: { workspaceId: document.workspaceId },
      select: { id: true, credits: true, isByokMode: true },
    });

    if (!subscription) {
      throw new ForbiddenException('No active subscription found');
    }

    if (!subscription.isByokMode && subscription.credits < creditsToCharge) {
      throw new ForbiddenException(
        `Insufficient credits. Required: ${creditsToCharge}, Available: ${subscription.credits}`,
      );
    }

    const vectorBucket = this.configService.getOrThrow<string>('DOCUMENT_VECTOR_S3_BUCKET');

    // ✅ PROCESS CHUNKS SEQUENTIALLY - ONE AT A TIME
    const apiKeyFingerprint = this.encryptionService.getFingerprint(config.apiKey); // ✅ Use service

    this.logger.log(
      `[Embeddings] 📋 Processing ${chunks.length} chunks sequentially (respecting rate limits)...`,
    );

    for (const chunk of chunks) {
      const cleanChunkText = this.sanitizeText(chunk.text);

      const embedding = await this.embedChunkWithRetry(
        config.apiKey,
        cleanChunkText,
        provider.model,
        3,
        apiKeyFingerprint,
      );

      const s3Key = `embeddings/${documentId}/chunk-${chunk.index}.json`;
      await this.s3Service.uploadFile({
        key: s3Key,
        body: Buffer.from(
          JSON.stringify(
            {
              documentId: document.id,
              documentName: document.name,
              workspaceId: document.workspaceId,
              chunkIndex: chunk.index,
              chunkText: cleanChunkText,
              embedding,
              tokenCount: chunk.tokenCount,
              model: provider.model,
              dimensions: provider.dimensions,
              generatedAt: new Date().toISOString(),
            },
            null,
            2,
          ),
        ),
        contentType: 'application/json',
      });

      const vectorString = `[${embedding.join(',')}]`;

      await this.prisma.$executeRaw`
        INSERT INTO "documents"."Embedding"
        (id, "documentId", model, "chunkIndex", "chunkText", vector, "s3VectorBucket", "s3VectorKey", "vectorDimension", metadata, "createdAt")
        VALUES (
          gen_random_uuid()::text,
          ${document.id},
          ${provider.model},
          ${chunk.index},
          ${cleanChunkText},
          ${vectorString}::vector(768),
          ${vectorBucket},
          ${s3Key},
          ${provider.dimensions},
          ${JSON.stringify({
            tokenCount: chunk.tokenCount,
            startChar: chunk.startChar,
            endChar: chunk.endChar,
            workspaceId: document.workspaceId,
            documentName: document.name,
          })}::jsonb,
          NOW()
        )
      `;

      this.logger.log(`[Embeddings] ✅ Chunk ${chunk.index + 1}/${chunks.length} completed`);
    }

    if (!subscription.isByokMode) {
      await this.prisma.subscription.update({
        where: { workspaceId: document.workspaceId },
        data: { credits: { decrement: creditsToCharge } },
      });
    }

    await this.recordDocumentProcessingCost(
      document.id,
      document.workspaceId,
      subscription.id,
      totalTokens,
      chunks.length,
      actualCostUsd,
      creditsToCharge,
      profitData.profitUsd,
      subscription.isByokMode,
      provider.model,
      provider.dimensions,
    );

    this.logger.log(
      `[Embeddings] 🎉 Completed ${documentId}: ${chunks.length} embeddings (${provider.dimensions}d) | ` +
        `Profit: $${profitData.profitUsd.toFixed(6)} 💰`,
    );
  }

  private async getDocumentEmbeddingConfig(
    workspaceId: string,
  ): Promise<DocumentEmbeddingConfig & { isPlatformKey: boolean }> {
    // ✅ FIX: Use ApiKeyService to get active key
    try {
      const apiKey = await this.apiKeyService.getActiveKey(workspaceId, LLMProvider.GOOGLE_GEMINI);

      if (apiKey) {
        this.logger.log(`[Embeddings] 🔑 Using workspace API key for: ${workspaceId}`);

        return {
          provider: { model: 'embedding-001', dimensions: 768, costPer1MTokens: 0.15 },
          apiKey,
          batchSize: 1,
          concurrency: 1,
          isPlatformKey: false,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `[Embeddings] ⚠️ Failed to get workspace key: ${errorMessage}. Falling back to platform key.`,
      );
    }

    // ✅ Fallback to platform key
    const platformKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!platformKey) {
      throw new ForbiddenException(
        'No Gemini API key available. Configure GEMINI_API_KEY in .env or add workspace key with paid tier.',
      );
    }

    if (platformKey.length < 20) {
      throw new ForbiddenException(
        'GEMINI_API_KEY is invalid (too short). Please check your .env configuration.',
      );
    }

    this.logger.warn(
      `[Embeddings] ⚠️ Using platform FREE TIER API key. Limited to 15 requests/minute. Upgrade to paid tier for better limits.`,
    );

    return {
      provider: { model: 'embedding-001', dimensions: 768, costPer1MTokens: 0.15 },
      apiKey: platformKey,
      batchSize: 1,
      concurrency: 1,
      isPlatformKey: true,
    };
  }

  private async recordDocumentProcessingCost(
    documentId: string,
    workspaceId: string,
    subscriptionId: string,
    tokensProcessed: number,
    chunkCount: number,
    actualCostUsd: number,
    creditsCharged: number,
    profitUsd: any,
    isByokMode: boolean,
    modelId: string,
    dimensions: number,
  ): Promise<void> {
    await this.prisma.documentProcessingCost.create({
      data: {
        documentId,
        workspaceId,
        subscriptionId,
        processingType: 'DOCUMENT_EMBEDDING',
        creditsConsumed: creditsCharged,
        extractionCost: new Decimal(0),
        embeddingCost: new Decimal(actualCostUsd),
        visionCost: new Decimal(0),
        totalCostInUsd: new Decimal(actualCostUsd),
        chunkCount,
        embeddingModel: modelId,
        tokensProcessed,
        visionTokens: 0,
      },
    });

    const dummyCanvasId = 'system-embedding';
    const dummyPodId = 'system-embedding';
    const dummyExecutionId = `embed_${documentId}_${Date.now()}`;

    await this.prisma.creditUsageLog.create({
      data: {
        subscriptionId,
        workspaceId,
        canvasId: dummyCanvasId,
        podId: dummyPodId,
        executionId: dummyExecutionId,
        creditsUsed: creditsCharged,
        balanceBefore: 0,
        balanceAfter: 0,
        provider: 'GOOGLE_GEMINI',
        modelId,
        modelName: `Gemini Embedding (${dimensions}d)`,
      },
    });

    this.logger.debug(
      `[Embeddings] 💰 Cost recorded: $${actualCostUsd.toFixed(6)} | Credits: ${creditsCharged}`,
    );
  }

  // ✅ REMOVED: encryptApiKey & decryptApiKey (now in EncryptionService)

  async regenerateDocumentEmbeddings(documentId: string): Promise<{
    documentId: string;
    status: string;
    message: string;
    jobId: string;
  }> {
    this.logger.log(`[Embeddings] 🔄 Regenerating embeddings for: ${documentId}`);

    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        workspaceId: true,
        name: true,
        storageKey: true,
        externalUrl: true,
      },
    });

    if (!document) {
      throw new NotFoundException(`Document not found: ${documentId}`);
    }

    if (!document.storageKey && !document.externalUrl) {
      throw new BadRequestException('Document has no source file to regenerate from');
    }

    // ✅ Delete existing embeddings
    const existingEmbeddings = await this.prisma.embedding.findMany({
      where: { documentId },
      select: { s3VectorKey: true },
    });

    if (existingEmbeddings.length > 0) {
      try {
        const s3Keys = existingEmbeddings.map((e) => e.s3VectorKey);
        await this.s3Service.deleteFiles(s3Keys);
        await this.prisma.embedding.deleteMany({ where: { documentId } });
        this.logger.log(`[Embeddings] 🗑️ Deleted ${existingEmbeddings.length} old embeddings`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn(`[Embeddings] ⚠️ Cleanup warning: ${errorMsg}`);
      }
    }

    // ✅ Update document status to PROCESSING
    await this.prisma.document.update({
      where: { id: documentId },
      data: { status: DocumentStatus.PROCESSING },
    });

    this.logger.log(`[Embeddings] 📋 Document marked as PROCESSING`);

    // ✅ Queue the regeneration job
    const jobId = await this.queueProducer.sendDocumentReprocessingJob({
      documentId: document.id,
      workspaceId: document.workspaceId,
      userId: 'system',
    });

    this.logger.log(
      `[Embeddings] ✅ Regeneration job queued (Job ID: ${jobId}) for "${document.name}"`,
    );

    return {
      documentId,
      status: 'queued',
      jobId,
      message:
        `Regeneration job queued. Deleted ${existingEmbeddings.length} old embeddings. ` +
        `Document will be re-embedded shortly. This will consume credits equal to initial processing.`,
    };
  }

  async getEmbeddingStatus(documentId: string): Promise<{
    documentId: string;
    status: string;
    embeddingsCount: number;
    lastUpdated: string | null;
  }> {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, status: true, updatedAt: true },
    });

    if (!document) {
      throw new NotFoundException(`Document not found: ${documentId}`);
    }

    const embeddingsCount = await this.prisma.embedding.count({
      where: { documentId },
    });

    this.logger.debug(
      `[Embeddings] Status check: ${embeddingsCount} embeddings, status=${document.status}`,
    );

    return {
      documentId,
      status: document.status,
      embeddingsCount,
      lastUpdated: document.updatedAt?.toISOString() || null,
    };
  }
}
