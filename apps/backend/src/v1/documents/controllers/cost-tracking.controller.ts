/**
 * Document Cost Tracking Controller
 *
 * @description RESTful API for document processing cost analytics and reporting.
 * Provides workspace administrators with insights into credit usage, USD costs,
 * token consumption, and processing trends. Integrates with subscription billing
 * and supports date range filtering for custom reports.
 *
 * @module v1/documents/controllers/cost-tracking
 */

import { Controller, Get, Query, Param, UseGuards, HttpStatus, ParseIntPipe } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { V1WorkspaceOwnershipGuard } from '../guards/workspace-ownership.guard';
import { V1DocumentCostTrackingService } from '../services/cost-tracking.service';
import { GetCostSummaryDto, GetDailyCostsDto } from '../dto';
import { AccessTokenGuard } from '../../../common/guards/auth';

/**
 * Cost tracking controller
 *
 * @description Provides cost analytics endpoints for workspace administrators.
 * All costs are tracked in both USD (Decimal) and platform credits (Integer).
 * Supports filtering by date ranges and processing types.
 */
@ApiTags('Cost Tracking')
@ApiBearerAuth()
@Controller('documents/costs')
@UseGuards(AccessTokenGuard)
export class V1DocumentCostTrackingController {
  constructor(private readonly costTrackingService: V1DocumentCostTrackingService) {}

  /**
   * Get workspace cost summary
   *
   * @description Retrieves aggregated cost summary for workspace with optional
   * date range filtering. Returns total costs, credits consumed, documents processed,
   * and breakdown by processing type (embedding, OCR, extraction, etc.).
   *
   * **Summary Includes:**
   * - Total USD cost across all documents
   * - Total platform credits consumed
   * - Number of documents processed
   * - Total tokens processed
   * - Total chunks created
   * - Breakdown by processing type with individual costs
   *
   * **Processing Types:**
   * - DOCUMENT_EMBEDDING: Gemini embedding generation
   * - PDF_TEXT_EXTRACTION: PDF text extraction (OCR fallback)
   * - IMAGE_OCR: Image text extraction via Tesseract
   * - VIDEO_TRANSCRIPT: YouTube/Vimeo transcript fetch
   * - URL_SCRAPING: Web content extraction
   *
   * **Use Cases:**
   * - Monthly billing reports
   * - Budget tracking and forecasting
   * - Cost optimization analysis
   * - Department/team cost allocation
   *
   * @param workspaceId - Workspace ID
   * @param dto - Optional date range filters
   * @returns Comprehensive cost summary
   */
  @Get('workspaces/:workspaceId/summary')
  @UseGuards(V1WorkspaceOwnershipGuard)
  @ApiOperation({
    summary: 'Get workspace cost summary',
    description:
      'Retrieve aggregated cost summary for workspace with optional date range. ' +
      'Returns total costs (USD + credits), documents processed, tokens consumed, ' +
      'and breakdown by processing type (embedding, OCR, extraction). ' +
      'Useful for billing reports, budget tracking, and cost optimization.',
  })
  @ApiParam({
    name: 'workspaceId',
    description: 'Workspace ID',
    example: 'cm3a1b2c3d4e5f6g7h8i9j0k',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Start date (ISO 8601 format)',
    example: '2025-10-01T00:00:00.000Z',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'End date (ISO 8601 format)',
    example: '2025-10-31T23:59:59.999Z',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cost summary retrieved successfully',
    schema: {
      example: {
        totalCost: 2.45,
        totalCredits: 24500,
        documentsProcessed: 42,
        tokensProcessed: 2450000,
        chunksCreated: 512,
        byType: [
          {
            type: 'DOCUMENT_EMBEDDING',
            cost: 2.45,
            credits: 24500,
            count: 42,
          },
        ],
      },
    },
  })
  async getWorkspaceCostSummary(
    @Param('workspaceId') workspaceId: string,
    @Query() dto: GetCostSummaryDto,
  ): Promise<any> {
    const startDate = dto.startDate ? new Date(dto.startDate) : undefined;
    const endDate = dto.endDate ? new Date(dto.endDate) : undefined;

    return this.costTrackingService.getWorkspaceCostSummary(workspaceId, startDate, endDate);
  }

