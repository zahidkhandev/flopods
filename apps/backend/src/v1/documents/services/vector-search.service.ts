// /src/modules/v1/documents/services/vector-search.service.ts

import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ConfigService } from '@nestjs/config';
import { LLMProvider } from '@flopods/schema';
import { PrismaService } from '../../../prisma/prisma.service';
import { DocumentVectorSearchResult } from '../types';
import type { DocumentEmbeddingProvider } from '../types';
import {
  calculateProfitData,
  calculateCreditsFromCharge,
  PROFIT_CONFIG,
} from '../../../config/profit.config';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class V1DocumentVectorSearchService {
  private readonly logger = new Logger(V1DocumentVectorSearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  // ✅ Get embedding pricing from DB
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
      orderBy: {
        effectiveFrom: 'desc',
      },
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

  async searchDocuments(
    workspaceId: string,
    query: string,
    options: {
      documentIds?: string[];
      folderId?: string;
      topK?: number;
      minSimilarity?: number;
    } = {},
  ): Promise<DocumentVectorSearchResult[]> {
    const { documentIds, folderId, topK = 5, minSimilarity = 0.7 } = options;

    this.logger.log(`[Vector Search] Query: "${query}" (workspace: ${workspaceId})`);

    const queryEmbedding = await this.generateQueryEmbedding(query, workspaceId);
    const vectorString = `[${queryEmbedding.join(',')}]`;

    const results = await this.prisma.$queryRaw<
      Array<{
        embedding_id: string;
        document_id: string;
        document_name: string;
        chunk_index: number;
        chunk_text: string;
        similarity: number;
        document_metadata: any;
      }>
    >`
      SELECT
        e.id as embedding_id,
        d.id as document_id,
        d.name as document_name,
        e."chunkIndex" as chunk_index,
        e."chunkText" as chunk_text,
        1 - (e.vector <=> ${vectorString}::vector) as similarity,
        d.metadata as document_metadata
      FROM documents."Embedding" e
      INNER JOIN documents."Document" d ON e."documentId" = d.id
      WHERE d."workspaceId" = ${workspaceId}
        AND d.status = 'READY'
        ${documentIds && documentIds.length > 0 ? `AND d.id = ANY(${JSON.stringify(documentIds)}::text[])` : ''}
        ${folderId ? `AND d."folderId" = '${folderId}'` : ''}
        AND 1 - (e.vector <=> ${vectorString}::vector) >= ${minSimilarity}
      ORDER BY e.vector <=> ${vectorString}::vector
      LIMIT ${topK}
    `;

    const searchResults: DocumentVectorSearchResult[] = results.map((row) => ({
      embeddingId: row.embedding_id,
      documentId: row.document_id,
      documentName: row.document_name,
      chunkIndex: row.chunk_index,
      chunkText: row.chunk_text,
      similarity: Number(row.similarity.toFixed(4)),
      documentMetadata: row.document_metadata || {},
    }));

    this.logger.log(
      `[Vector Search] Found ${searchResults.length} results (min similarity: ${minSimilarity})`,
    );

    // ✅ Track search cost
    await this.trackSearchCost(workspaceId, query, searchResults.length);

    return searchResults;
  }

  private async generateQueryEmbedding(query: string, workspaceId: string): Promise<number[]> {
    const workspaceApiKey = await this.prisma.providerAPIKey.findFirst({
      where: {
        workspaceId,
        provider: 'GOOGLE_GEMINI',
        isActive: true,
      },
    });

    // ✅ Get embedding pricing from DB
    const { provider } = await this.getEmbeddingPricing();

    const apiKey = workspaceApiKey
      ? this.decryptApiKey(workspaceApiKey.keyHash)
      : this.configService.get<string>('GEMINI_API_KEY');

    if (!apiKey) {
      throw new BadRequestException('Gemini API key not configured');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: provider.model });

    const result = await model.embedContent(query);
    return result.embedding.values;
  }

  // ✅ Track search cost with profit
  private async trackSearchCost(
    workspaceId: string,
    query: string,
    resultsCount: number,
  ): Promise<void> {
    try {
      const { provider, pricing } = await this.getEmbeddingPricing();

      // Estimate tokens for query (rough: ~0.25 tokens per char)
      const queryTokens = Math.ceil(query.length * 0.25);

      const actualCostUsd = (queryTokens / 1_000_000) * provider.costPer1MTokens;
      const profitData = calculateProfitData(actualCostUsd);
      const creditsToCharge = calculateCreditsFromCharge(profitData.userChargeUsd);

      const subscription = await this.prisma.subscription.findUnique({
        where: { workspaceId },
        select: { id: true, isByokMode: true },
      });

      if (!subscription) {
        this.logger.warn(`Subscription not found for workspace ${workspaceId}`);
        return;
      }

      // Log vector search
      await this.prisma.documentAPILog.create({
        data: {
          workspaceId,
          provider: LLMProvider.GOOGLE_GEMINI,
          modelId: provider.model,
          requestType: 'VECTOR_SEARCH',
          inputTokens: queryTokens,
          outputTokens: 0,
          totalTokens: queryTokens,
          statusCode: 200,
          success: true,
          estimatedCost: new Decimal(actualCostUsd).toString(),
          actualCost: new Decimal(actualCostUsd).toString(),
          metadata: {
            query: query.substring(0, 100),
            resultsCount,
            creditCharged: creditsToCharge,
            profitUsd: profitData.profitUsd.toFixed(6),
            multiplier: PROFIT_CONFIG.MARKUP_MULTIPLIER,
            byokMode: subscription.isByokMode,
          },
          processedAt: new Date(),
        },
      });

      // Track credits
      await this.prisma.creditUsageLog.create({
        data: {
          subscriptionId: subscription.id,
          workspaceId,
          canvasId: 'system-search',
          podId: 'system-search',
          executionId: `search_${Date.now()}`,
          creditsUsed: creditsToCharge,
          balanceBefore: 0,
          balanceAfter: 0,
          provider: LLMProvider.GOOGLE_GEMINI,
          modelId: provider.model,
          modelName: 'Vector Search',
        },
      });

      this.logger.debug(
        `[Vector Search] 💰 Query cost: $${actualCostUsd.toFixed(6)} | ` +
          `Charge: $${profitData.userChargeUsd.toFixed(6)} | ` +
          `Profit: $${profitData.profitUsd.toFixed(6)}`,
      );
    } catch (error) {
      this.logger.warn(`Failed to track search cost: ${error}`);
    }
  }

  private decryptApiKey(encryptedKey: string): string {
    const { createDecipheriv } = require('crypto');
    const key = this.configService.get<string>('API_KEY_ENCRYPTION_SECRET');
    if (!key) throw new Error('API_KEY_ENCRYPTION_SECRET not configured');

    const encryptionKey = Buffer.from(key, 'hex');
    const [ivHex, authTagHex, encrypted] = encryptedKey.split(':');

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = createDecipheriv('aes-256-gcm', encryptionKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
