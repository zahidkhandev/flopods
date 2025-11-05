// src/modules/v1/documents/services/cost-tracking.service.ts

import { Injectable, Logger } from '@nestjs/common';
import type { DocumentProcessingType } from '@flopods/schema';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  DocumentCostSummary,
  DocumentDailyCost,
  DocumentCostDetail,
  ROIMetrics,
  ProfitableDocument,
} from '../types';

@Injectable()
export class V1DocumentCostTrackingService {
  private readonly logger = new Logger(V1DocumentCostTrackingService.name);
  private readonly ACTUAL_EMBEDDING_COST_PER_1M = 0.15; // Google's actual cost

  constructor(private readonly prisma: PrismaService) {}

  // ✅ Get workspace profit summary (not just costs)
  async getWorkspaceProfitSummary(workspaceId: string, startDate?: Date, endDate?: Date) {
    this.logger.log(`[Cost Tracking] Getting PROFIT summary for workspace: ${workspaceId}`);

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
        embeddingCost: true,
      },
    });

    const totalCost = costs.reduce((sum, c) => sum + Number(c.totalCostInUsd), 0);
    const totalCredits = costs.reduce((sum, c) => sum + c.creditsConsumed, 0);
    const documentsProcessed = costs.length;
    const tokensProcessed = costs.reduce((sum, c) => sum + c.tokensProcessed, 0);
    const chunksCreated = costs.reduce((sum, c) => sum + (c.chunkCount || 0), 0);

    // ✅ Calculate profit: 100% markup (2x cost model)
    const totalProfit = totalCost;
    const totalRevenue = totalCost * 2;

    const typeMap = new Map<
      DocumentProcessingType,
      { cost: number; credits: number; count: number; profit: number; revenue: number }
    >();

    costs.forEach((c) => {
      const existing = typeMap.get(c.processingType) || {
        cost: 0,
        credits: 0,
        count: 0,
        profit: 0,
        revenue: 0,
      };
      const costAmount = Number(c.totalCostInUsd);
      typeMap.set(c.processingType, {
        cost: existing.cost + costAmount,
        credits: existing.credits + c.creditsConsumed,
        count: existing.count + 1,
        profit: existing.profit + costAmount,
        revenue: existing.revenue + costAmount * 2,
      });
    });

    const byType = Array.from(typeMap.entries()).map(([type, data]) => ({
      type,
      cost: data.cost,
      profit: data.profit,
      revenue: data.revenue,
      credits: data.credits,
      count: data.count,
    }));

    return {
      totalCost,
      totalProfit,
      totalRevenue,
      profitMarginPercentage: totalCost > 0 ? 100 : 0,
      documentsProcessed,
      tokensProcessed,
      chunksCreated,
      avgCostPerDocument: documentsProcessed > 0 ? totalCost / documentsProcessed : 0,
      avgProfitPerDocument: documentsProcessed > 0 ? totalProfit / documentsProcessed : 0,
      byType,
    };
  }

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

    const totalCost = costs.reduce((sum, c) => sum + Number(c.totalCostInUsd), 0);
    const totalCredits = costs.reduce((sum, c) => sum + c.creditsConsumed, 0);
    const documentsProcessed = costs.length;
    const tokensProcessed = costs.reduce((sum, c) => sum + c.tokensProcessed, 0);
    const chunksCreated = costs.reduce((sum, c) => sum + (c.chunkCount || 0), 0);

    const typeMap = new Map<
      DocumentProcessingType,
      { cost: number; credits: number; count: number; profit: number; revenue: number }
    >();

    costs.forEach((c) => {
      const existing = typeMap.get(c.processingType) || {
        cost: 0,
        credits: 0,
        count: 0,
        profit: 0,
        revenue: 0,
      };
      const costAmount = Number(c.totalCostInUsd);
      typeMap.set(c.processingType, {
        cost: existing.cost + costAmount,
        credits: existing.credits + c.creditsConsumed,
        count: existing.count + 1,
        profit: existing.profit + costAmount,
        revenue: existing.revenue + costAmount * 2,
      });
    });

    const byType = Array.from(typeMap.entries()).map(([type, data]) => ({
      type,
      cost: data.cost,
      profit: data.profit,
      revenue: data.revenue,
      credits: data.credits,
      count: data.count,
    }));

    return {
      totalCost,
      totalProfit: totalCost,
      totalRevenue: totalCost * 2,
      totalCredits,
      documentsProcessed,
      tokensProcessed,
      chunksCreated,
      profitMarginPercentage: 100,
      avgCostPerDocument: documentsProcessed > 0 ? totalCost / documentsProcessed : 0,
      avgProfitPerDocument: documentsProcessed > 0 ? totalCost / documentsProcessed : 0,
      byType,
    };
  }

  async getDailyCostBreakdown(
    workspaceId: string,
    days: number = 30,
  ): Promise<DocumentDailyCost[]> {
    this.logger.log(`[Cost Tracking] Getting daily breakdown for ${days} days: ${workspaceId}`);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

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
      profit: Number(r.total_cost),
      revenue: Number(r.total_cost) * 2,
      credits: Number(r.total_credits),
      documentsProcessed: r.doc_count,
    }));
  }

  async getDocumentCostWithROI(documentId: string): Promise<ProfitableDocument | null> {
    const cost = await this.prisma.documentProcessingCost.findFirst({
      where: { documentId },
      select: {
        document: {
          select: {
            id: true,
            name: true,
            sizeInBytes: true,
          },
        },
        processingType: true,
        totalCostInUsd: true,
        creditsConsumed: true,
        extractionCost: true,
        embeddingCost: true,
        visionCost: true,
        tokensProcessed: true,
        visionTokens: true,
        chunkCount: true,
        embeddingModel: true,
        processedAt: true,
      },
    });

    if (!cost) return null;

    const totalCostUsd = Number(cost.totalCostInUsd);
    const profitUsd = totalCostUsd;
    const revenueUsd = totalCostUsd * 2;

    return {
      documentId: cost.document.id,
      documentName: cost.document.name,
      fileSize: Number(cost.document.sizeInBytes || 0),
      costUsd: totalCostUsd,
      profitUsd,
      revenueUsd,
      roi: 100,
      creditsCharged: cost.creditsConsumed,
      tokensProcessed: cost.tokensProcessed,
      visionTokens: cost.visionTokens,
      chunksCreated: cost.chunkCount || 0,
      processedAt: cost.processedAt,
    };
  }

  async getDocumentCost(documentId: string): Promise<DocumentCostDetail | null> {
    const cost = await this.prisma.documentProcessingCost.findFirst({
      where: { documentId },
      select: {
        processingType: true,
        totalCostInUsd: true,
        creditsConsumed: true,
        extractionCost: true,
        embeddingCost: true,
        visionCost: true,
        tokensProcessed: true,
        visionTokens: true,
        chunkCount: true,
        embeddingModel: true,
        processedAt: true,
      },
    });

    if (!cost) return null;

    const costUsd = Number(cost.totalCostInUsd);

    return {
      documentId: '',
      documentName: '',
      fileSize: null,
      processingType: cost.processingType,
      totalCostUsd: costUsd,
      profitUsd: costUsd,
      revenueUsd: costUsd * 2,
      creditsConsumed: cost.creditsConsumed,
      extractionCost: Number(cost.extractionCost),
      embeddingCost: Number(cost.embeddingCost),
      visionCost: Number(cost.visionCost),
      tokensProcessed: cost.tokensProcessed,
      visionTokens: cost.visionTokens,
      chunkCount: cost.chunkCount || 0,
      embeddingModel: cost.embeddingModel,
      roi: 100,
      profitMarginPercentage: 100,
      processedAt: cost.processedAt,
    };
  }

  async getTopProfitableDocuments(
    workspaceId: string,
    limit: number = 10,
  ): Promise<ProfitableDocument[]> {
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
        visionTokens: true,
        chunkCount: true,
        processedAt: true,
      },
    });

    return costs.map((c) => {
      const costUsd = Number(c.totalCostInUsd);
      return {
        documentId: c.document.id,
        documentName: c.document.name,
        fileSize: c.document.sizeInBytes ? Number(c.document.sizeInBytes) : null,
        costUsd,
        profitUsd: costUsd,
        revenueUsd: costUsd * 2,
        roi: 100,
        creditsCharged: c.creditsConsumed,
        tokensProcessed: c.tokensProcessed,
        visionTokens: c.visionTokens,
        chunksCreated: c.chunkCount || 0,
        processedAt: c.processedAt,
      };
    });
  }

  async getTopCostlyDocuments(
    workspaceId: string,
    limit: number = 10,
  ): Promise<ProfitableDocument[]> {
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
        visionTokens: true,
        chunkCount: true,
        processedAt: true,
      },
    });

    return costs.map((c) => {
      const costUsd = Number(c.totalCostInUsd);
      return {
        documentId: c.document.id,
        documentName: c.document.name,
        fileSize: c.document.sizeInBytes ? Number(c.document.sizeInBytes) : null,
        costUsd,
        profitUsd: costUsd,
        revenueUsd: costUsd * 2,
        roi: 100,
        creditsCharged: c.creditsConsumed,
        tokensProcessed: c.tokensProcessed,
        visionTokens: c.visionTokens,
        chunksCreated: c.chunkCount || 0,
        processedAt: c.processedAt,
      };
    });
  }

  async estimateDocumentCost(fileSizeBytes: number) {
    const estimatedPages = (fileSizeBytes / (1024 * 100)) * 1;
    const estimatedTokens = Math.ceil(estimatedPages * 300);
    const estimatedCostUsd = (estimatedTokens / 1_000_000) * this.ACTUAL_EMBEDDING_COST_PER_1M;
    const estimatedProfitUsd = estimatedCostUsd;
    const estimatedRevenueUsd = estimatedCostUsd * 2;
    const estimatedCredits = Math.ceil(estimatedCostUsd / 0.0001);

    return {
      estimatedTokens,
      estimatedCostUsd,
      estimatedProfitUsd,
      estimatedRevenueUsd,
      estimatedCredits,
    };
  }

  async getROIMetrics(workspaceId: string): Promise<ROIMetrics> {
    const summary = await this.getWorkspaceProfitSummary(workspaceId);

    return {
      totalCostUsd: Number(summary.totalCost.toFixed(6)),
      totalProfitUsd: Number(summary.totalProfit.toFixed(6)),
      totalRevenueUsd: Number(summary.totalRevenue.toFixed(6)),
      profitMarginPercentage: 100,
      roi: 100,
      documentsProcessed: summary.documentsProcessed,
      tokensProcessed: summary.tokensProcessed,
      avgCostPerDocument: Number(summary.avgCostPerDocument.toFixed(6)),
      avgProfitPerDocument: Number(summary.avgProfitPerDocument.toFixed(6)),
      byProcessingType: summary.byType.map((t) => ({
        type: t.type,
        costUsd: Number(t.cost.toFixed(6)),
        profitUsd: Number(t.profit.toFixed(6)),
        revenueUsd: Number(t.revenue.toFixed(6)),
        documentsProcessed: t.count,
        roi: 100,
      })),
    };
  }
}