  /**
   * Get daily cost breakdown
   *
   * @description Retrieves daily aggregated costs for the last N days.
   * Perfect for generating cost trend charts and monitoring daily spending patterns.
   *
   * **Daily Metrics:**
   * - Date (YYYY-MM-DD format)
   * - Total USD cost for the day
   * - Total credits consumed
   * - Number of documents processed
   *
   * **Use Cases:**
   * - Cost trend visualization (line charts)
   * - Daily budget monitoring
   * - Anomaly detection (sudden spikes)
   * - Weekly/monthly cost comparisons
   *
   * **Performance:** Optimized query using date grouping
   *
   * @param workspaceId - Workspace ID
   * @param dto - Query options (number of days)
   * @returns Array of daily costs sorted by date descending
   */
  @Get('workspaces/:workspaceId/daily')
  @UseGuards(V1WorkspaceOwnershipGuard)
  @ApiOperation({
    summary: 'Get daily cost breakdown',
    description:
      'Retrieve daily aggregated costs for last N days (default 30). ' +
      'Returns date, cost, credits, and documents processed per day. ' +
      'Perfect for cost trend charts and daily budget monitoring. ' +
      'Sorted by date descending (newest first).',
  })
  @ApiParam({
    name: 'workspaceId',
    description: 'Workspace ID',
    example: 'cm3a1b2c3d4e5f6g7h8i9j0k',
  })
  @ApiQuery({
    name: 'days',
    required: false,
    description: 'Number of days to retrieve (1-365, default 30)',
    example: 30,
    type: Number,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Daily costs retrieved successfully',
    schema: {
      example: [
        {
          date: '2025-10-27',
          cost: 0.5,
          credits: 5000,
          documentsProcessed: 10,
        },
        {
          date: '2025-10-26',
          cost: 0.35,
          credits: 3500,
          documentsProcessed: 7,
        },
      ],
    },
  })
  async getDailyCostBreakdown(
    @Param('workspaceId') workspaceId: string,
    @Query() dto: GetDailyCostsDto,
  ): Promise<any> {
    return this.costTrackingService.getDailyCostBreakdown(workspaceId, dto.days);
  }

  /**
   * Get top costly documents
   *
   * @description Retrieves documents with highest processing costs.
   * Useful for identifying expensive documents and optimization opportunities.
   *
   * **Identifies:**
   * - Large documents consuming many credits
   * - Documents with high token counts
   * - Inefficient document formats
   * - Candidates for compression/optimization
   *
   * **Use Cases:**
   * - Cost optimization analysis
   * - Budget allocation by document type
   * - Identifying processing inefficiencies
   * - User education on cost-effective uploads
   *
   * @param workspaceId - Workspace ID
   * @param limit - Number of documents to return (1-100, default 10)
   * @returns Top documents sorted by cost descending
   */
  @Get('workspaces/:workspaceId/top-documents')
  @UseGuards(V1WorkspaceOwnershipGuard)
  @ApiOperation({
    summary: 'Get top costly documents',
    description:
      'Retrieve documents with highest processing costs. ' +
      'Shows document name, size, cost, credits, tokens, and chunks. ' +
      'Useful for identifying expensive documents and optimization opportunities. ' +
      'Sorted by cost descending.',
  })
  @ApiParam({
    name: 'workspaceId',
    description: 'Workspace ID',
    example: 'cm3a1b2c3d4e5f6g7h8i9j0k',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of documents to return (1-100, default 10)',
    example: 10,
    type: Number,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Top costly documents retrieved',
    schema: {
      example: [
        {
          documentId: 'cm3d1o2c3u4m5e6n7t',
          documentName: 'Large Research Paper.pdf',
          fileSize: 10485760,
          cost: 0.05,
          credits: 500,
          tokensProcessed: 500000,
          chunksCreated: 100,
          processedAt: '2025-10-27T10:00:00Z',
        },
      ],
    },
  })
  async getTopCostlyDocuments(
    @Param('workspaceId') workspaceId: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 10,
  ): Promise<any> {
    return this.costTrackingService.getTopCostlyDocuments(workspaceId, limit);
  }

