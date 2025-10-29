/**
 * Documents Controller
 *
 * @description Production-grade RESTful API for comprehensive document management.
 * Handles file uploads (PDF, images, Office docs), external source linking (YouTube, URLs),
 * semantic vector search, CRUD operations, and detailed cost tracking/analytics.
 *
 * **Key Features:**
 * - Multi-source document ingestion (file upload, YouTube, web scraping)
 * - Automatic text extraction and embedding generation
 * - Tier-based file size limits (HOBBYIST: 10MB, PRO: 100MB, TEAM: 500MB)
 * - MIME type validation and security checks
 * - pgvector-powered semantic search (sub-250ms for 10M vectors)
 * - Credit-based billing with BYOK (Bring Your Own Key) support
 * - Comprehensive cost tracking and analytics
 * - Folder organization and bulk operations
 *
 * **Architecture:**
 * - Guards: JWT authentication + workspace/document access control
 * - Interceptors: File size limits + MIME type validation
 * - Queue: Async processing via BullMQ (dev) / SQS (prod)
 * - Storage: S3 for files, PostgreSQL + S3 for embeddings
 *
 * **Security:**
 * - All routes require JWT authentication (AccessTokenGuard)
 * - Workspace routes validate membership (V1WorkspaceOwnershipGuard)
 * - Document routes validate ownership (DocumentAccessGuard)
 * - File uploads validated for type and size
 * - Rate limiting enforced per subscription tier
 *
 * @module v1/documents/controllers/documents
 */

import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpStatus,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { V1DocumentsService } from '../services/documents.service';
import { V1DocumentVectorSearchService } from '../services/vector-search.service';
import { V1DocumentCostTrackingService } from '../services/cost-tracking.service';
import {
  UploadDocumentDto,
  LinkExternalDocumentDto,
  UpdateDocumentDto,
  SearchDocumentsDto,
  ListDocumentsDto,
} from '../dto';
import { AccessTokenGuard } from '../../../common/guards/auth';
import { GetCurrentUserId } from '../../../common/decorators/user';
import { V1FileSizeLimitInterceptor, V1FileTypeValidatorInterceptor } from '../interceptors';
import { V1DocumentAccessGuard, V1WorkspaceOwnershipGuard } from '../guards';

/**
 * Documents controller
 *
 * @description Handles all document-related HTTP requests with comprehensive validation,
 * security checks, and error handling. Integrates with queue system for async processing.
 *
 * **Route Structure:**
 * - POST   /documents/workspaces/:id/upload        - Upload file
 * - POST   /documents/workspaces/:id/external      - Link external source
 * - GET    /documents/workspaces/:id               - List documents
 * - POST   /documents/workspaces/:id/search        - Semantic search
 * - GET    /documents/workspaces/:id/documents/:id - Get document
 * - PATCH  /documents/workspaces/:id/documents/:id - Update document
 * - DELETE /documents/workspaces/:id/documents/:id - Delete document
 * - GET    /documents/:id/cost                     - Get processing cost
 */
@ApiTags('Documents')
@ApiBearerAuth()
@Controller('documents')
@UseGuards(AccessTokenGuard)
export class V1DocumentsController {
  constructor(
    private readonly documentsService: V1DocumentsService,
    private readonly vectorSearchService: V1DocumentVectorSearchService,
    private readonly costTrackingService: V1DocumentCostTrackingService,
  ) {}

