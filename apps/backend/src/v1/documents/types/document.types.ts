// src/modules/v1/documents/types/document.types.ts

import { DocumentSourceType, DocumentStatus, DocumentProcessingType } from '@flopods/schema';

export { DocumentSourceType, DocumentStatus, DocumentProcessingType };

export enum DocumentProcessingAction {
  PROCESS = 'PROCESS',
  REPROCESS = 'REPROCESS',
  THUMBNAIL = 'THUMBNAIL',
}

export enum DocumentMessagePriority {
  HIGH = 'HIGH',
  NORMAL = 'NORMAL',
  LOW = 'LOW',
}

export interface DocumentMetadata {
  fileType?: string;
  sourceType?: DocumentSourceType;
  estimatedTokens?: number;
  retryCount?: number;
  pageCount?: number;
  duration?: number;
  thumbnail?: string;
  author?: string;
  channelName?: string;
  url?: string;
}

export interface DocumentProcessingResult {
  success: boolean;
  documentId: string;
  chunkCount?: number;
  tokensProcessed?: number;
  processingTimeMs?: number;
  error?: string;
  profitUsd?: number;
  costUsd?: number;
}

export interface DocumentVectorSearchResult {
  embeddingId: string;
  documentId: string;
  documentName: string;
  chunkIndex: number;
  chunkText: string;
  similarity: number;
  documentMetadata: Record<string, any>;
}

export interface DocumentCostSummary {
  totalCost: number;
  totalProfit: number;
  totalRevenue: number;
  totalCredits: number;
  documentsProcessed: number;
  tokensProcessed: number;
  chunksCreated: number;
  profitMarginPercentage: number;
  avgCostPerDocument: number;
  avgProfitPerDocument: number;
  byType: Array<{
    type: DocumentProcessingType;
    cost: number;
    profit: number;
    revenue: number;
    credits: number;
    count: number;
  }>;
}

export interface DocumentDailyCost {
  date: string;
  cost: number;
  profit: number;
  revenue: number;
  credits: number;
  documentsProcessed: number;
}

export interface DocumentCostDetail {
  documentId: string;
  documentName: string;
  fileSize: number | null;
  processingType: DocumentProcessingType;
  totalCostUsd: number;
  profitUsd: number;
  revenueUsd: number;
  creditsConsumed: number;
  extractionCost: number;
  embeddingCost: number;
  visionCost: number;
  tokensProcessed: number;
  visionTokens: number;
  chunkCount: number;
  embeddingModel: string | null;
  roi: number;
  profitMarginPercentage: number;
  processedAt: Date;
}

export interface ROIMetrics {
  totalCostUsd: number;
  totalProfitUsd: number;
  totalRevenueUsd: number;
  profitMarginPercentage: number;
  roi: number;
  documentsProcessed: number;
  tokensProcessed: number;
  avgCostPerDocument: number;
  avgProfitPerDocument: number;
  byProcessingType: Array<{
    type: DocumentProcessingType;
    costUsd: number;
    profitUsd: number;
    revenueUsd: number;
    documentsProcessed: number;
    roi: number;
  }>;
}

export interface ProfitableDocument {
  documentId: string;
  documentName: string;
  fileSize: number | null;
  costUsd: number;
  profitUsd: number;
  revenueUsd: number;
  roi: number;
  creditsCharged: number;
  tokensProcessed: number;
  visionTokens: number;
  chunksCreated: number;
  processedAt: Date;
}

export interface DocumentVisionAnalysisResult {
  documentId: string;
  provider: string; // ✅ Changed from VisionProvider
  ocrText?: string;
  caption?: string;
  summary?: string;
  detectedObjects?: any[];
  confidence: number;
  tokensUsed: number;
  costUsd: number;
  profitUsd: number;
}
