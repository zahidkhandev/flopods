/**
 * Embeddings Controller
 *
 * @description Advanced API for managing document embeddings and vector operations.
 * Provides direct access to embedding data, regeneration, statistics, and debugging tools.
 * Useful for power users, debugging, and custom vector search implementations.
 *
 * **Use Cases:**
 * - View embedding chunks and vectors for specific documents
 * - Regenerate embeddings after model upgrades
 * - Get embedding statistics (chunk count, token usage)
 * - Export embeddings for external vector databases
 * - Debug embedding quality and coverage
 *
 * @module v1/documents/controllers/embeddings
 */

import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../../../common/guards/auth';
import { V1DocumentAccessGuard } from '../guards';
import { PrismaService } from '../../../prisma/prisma.service';
import { V1DocumentEmbeddingsService } from '../services/embeddings.service';

/**
 * Embeddings controller
 *
 * @description Handles embedding-specific operations including viewing, regenerating,
 * and exporting embeddings. All routes require authentication and document access validation.
 */
@ApiTags('Embeddings')
@ApiBearerAuth()
@Controller('embeddings')
@UseGuards(AccessTokenGuard)
export class V1EmbeddingsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingsService: V1DocumentEmbeddingsService,
  ) {}

  /**
   * List document embeddings
   *
   * @description Retrieves all embedding chunks for a specific document with pagination.
   * Returns chunk text, index, token count, and vector metadata.
   *
   * **Response Data:**
   * - Chunk index (sequential number)
   * - Chunk text content (preview)
   * - Token count
   * - Model used (e.g., text-embedding-004)
   * - Vector dimension (768)
   * - S3 backup location
   * - Created timestamp
   *
   * **Use Cases:**
   * - Review embedding quality and coverage
   * - Debug missing or incomplete chunks
   * - Export embeddings for external systems
   * - Analyze token distribution
   *
   * @param documentId - Document ID
   * @param page - Page number (default: 1)
   * @param limit - Items per page (default: 20, max: 100)
   * @returns Paginated list of embeddings
   */
  @Get('documents/:documentId')
  @UseGuards(V1DocumentAccessGuard)
  @ApiOperation({
    summary: 'List document embeddings',
    description:
      'Get all embedding chunks for document with pagination. ' +
      'Shows chunk text, token count, model, and S3 backup location. ' +
      'Useful for debugging and quality review.',
  })
  @ApiParam({
    name: 'documentId',
    description: 'Document ID',
    example: 'cm3d1o2c3u4m5e6n7t',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (1-indexed)',
    example: 1,
    type: Number,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page (1-100)',
    example: 20,
    type: Number,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Embeddings retrieved successfully',
    schema: {
      example: {
        data: [
          {
            id: 'cm3emb123',
            chunkIndex: 0,
            chunkText: 'Machine learning is a subset of artificial intelligence...',
            model: 'text-embedding-004',
            vectorDimension: 768,
            s3VectorBucket: 'flopods-vectors-prod',
            s3VectorKey: 'embeddings/cm3d1o2c3u4m5e6n7t/chunk-0.json',
            metadata: {
              tokenCount: 487,
              startChar: 0,
              endChar: 2450,
            },
            createdAt: '2025-10-27T10:35:00Z',
          },
        ],
        pagination: {
          totalItems: 42,
          totalPages: 3,
          currentPage: 1,
          pageSize: 20,
        },
      },
    },
  })
  async listDocumentEmbeddings(
    @Param('documentId') documentId: string,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 20,
  ): Promise<any> {
    // Validate limits
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const safePage = Math.max(page, 1);

    const [embeddings, total] = await Promise.all([
      this.prisma.embedding.findMany({
        where: { documentId },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
        orderBy: { chunkIndex: 'asc' },
        select: {
          id: true,
          chunkIndex: true,
          chunkText: true,
          model: true,
          vectorDimension: true,
          s3VectorBucket: true,
          s3VectorKey: true,
          metadata: true,
          createdAt: true,
        },
      }),
      this.prisma.embedding.count({ where: { documentId } }),
    ]);

    return {
      data: embeddings,
      pagination: {
        totalItems: total,
        totalPages: Math.ceil(total / safeLimit),
        currentPage: safePage,
        pageSize: embeddings.length,
      },
    };
  }

  /**
   * Get embedding statistics
   *
   * @description Retrieves aggregated statistics about document embeddings including
   * chunk count, total tokens, average tokens per chunk, and storage size estimates.
   *
   * **Statistics Included:**
   * - Total chunks created
   * - Total tokens processed
   * - Average tokens per chunk
   * - Model used
   * - Embedding dimension
   * - Estimated storage size (PostgreSQL + S3)
   * - Processing timestamp
   *
   * **Use Cases:**
   * - Cost analysis and optimization
   * - Storage planning
   * - Quality assessment
   * - Processing time estimates
   *
   * @param documentId - Document ID
   * @returns Embedding statistics
   */
  @Get('documents/:documentId/stats')
  @UseGuards(V1DocumentAccessGuard)
  @ApiOperation({
    summary: 'Get embedding statistics',
    description:
      'Retrieve aggregated statistics about document embeddings. ' +
      'Shows chunk count, tokens, storage size, and processing info. ' +
      'Useful for cost analysis and optimization.',
  })
  @ApiParam({
    name: 'documentId',
    description: 'Document ID',
    example: 'cm3d1o2c3u4m5e6n7t',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Statistics retrieved successfully',
    schema: {
      example: {
        documentId: 'cm3d1o2c3u4m5e6n7t',
        totalChunks: 42,
        totalTokens: 21000,
        averageTokensPerChunk: 500,
        model: 'text-embedding-004',
        vectorDimension: 768,
        estimatedStorageBytes: 1290240,
        createdAt: '2025-10-27T10:35:00Z',
      },
    },
  })
  async getEmbeddingStats(@Param('documentId') documentId: string): Promise<any> {
    const embeddings = await this.prisma.embedding.findMany({
      where: { documentId },
      select: {
        model: true,
        vectorDimension: true,
        metadata: true,
        createdAt: true,
      },
    });

    if (embeddings.length === 0) {
      return {
        documentId,
        totalChunks: 0,
        totalTokens: 0,
        averageTokensPerChunk: 0,
        model: null,
        vectorDimension: null,
        estimatedStorageBytes: 0,
        createdAt: null,
      };
    }

    // Calculate statistics
    const totalTokens = embeddings.reduce((sum, emb: any) => {
      return sum + (emb.metadata?.tokenCount || 0);
    }, 0);

    const averageTokensPerChunk = Math.round(totalTokens / embeddings.length);

    // Estimate storage: vector(768) ≈ 768 * 4 bytes (float32) = 3072 bytes per embedding
    const estimatedStorageBytes = embeddings.length * 3072;

    return {
      documentId,
      totalChunks: embeddings.length,
      totalTokens,
      averageTokensPerChunk,
      model: embeddings[0].model,
      vectorDimension: embeddings[0].vectorDimension,
      estimatedStorageBytes,
      createdAt: embeddings[0].createdAt,
    };
  }

  /**
   * Regenerate embeddings
   *
   * @description Triggers regeneration of embeddings for a document.
   * Useful after model upgrades, quality issues, or text extraction improvements.
   *
   * **Regeneration Process:**
   * 1. Mark existing embeddings as stale
   * 2. Re-extract text from document
   * 3. Re-chunk text with current settings
   * 4. Generate new embeddings with latest model
   * 5. Replace old embeddings atomically
   * 6. Calculate new costs
   *
   * **Cost Warning:** This consumes credits/tokens same as initial processing.
   * Check costs before regenerating large documents.
   *
   * @param documentId - Document ID
   * @returns Job ID for tracking regeneration progress
   */
  @Post('documents/:documentId/regenerate')
  @UseGuards(V1DocumentAccessGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Regenerate embeddings',
    description:
      'Trigger re-generation of embeddings for document. ' +
      'Useful after model upgrades or quality issues. ' +
      'Warning: Consumes credits/tokens same as initial processing.',
  })
  @ApiParam({
    name: 'documentId',
    description: 'Document ID',
    example: 'cm3d1o2c3u4m5e6n7t',
  })
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: 'Regeneration queued successfully',
    schema: {
      example: {
        documentId: 'cm3d1o2c3u4m5e6n7t',
        status: 'queued',
        message: 'Embeddings regeneration queued. This will consume credits.',
      },
    },
  })
  async regenerateEmbeddings(@Param('documentId') documentId: string): Promise<any> {
    return this.embeddingsService.regenerateDocumentEmbeddings(documentId);
  }
  /**
   * Get specific embedding chunk
   *
   * @description Retrieves detailed information about a specific embedding chunk
   * including full text, token breakdown, and vector metadata.
   *
   * @param documentId - Document ID
   * @param chunkIndex - Chunk index (0-based)
   * @returns Detailed chunk information
   */
  @Get('documents/:documentId/chunks/:chunkIndex')
  @UseGuards(V1DocumentAccessGuard)
  @ApiOperation({
    summary: 'Get specific chunk',
    description: 'Retrieve detailed information about specific embedding chunk.',
  })
  @ApiParam({ name: 'documentId', example: 'cm3d1o2c3u4m5e6n7t' })
  @ApiParam({ name: 'chunkIndex', example: 5, type: Number })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Chunk details',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Chunk not found',
  })
  async getEmbeddingChunk(
    @Param('documentId') documentId: string,
    @Param('chunkIndex', ParseIntPipe) chunkIndex: number,
  ): Promise<any> {
    const embedding = await this.prisma.embedding.findUnique({
      where: {
        documentId_chunkIndex: {
          documentId,
          chunkIndex,
        },
      },
    });

    if (!embedding) {
      return {
        statusCode: 404,
        message: 'Chunk not found',
      };
    }

    return embedding;
  }
}
