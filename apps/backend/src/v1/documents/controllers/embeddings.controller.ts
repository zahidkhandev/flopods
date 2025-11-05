// /src/modules/v1/documents/controllers/embeddings.controller.ts

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
  Logger,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { V1DocumentEmbeddingsService } from '../services/embeddings.service';
import { V1BullMQDocumentQueueService } from '../queues/bullmq-queue.service';
import { PrismaService } from '../../../prisma/prisma.service';

@ApiTags('Documents - Embeddings')
@ApiBearerAuth()
@Controller('documents')
@UseGuards(AuthGuard('jwt'))
export class V1EmbeddingsController {
  private readonly logger = new Logger(V1EmbeddingsController.name);

  constructor(
    private readonly embeddingsService: V1DocumentEmbeddingsService,
    private readonly queueService: V1BullMQDocumentQueueService,
    private readonly prisma: PrismaService,
  ) {}

  // ✅ KEEP OLD ROUTE - for frontend compatibility
  @Post('embeddings/workspaces/:workspaceId/documents/:documentId/regenerate')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Regenerate embeddings (legacy route)' })
  @ApiResponse({ status: 202, description: 'Regeneration job queued' })
  async regenerateEmbeddingsLegacy(
    @Param('workspaceId') workspaceId: string,
    @Param('documentId') documentId: string,
  ): Promise<any> {
    if (!documentId) {
      throw new BadRequestException('documentId is required');
    }

    this.logger.log(`[Controller] Regenerating embeddings (LEGACY) for: ${documentId}`);

    const result = await this.embeddingsService.regenerateDocumentEmbeddings(documentId);

    return {
      ...result,
      timestamp: new Date().toISOString(),
    };
  }