  /**
   * Upload document file
   *
   * @description Uploads a file to workspace with comprehensive validation and queuing.
   * File is validated for type (MIME), size (tier-based), uploaded to S3, and queued
   * for async text extraction and embedding generation. Returns immediately with document ID.
   *
   * **Supported File Types:**
   * - PDF documents (application/pdf)
   * - Images: PNG, JPG, JPEG, WebP, GIF
   * - Microsoft Office: DOCX, XLSX, PPTX
   * - Text files: TXT, MD, CSV, JSON
   * - Legacy Office: DOC, XLS, PPT
   *
   * **Size Limits by Subscription Tier:**
   * - HOBBYIST (Free): 10 MB maximum
   * - PRO ($20/month): 100 MB maximum
   * - TEAM ($50/user/month): 500 MB maximum
   *
   * **Processing Pipeline:**
   * 1. **Validation Phase:**
   *    - JWT token validation (AccessTokenGuard)
   *    - Workspace membership check (V1WorkspaceOwnershipGuard)
   *    - File existence validation
   *    - MIME type validation (FileTypeValidatorInterceptor)
   *    - Size limit validation (FileSizeLimitInterceptor)
   *
   * 2. **Storage Phase:**
   *    - Upload to S3 bucket (with encryption)
   *    - Generate unique storage key
   *    - Create document record in database (status: UPLOADING)
   *
   * 3. **Queue Phase:**
   *    - Create processing job
   *    - Add to BullMQ (dev) or SQS (prod)
   *    - Include document ID, workspace, user, file metadata
   *
   * 4. **Response Phase:**
   *    - Return document ID immediately
   *    - Processing happens asynchronously
   *    - Client can poll status via GET endpoint
   *
   * **Async Processing (Background):**
   * 1. Download file from S3
   * 2. Extract text (pdf-parse, tesseract, mammoth)
   * 3. Chunk text (512 tokens, 50 overlap)
   * 4. Generate embeddings (Gemini text-embedding-004)
   * 5. Store in PostgreSQL (pgvector) + S3 (backup)
   * 6. Calculate costs and deduct credits
   * 7. Update document status to READY
   *
   * **Cost Calculation:**
   * - Check for BYOK (Bring Your Own Key) first
   * - If no BYOK, check workspace credits
   * - Estimate: 1 MB ≈ 20 pages ≈ 10,000 tokens ≈ 1 credit
   * - Gemini pricing: $0.01 per 1M tokens = 100 credits
   * - Reject upload if insufficient credits
   *
   * **Estimated Processing Time:**
   * - Small files (< 1 MB): 10-20 seconds
   * - Medium files (1-10 MB): 30-60 seconds
   * - Large files (10-100 MB): 1-3 minutes
   * - Very large files (100-500 MB): 3-10 minutes
   *
   * **Error Scenarios:**
   * - File too large: 413 Payload Too Large (with tier info)
   * - Invalid file type: 415 Unsupported Media Type (with allowed types)
   * - Insufficient credits: 403 Forbidden (with available credits)
   * - Not workspace member: 403 Forbidden
   * - Invalid JWT: 401 Unauthorized
   *
   * @param workspaceId - Target workspace ID where document will be stored
   * @param userId - Authenticated user ID (extracted from JWT token)
   * @param file - Uploaded file (multipart/form-data, max size based on tier)
   * @param dto - Upload options including optional folder ID for organization
   * @returns Object with documentId (CUID) and status ('queued')
   *
   * @throws {BadRequestException} No file provided in request
   * @throws {UnsupportedMediaTypeException} File type not allowed (from interceptor)
   * @throws {PayloadTooLargeException} File exceeds tier limit (from interceptor)
   * @throws {ForbiddenException} User not workspace member or insufficient credits
   * @throws {UnauthorizedException} Invalid or expired JWT token
   *
   * @example
   * ```
   * // Client request (multipart/form-data)
   * POST /documents/workspaces/cm3abc123/upload
   * Content-Type: multipart/form-data
   * Authorization: Bearer <jwt_token>
   *
   * file: <binary_data>
   * folderId: "cm3folder456" (optional)
   *
   * // Success response
   * HTTP 201 Created
   * {
   *   "documentId": "cm3doc789",
   *   "status": "queued"
   * }
   *
   * // Error response (size exceeded)
   * HTTP 413 Payload Too Large
   * {
   *   "statusCode": 413,
   *   "message": "File size (150 MB) exceeds PRO plan limit of 100 MB. Upgrade to TEAM plan.",
   *   "error": "Payload Too Large"
   * }
   * ```
   */
  @Post('workspaces/:workspaceId/upload')
  @UseGuards(V1WorkspaceOwnershipGuard)
  @UseInterceptors(
    FileInterceptor('file'),
    V1FileSizeLimitInterceptor,
    V1FileTypeValidatorInterceptor,
  )
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload document file',
    description:
      'Upload PDF, image, Word doc, or other supported file for async processing. ' +
      'File is validated for type and size (tier-based limits), uploaded to S3, ' +
      'and queued for text extraction and embedding generation. Returns immediately ' +
      'with document ID while processing happens in background. ' +
      'Supports: PDF, PNG, JPG, DOCX, XLSX, PPTX, TXT, MD, CSV. ' +
      'Size limits: HOBBYIST=10MB, PRO=100MB, TEAM=100MB.',
  })
  @ApiParam({
    name: 'workspaceId',
    description: 'Target workspace ID where document will be stored',
    example: 'cm3a1b2c3d4e5f6g7h8i9j0k',
    type: String,
  })
  @ApiBody({
    description: 'Multipart form-data with file and optional folder ID',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File to upload (PDF, image, Office doc, text file)',
        },
        folderId: {
          type: 'string',
          description: 'Optional folder ID for document organization',
          example: 'cm3f1o2l3d4e5r6i7d',
          nullable: true,
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Document uploaded successfully and queued for processing',
    schema: {
      type: 'object',
      properties: {
        documentId: {
          type: 'string',
          description: 'Unique document identifier (CUID)',
          example: 'cm3d1o2c3u4m5e6n7t',
        },
        status: {
          type: 'string',
          description: 'Current processing status',
          example: 'queued',
          enum: ['queued'],
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'No file provided or invalid request',
    schema: {
      example: {
        statusCode: 400,
        message: 'No file provided',
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid or expired JWT token',
    schema: {
      example: {
        statusCode: 401,
        message: 'Unauthorized',
        error: 'Unauthorized',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Not workspace member or insufficient credits',
    schema: {
      example: {
        statusCode: 403,
        message: 'Insufficient credits. Required: 10, Available: 5. Add credits or configure BYOK.',
        error: 'Forbidden',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.PAYLOAD_TOO_LARGE,
    description: 'File size exceeds subscription tier limit',
    schema: {
      example: {
        statusCode: 413,
        message:
          'File size (15.50 MB) exceeds HOBBYIST plan limit of 10 MB. Upgrade to PRO plan for 100 MB limit.',
        error: 'Payload Too Large',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
    description: 'File type not allowed',
    schema: {
      example: {
        statusCode: 415,
        message:
          "File type 'application/zip' is not supported. Allowed: PDF, images, Office docs, text files.",
        error: 'Unsupported Media Type',
      },
    },
  })
  async uploadDocument(
    @Param('workspaceId') workspaceId: string,
    @GetCurrentUserId() userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
  ): Promise<{ documentId: string; status: string }> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    return this.documentsService.uploadDocument(workspaceId, userId, file, dto.folderId);
  }

  /**
   * Link external document
   *
   * @description Links external document source (YouTube, Vimeo, Loom, or web URL).
   * System fetches content/transcript and processes similarly to uploaded files.
   *
   * **Supported External Sources:**
   * - **YouTube**: Fetches video transcript via youtube-transcript API
   * - **Vimeo**: Extracts captions/transcript from video
   * - **Loom**: Downloads transcript from Loom API
   * - **Public URLs**: Web scraping with cheerio
   * - **Google Drive**: Coming soon
   *
   * **Processing Flow:**
   * 1. Validate URL format and source type
   * 2. Check workspace credits (same as file upload)
   * 3. Create document record (sourceType: YOUTUBE/URL/etc.)
   * 4. Queue fetching and processing job
   * 5. Background: Fetch content, extract text, generate embeddings
   *
   */
  /**
   * Link external document
   */
  @Post('workspaces/:workspaceId/external')
  @UseGuards(V1WorkspaceOwnershipGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Link external document',
    description:
      'Link YouTube video, Vimeo video, Loom recording, or public URL. ' +
      'System fetches transcript/content and generates embeddings. ' +
      'Supported: YouTube, Vimeo, Loom, public URLs.',
  })
  @ApiParam({ name: 'workspaceId', example: 'cm3a1b2c3d4e5f6g7h8i9j0k' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'External document linked successfully',
    schema: {
      example: {
        documentId: 'cm3d1o2c3u4m5e6n7t',
        status: 'queued',
        sourceType: 'YOUTUBE',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid URL or unsupported source type',
  })
  async linkExternalDocument(
    @Param('workspaceId') workspaceId: string,
    @GetCurrentUserId() userId: string,
    @Body() dto: LinkExternalDocumentDto,
  ): Promise<any> {
    return this.documentsService.linkExternalDocument(
      workspaceId,
      userId,
      dto.externalUrl,
      dto.sourceType,
      dto.name,
      dto.folderId,
    );
  }

  /**
   * List documents
   *
   * @description Retrieves paginated list of documents with filters and sorting.
   * Returns metadata including name, size, status, folder, and processing info.
   */
  @Get('workspaces/:workspaceId')
  @UseGuards(V1WorkspaceOwnershipGuard)
  @ApiOperation({
    summary: 'List documents',
    description:
      'Get paginated documents with filters (folder, status). Sorted by date (newest first).',
  })
  @ApiParam({ name: 'workspaceId', example: 'cm3a1b2c3d4e5f6g7h8i9j0k' })
  @ApiResponse({ status: HttpStatus.OK })
  async listDocuments(
    @Param('workspaceId') workspaceId: string,
    @Query() dto: ListDocumentsDto,
  ): Promise<any> {
    return this.documentsService.listDocuments(workspaceId, dto);
  }

  /**
   * Semantic search
   *
   * @description Searches documents using natural language queries via pgvector.
   * Uses cosine similarity on 768-dimension embeddings for sub-250ms performance.
   */
  @Post('workspaces/:workspaceId/search')
  @UseGuards(V1WorkspaceOwnershipGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Semantic search',
    description:
      'Vector similarity search across documents. Supports filters and threshold tuning.',
  })
  @ApiParam({ name: 'workspaceId', example: 'cm3a1b2c3d4e5f6g7h8i9j0k' })
  @ApiResponse({ status: HttpStatus.OK })
  async searchDocuments(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: SearchDocumentsDto,
  ): Promise<any> {
    return this.vectorSearchService.searchDocuments(workspaceId, dto.query, {
      documentIds: dto.documentIds,
      folderId: dto.folderId,
      topK: dto.topK,
      minSimilarity: dto.minSimilarity,
    });
  }

  /**
   * Get document details
   */
  @Get('workspaces/:workspaceId/documents/:documentId')
  @UseGuards(V1WorkspaceOwnershipGuard)
  @ApiOperation({ summary: 'Get document details' })
  @ApiParam({ name: 'workspaceId', example: 'cm3a1b2c3d4e5f6g7h8i9j0k' })
  @ApiParam({ name: 'documentId', example: 'cm3d1o2c3u4m5e6n7t' })
  @ApiResponse({ status: HttpStatus.OK })
  @ApiResponse({ status: HttpStatus.NOT_FOUND })
  async getDocument(
    @Param('workspaceId') workspaceId: string,
    @Param('documentId') documentId: string,
  ): Promise<any> {
    return this.documentsService.getDocument(documentId, workspaceId);
  }

  /**
   * Update document
   */
  @Patch('workspaces/:workspaceId/documents/:documentId')
  @UseGuards(V1WorkspaceOwnershipGuard)
  @ApiOperation({ summary: 'Update document' })
  @ApiParam({ name: 'workspaceId', example: 'cm3a1b2c3d4e5f6g7h8i9j0k' })
  @ApiParam({ name: 'documentId', example: 'cm3d1o2c3u4m5e6n7t' })
  @ApiResponse({ status: HttpStatus.OK })
  async updateDocument(
    @Param('workspaceId') workspaceId: string,
    @Param('documentId') documentId: string,
    @Body() dto: UpdateDocumentDto,
  ): Promise<any> {
    return this.documentsService.updateDocument(documentId, workspaceId, dto);
  }

  /**
   * Delete document
   */
  @Delete('workspaces/:workspaceId/documents/:documentId')
  @UseGuards(V1WorkspaceOwnershipGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete document' })
  @ApiParam({ name: 'workspaceId', example: 'cm3a1b2c3d4e5f6g7h8i9j0k' })
  @ApiParam({ name: 'documentId', example: 'cm3d1o2c3u4m5e6n7t' })
  @ApiResponse({ status: HttpStatus.OK })
  async deleteDocument(
    @Param('workspaceId') workspaceId: string,
    @Param('documentId') documentId: string,
  ): Promise<{ message: string }> {
    await this.documentsService.deleteDocument(documentId, workspaceId);
    return { message: 'Document deleted successfully' };
  }

  /**
   * Get document processing cost
   *
   * @description Uses DocumentAccessGuard (not V1WorkspaceOwnershipGuard) because
   * workspaceId is not in route path. Guard validates user has access to document
   * via workspace membership check.
   */
  @Get(':documentId/cost')
  @UseGuards(V1DocumentAccessGuard)
  @ApiOperation({ summary: 'Get processing cost' })
  @ApiParam({ name: 'documentId', example: 'cm3d1o2c3u4m5e6n7t' })
  @ApiResponse({ status: HttpStatus.OK })
  async getDocumentCost(@Param('documentId') documentId: string): Promise<any> {
    return this.costTrackingService.getDocumentCost(documentId);
  }
}
