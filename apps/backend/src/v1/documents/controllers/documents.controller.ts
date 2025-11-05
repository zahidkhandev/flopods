// /src/modules/v1/documents/controllers/documents.controller.ts

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
    description: 'Upload PDF, image, Word doc, or other supported file for async processing.',
  })
  @ApiParam({
    name: 'workspaceId',
    description: 'Target workspace ID',
    example: 'cm3a1b2c3d4e5f6g7h8i9j0k',
  })
  @ApiBody({
    description: 'Multipart form-data with file and optional folder ID',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File to upload',
        },
        folderId: {
          type: 'string',
          description: 'Optional folder ID',
          nullable: true,
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Document uploaded and queued',
    schema: {
      example: {
        documentId: 'cm3d1o2c3u4m5e6n7t',
        status: 'queued',
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

  @Post('workspaces/:workspaceId/external')
  @UseGuards(V1WorkspaceOwnershipGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Link external document',
    description: 'Link YouTube, Vimeo, Loom, or web URL for processing',
  })
  @ApiParam({ name: 'workspaceId', example: 'cm3a1b2c3d4e5f6g7h8i9j0k' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'External document linked',
    schema: {
      example: {
        documentId: 'cm3d1o2c3u4m5e6n7t',
        status: 'queued',
        sourceType: 'YOUTUBE',
      },
    },
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

  @Get('workspaces/:workspaceId')
  @UseGuards(V1WorkspaceOwnershipGuard)
  @ApiOperation({ summary: 'List documents' })
  @ApiParam({ name: 'workspaceId', example: 'cm3a1b2c3d4e5f6g7h8i9j0k' })
  @ApiResponse({ status: HttpStatus.OK })
  async listDocuments(
    @Param('workspaceId') workspaceId: string,
    @Query() dto: ListDocumentsDto,
  ): Promise<any> {
    return this.documentsService.listDocuments(workspaceId, dto);
  }

  @Post('workspaces/:workspaceId/search')
  @UseGuards(V1WorkspaceOwnershipGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Semantic search',
    description: 'Vector similarity search via pgvector',
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

  @Get('workspaces/:workspaceId/documents/:documentId')
  @UseGuards(V1WorkspaceOwnershipGuard)
  @ApiOperation({ summary: 'Get document details' })
  @ApiParam({ name: 'workspaceId', example: 'cm3a1b2c3d4e5f6g7h8i9j0k' })
  @ApiParam({ name: 'documentId', example: 'cm3d1o2c3u4m5e6n7t' })
  @ApiResponse({ status: HttpStatus.OK })
  async getDocument(
    @Param('workspaceId') workspaceId: string,
    @Param('documentId') documentId: string,
  ): Promise<any> {
    return this.documentsService.getDocument(documentId, workspaceId);
  }

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

  @Get(':documentId/cost')
  @UseGuards(V1DocumentAccessGuard)
  @ApiOperation({ summary: 'Get processing cost' })
  @ApiParam({ name: 'documentId', example: 'cm3d1o2c3u4m5e6n7t' })
  @ApiResponse({ status: HttpStatus.OK })
  async getDocumentCost(@Param('documentId') documentId: string): Promise<any> {
    return this.costTrackingService.getDocumentCost(documentId);
  }
}