  // ✅ NEW ROUTE - with embeddings prefix
  @Post(':documentId/regenerate-embeddings')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Regenerate document embeddings (async)',
    description:
      'Trigger regeneration of embeddings for a document. Deletes existing embeddings and queues reprocessing job. ' +
      '⚠️ Consumes credits/tokens same as initial processing. Processing happens asynchronously.',
  })
  @ApiParam({
    name: 'documentId',
    description: 'Document UUID',
    example: 'cm3document456',
    type: String,
  })
  @ApiResponse({
    status: 202,
    description: 'Regeneration job accepted and queued',
    schema: {
      example: {
        documentId: 'cm3doc456',
        status: 'queued',
        jobId: 'msg_1735142400000_abc123xyz',
        message:
          'Regeneration job queued. Deleted 42 old embeddings. Document will be re-embedded shortly.',
        timestamp: '2025-11-05T03:24:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - document has no source file',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing/invalid JWT',
  })
  @ApiResponse({
    status: 404,
    description: 'Document not found',
  })
  async regenerateEmbeddings(@Param('documentId') documentId: string): Promise<any> {
    if (!documentId) {
      throw new BadRequestException('documentId is required');
    }

    this.logger.log(`[Controller] Regenerating embeddings for: ${documentId}`);

    const result = await this.embeddingsService.regenerateDocumentEmbeddings(documentId);

    return {
      ...result,
      timestamp: new Date().toISOString(),
    };
  }

  // ✅ GET STATUS
  @Get(':documentId/embedding-status')
  @ApiOperation({
    summary: 'Get embedding processing status',
    description: 'Check embedding status, count, and last update time for a document.',
  })
  @ApiParam({
    name: 'documentId',
    description: 'Document UUID',
    example: 'cm3document456',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Status retrieved',
    schema: {
      example: {
        documentId: 'cm3doc456',
        status: 'READY',
        embeddingsCount: 42,
        lastUpdated: '2025-11-05T03:24:00.000Z',
      },
    },
  })
  async getEmbeddingStatus(@Param('documentId') documentId: string): Promise<any> {
    this.logger.debug(`[Controller] Fetching embedding status for: ${documentId}`);
    return this.embeddingsService.getEmbeddingStatus(documentId);
  }

  // ✅ QUEUE METRICS
  @Get('queue/metrics')
  @ApiOperation({
    summary: 'Get document processing queue metrics',
    description: 'Monitor queue health - jobs waiting, active, completed, failed, delayed.',
  })
  @ApiResponse({
    status: 200,
    description: 'Queue metrics',
    schema: {
      example: {
        queue: {
          waiting: 5,
          active: 2,
          completed: 158,
          failed: 3,
          delayed: 0,
        },
        timestamp: '2025-11-05T03:24:00.000Z',
      },
    },
  })
  async getQueueMetrics(): Promise<any> {
    this.logger.debug(`[Controller] Fetching queue metrics`);
    const metrics = await this.queueService.getDocumentQueueMetrics();
    return {
      queue: metrics,
      timestamp: new Date().toISOString(),
    };
  }

  // ✅ LIST EMBEDDINGS
  @Get('workspaces/:workspaceId/documents/:documentId/embeddings')
  @ApiOperation({
    summary: 'List document embeddings',
    description: 'Retrieve paginated list of all embedding chunks for a document.',
  })
  @ApiParam({
    name: 'workspaceId',
    description: 'Workspace UUID',
    example: 'cm3workspace123',
    type: String,
  })
  @ApiParam({
    name: 'documentId',
    description: 'Document UUID',
    example: 'cm3document456',
    type: String,
  })
  @ApiQuery({
    name: 'page',
    description: 'Page number (1-indexed, default: 1)',
    required: false,
    example: 1,
    type: Number,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Items per page (1-100, default: 20)',
    required: false,
    example: 20,
    type: Number,
  })
  async listDocumentEmbeddings(
    @Param('workspaceId') workspaceId: string,
    @Param('documentId') documentId: string,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 20,
  ): Promise<any> {
    this.logger.debug(`Listing embeddings: doc=${documentId}, page=${page}, limit=${limit}`);

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

    this.logger.debug(`Retrieved ${embeddings.length}/${total} embeddings for ${documentId}`);

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

  // ✅ GET EMBEDDING STATS
  @Get('workspaces/:workspaceId/documents/:documentId/embeddings/stats')
  @ApiOperation({
    summary: 'Get embedding statistics',
    description: 'Retrieve comprehensive statistics about document embeddings.',
  })
  @ApiParam({
    name: 'workspaceId',
    description: 'Workspace UUID',
    example: 'cm3workspace123',
    type: String,
  })
  @ApiParam({
    name: 'documentId',
    description: 'Document UUID',
    example: 'cm3document456',
    type: String,
  })
  async getEmbeddingStats(
    @Param('workspaceId') workspaceId: string,
    @Param('documentId') documentId: string,
  ): Promise<any> {
    this.logger.debug(`Calculating embedding stats for document: ${documentId}`);

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
      this.logger.debug(`No embeddings found for document: ${documentId}`);
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

    const totalTokens = embeddings.reduce((sum, emb: any) => {
      return sum + (emb.metadata?.tokenCount || 0);
    }, 0);

    const averageTokensPerChunk = Math.round(totalTokens / embeddings.length);
    const estimatedStorageBytes = embeddings.length * 3072;

    this.logger.debug(
      `Stats: ${embeddings.length} chunks, ${totalTokens} tokens, ${estimatedStorageBytes} bytes`,
    );

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

  // ✅ GET SPECIFIC CHUNK
  @Get('workspaces/:workspaceId/documents/:documentId/embeddings/chunks/:chunkIndex')
  @ApiOperation({
    summary: 'Get specific embedding chunk',
    description: 'Retrieve complete details for a single embedding chunk.',
  })
  @ApiParam({
    name: 'workspaceId',
    description: 'Workspace UUID',
    example: 'cm3workspace123',
    type: String,
  })
  @ApiParam({
    name: 'documentId',
    description: 'Document UUID',
    example: 'cm3document456',
    type: String,
  })
  @ApiParam({
    name: 'chunkIndex',
    description: 'Chunk index (0-based)',
    example: 5,
    type: Number,
  })
  async getEmbeddingChunk(
    @Param('workspaceId') workspaceId: string,
    @Param('documentId') documentId: string,
    @Param('chunkIndex', ParseIntPipe) chunkIndex: number,
  ): Promise<any> {
    this.logger.debug(`Fetching chunk ${chunkIndex} for document: ${documentId}`);

    const embedding = await this.prisma.embedding.findUnique({
      where: {
        documentId_chunkIndex: {
          documentId,
          chunkIndex,
        },
      },
    });

    if (!embedding) {
      this.logger.debug(`Chunk ${chunkIndex} not found for document: ${documentId}`);
      return {
        statusCode: 404,
        message: 'Chunk not found',
      };
    }

    this.logger.debug(`Retrieved chunk ${chunkIndex} for document: ${documentId}`);
    return embedding;
  }
}