  /**
   * Estimate document cost
   *
   * @description Provides upfront cost estimate based on file size before upload.
   * Uses heuristics to estimate tokens and calculate expected credits/USD cost.
   * Helps users make informed decisions about uploads.
   *
   * **Estimation Formula:**
   * - 1 MB ≈ 20 pages
   * - 1 page ≈ 500 tokens
   * - Gemini embedding: $0.01 per 1M tokens
   * - 1 credit = $0.0001
   *
   * **Accuracy:** ±30% depending on document density and format
   *
   * **Use Cases:**
   * - Pre-upload cost preview
   * - Bulk upload cost estimation
   * - Budget planning
   * - User education on costs
   *
   * @param fileSizeBytes - File size in bytes
   * @returns Estimated tokens, USD cost, and credits
   */
  @Get('estimate')
  @ApiOperation({
    summary: 'Estimate document cost',
    description:
      'Estimate processing cost based on file size before upload. ' +
      'Returns estimated tokens, USD cost, and credits required. ' +
      'Uses heuristics: 1 MB ≈ 20 pages ≈ 10,000 tokens. ' +
      'Accuracy: ±30% depending on document density.',
  })
  @ApiQuery({
    name: 'fileSizeBytes',
    description: 'File size in bytes',
    example: 5242880,
    type: Number,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cost estimate calculated',
    schema: {
      example: {
        estimatedTokens: 100000,
        estimatedCost: 0.001,
        estimatedCredits: 10,
      },
    },
  })
  async estimateDocumentCost(
    @Query('fileSizeBytes', ParseIntPipe) fileSizeBytes: number,
  ): Promise<any> {
    return this.costTrackingService.estimateDocumentCost(fileSizeBytes);
  }

  /**
   * Get document-specific cost
   *
   * @description Retrieves detailed cost breakdown for a single document.
   * Shows extraction vs embedding costs, model used, and processing stats.
   *
   * **Cost Breakdown:**
   * - Extraction cost: $0 (free open-source tools)
   * - Embedding cost: Based on tokens processed
   * - Total cost: Sum of above
   * - Credits consumed: Platform credits deducted
   *
   * **Additional Info:**
   * - Processing type (DOCUMENT_EMBEDDING, etc.)
   * - Tokens processed
   * - Chunks created
   * - Model used (text-embedding-004)
   * - Processing timestamp
   *
   * @param documentId - Document ID
   * @returns Detailed cost breakdown
   */
  @Get('documents/:documentId')
  @ApiOperation({
    summary: 'Get document cost details',
    description:
      'Retrieve detailed cost breakdown for specific document. ' +
      'Shows extraction cost, embedding cost, total USD, credits consumed, ' +
      'tokens processed, chunks created, and model used.',
  })
  @ApiParam({
    name: 'documentId',
    description: 'Document ID',
    example: 'cm3d1o2c3u4m5e6n7t',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Document cost details',
    schema: {
      example: {
        processingType: 'DOCUMENT_EMBEDDING',
        totalCostInUsd: 0.0005,
        creditsConsumed: 5,
        extractionCost: 0,
        embeddingCost: 0.0005,
        tokensProcessed: 50000,
        chunkCount: 12,
        embeddingModel: 'text-embedding-004',
        processedAt: '2025-10-27T10:35:00Z',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Document cost record not found',
  })
  async getDocumentCost(@Param('documentId') documentId: string): Promise<any> {
    return this.costTrackingService.getDocumentCost(documentId);
  }
}
