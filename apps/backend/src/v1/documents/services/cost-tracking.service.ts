/**
 * Document Cost Tracking Service
 *
 * @description Tracks and reports document processing costs and credit usage.
 * Provides analytics for workspace administrators and billing insights.
 * Integrates with subscription system for credit management.
 *
 * @module v1/documents/services/cost-tracking
 */

import { Injectable, Logger } from '@nestjs/common';
import type { DocumentProcessingType } from '@actopod/schema';
import { PrismaService } from '../../../prisma/prisma.service';
import { DocumentCostSummary, DocumentDailyCost } from '../types';

/**
 * Document cost tracking service
 *
 * @description Provides cost analytics and reporting for document processing.
 * Tracks credits consumed, USD costs, and processing statistics.
 */
@Injectable()
export class V1DocumentCostTrackingService {
  private readonly logger = new Logger(V1DocumentCostTrackingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get cost summary for workspace
   *
   * @description Aggregates all processing costs for a workspace within date range.
   * Returns breakdown by processing type (embedding, OCR, extraction, etc.)
   *
   * @param workspaceId - Workspace ID
   * @param startDate - Start date (optional, defaults to all time)
   * @param endDate - End date (optional, defaults to now)
   * @returns Comprehensive cost summary with breakdowns
   *
   * @example
   * ```
   * const summary = await costTracking.getWorkspaceCostSummary('ws_123');
   * console.log(summary.totalCost); // 2.45
   * console.log(summary.totalCredits); // 24500
   * ```
   */
  async getWorkspaceCostSummary(
    workspaceId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<DocumentCostSummary> {
    this.logger.log(`[Cost Tracking] Getting summary for workspace: ${workspaceId}`);

    const where: any = { workspaceId };
    if (startDate || endDate) {
      where.processedAt = {};
      if (startDate) where.processedAt.gte = startDate;
      if (endDate) where.processedAt.lte = endDate;
    }

    const costs = await this.prisma.documentProcessingCost.findMany({
      where,
      select: {
        processingType: true,
        totalCostInUsd: true,
        creditsConsumed: true,
        tokensProcessed: true,
        chunkCount: true,
      },
    });

    // Calculate totals with null handling
    const totalCost = costs.reduce((sum, c) => sum + Number(c.totalCostInUsd), 0);
    const totalCredits = costs.reduce((sum, c) => sum + c.creditsConsumed, 0);
    const documentsProcessed = costs.length;
    const tokensProcessed = costs.reduce((sum, c) => sum + c.tokensProcessed, 0);
    const chunksCreated = costs.reduce((sum, c) => sum + (c.chunkCount || 0), 0);

    // Group by processing type
    const typeMap = new Map<
      DocumentProcessingType,
      { cost: number; credits: number; count: number }
    >();

    costs.forEach((c) => {
      const existing = typeMap.get(c.processingType) || { cost: 0, credits: 0, count: 0 };
      typeMap.set(c.processingType, {
        cost: existing.cost + Number(c.totalCostInUsd),
        credits: existing.credits + c.creditsConsumed,
        count: existing.count + 1,
      });
    });

    const byType = Array.from(typeMap.entries()).map(([type, data]) => ({
      type,
      ...data,
    }));

    return {
      totalCost,
      totalCredits,
      documentsProcessed,
      tokensProcessed,
      chunksCreated,
      byType,
    };
  }

  /**
   * Get daily cost breakdown
   *
   * @description Returns daily aggregated costs for the last N days.
   * Useful for generating cost trend charts.
   *
   * @param workspaceId - Workspace ID
   * @param days - Number of days to retrieve (default 30)
   * @returns Array of daily costs, sorted by date descending
   *
   * @example
   * ```
   * const dailyCosts = await costTracking.getDailyCostBreakdown('ws_123', 7);
   * dailyCosts.forEach(day => {
   *   console.log(`${day.date}: $${day.cost} (${day.credits} credits)`);
   * });
   * ```
   */
  async getDailyCostBreakdown(
    workspaceId: string,
    days: number = 30,
  ): Promise<DocumentDailyCost[]> {
    this.logger.log(`[Cost Tracking] Getting daily breakdown for ${days} days: ${workspaceId}`);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Use raw SQL for date grouping
    const results = await this.prisma.$queryRaw<
      Array<{
        date: Date;
        total_cost: number;
        total_credits: number;
        doc_count: number;
      }>
    >`
      SELECT
        DATE("processedAt") as date,
        SUM("totalCostInUsd")::float as total_cost,
        SUM("creditsConsumed") as total_credits,
        COUNT(*)::int as doc_count
      FROM documents."DocumentProcessingCost"
      WHERE "workspaceId" = ${workspaceId}
        AND "processedAt" >= ${startDate}
      GROUP BY DATE("processedAt")
      ORDER BY date DESC
    `;

    return results.map((r) => ({
      date: r.date.toISOString().split('T')[0],
      cost: Number(r.total_cost),
      credits: Number(r.total_credits),
      documentsProcessed: r.doc_count,
    }));
  }

  /**
   * Get cost for specific document
   *
   * @description Retrieves detailed cost information for a single document.
   * Includes breakdown of extraction vs embedding costs.
   *
   * @param documentId - Document ID
   * @returns Cost details or null if not found
   *
   * @example
   * ```
   * const cost = await costTracking.getDocumentCost('doc_123');
   * if (cost) {
   *   console.log(`Embedding: $${cost.embeddingCost}`);
   *   console.log(`Extraction: $${cost.extractionCost}`);
   * }
   * ```
   */
  async getDocumentCost(documentId: string): Promise<{
    processingType: DocumentProcessingType;
    totalCostInUsd: number;
    creditsConsumed: number;
    extractionCost: number;
    embeddingCost: number;
    tokensProcessed: number;
    chunkCount: number;
    embeddingModel: string | null;
    processedAt: Date;
  } | null> {
    const cost = await this.prisma.documentProcessingCost.findFirst({
      where: { documentId },
      select: {
        processingType: true,
        totalCostInUsd: true,
        creditsConsumed: true,
        extractionCost: true,
        embeddingCost: true,
        tokensProcessed: true,
        chunkCount: true,
        embeddingModel: true,
        processedAt: true,
      },
    });

    if (!cost) return null;

    return {
      processingType: cost.processingType,
      totalCostInUsd: Number(cost.totalCostInUsd),
      creditsConsumed: cost.creditsConsumed,
      extractionCost: Number(cost.extractionCost),
      embeddingCost: Number(cost.embeddingCost),
      tokensProcessed: cost.tokensProcessed,
      chunkCount: cost.chunkCount || 0,
      embeddingModel: cost.embeddingModel,
      processedAt: cost.processedAt,
    };
  }

  /**
   * Get top costly documents
   *
   * @description Returns documents with highest processing costs.
   * Useful for identifying expensive documents and optimization opportunities.
   *
   * @param workspaceId - Workspace ID
   * @param limit - Number of documents to return (default 10)
   * @returns Array of documents sorted by cost descending
   *
   * @example
   * ```
   * const topCostly = await costTracking.getTopCostlyDocuments('ws_123', 5);
   * topCostly.forEach(doc => {
   *   console.log(`${doc.documentName}: $${doc.cost}`);
   * });
   * ```
   */
  async getTopCostlyDocuments(workspaceId: string, limit: number = 10) {
    const costs = await this.prisma.documentProcessingCost.findMany({
      where: { workspaceId },
      orderBy: { totalCostInUsd: 'desc' },
      take: limit,
      select: {
        document: {
          select: {
            id: true,
            name: true,
            sizeInBytes: true,
          },
        },
        totalCostInUsd: true,
        creditsConsumed: true,
        tokensProcessed: true,
        chunkCount: true,
        processedAt: true,
      },
    });

    return costs.map((c) => ({
      documentId: c.document.id,
      documentName: c.document.name,
      fileSize: c.document.sizeInBytes,
      cost: Number(c.totalCostInUsd),
      credits: c.creditsConsumed,
      tokensProcessed: c.tokensProcessed,
      chunksCreated: c.chunkCount || 0,
      processedAt: c.processedAt,
    }));
  }

  /**
   * Estimate cost for document upload
   *
   * @description Provides upfront cost estimate based on file size.
   * Uses rough heuristics: 1 MB ≈ 20 pages ≈ 10,000 tokens.
   *
   * @param fileSizeBytes - File size in bytes
   * @returns Estimated tokens, USD cost, and credits
   *
   * @example
   * ```
   * const estimate = await costTracking.estimateDocumentCost(5 * 1024 * 1024); // 5 MB
   * console.log(`Estimated: ${estimate.estimatedCredits} credits`);
   * ```
   */
  async estimateDocumentCost(fileSizeBytes: number): Promise<{
    estimatedTokens: number;
    estimatedCost: number;
    estimatedCredits: number;
  }> {
    // Estimation: 1 MB ≈ 20 pages, 1 page ≈ 500 tokens
    const estimatedPages = (fileSizeBytes / (1024 * 1024)) * 20;
    const estimatedTokens = Math.ceil(estimatedPages * 500);

    // Gemini embedding cost: $0.01 per 1M tokens
    const estimatedCost = (estimatedTokens / 1_000_000) * 0.01;

    // Convert to credits (1 credit = $0.0001)
    const estimatedCredits = Math.ceil(estimatedCost / 0.0001);

    return {
      estimatedTokens,
      estimatedCost,
      estimatedCredits,
    };
  }
}
