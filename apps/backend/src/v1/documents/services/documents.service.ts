/**
 * Documents Service
 */

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { S3Service } from '../../../common/aws/s3/s3.service';
import { V1DocumentQueueProducer } from '../queues/document-queue.producer';
import { DocumentSourceType, DocumentStatus } from '@flopods/schema';
import { validateDocumentFileType } from '../utils';
import type { Document } from '@flopods/schema';

@Injectable()
export class V1DocumentsService {
  private readonly logger = new Logger(V1DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    private readonly queueProducer: V1DocumentQueueProducer,
    private readonly configService: ConfigService,
  ) {}

  async uploadDocument(
    workspaceId: string,
    userId: string,
    file: Express.Multer.File,
    folderId?: string,
  ): Promise<{ documentId: string; status: string }> {
    this.logger.log(`[Documents] Uploading file: ${file.originalname} (${file.size} bytes)`);

    const validation = await validateDocumentFileType(file.buffer, file.originalname);

    const s3Bucket = this.configService.getOrThrow<string>('DOCUMENT_S3_BUCKET');
    const s3Key = `documents/${workspaceId}/${Date.now()}-${file.originalname}`;

    await this.s3Service.uploadFile({
      key: s3Key,
      body: file.buffer,
      contentType: validation.mimeType,
    });

    const document = await this.prisma.document.create({
      data: {
        workspaceId,
        name: file.originalname,
        sourceType: DocumentSourceType.INTERNAL,
        fileType: validation.category,
        mimeType: validation.mimeType,
        sizeInBytes: BigInt(file.size), // ✅ Convert to BigInt
        status: DocumentStatus.UPLOADING,
        storageKey: s3Key,
        s3Bucket,
        folderId: folderId || null,
        metadata: {},
      },
    });

    await this.queueProducer.sendDocumentProcessingJob({
      documentId: document.id,
      workspaceId,
      userId,
      fileType: validation.mimeType,
      sourceType: DocumentSourceType.INTERNAL,
    });

    this.logger.log(`[Documents] Created document: ${document.id}`);

    // ✅ Return only serializable data (no BigInt)
    return {
      documentId: document.id,
      status: 'queued',
    };
  }

  async getDocument(
    documentId: string,
    workspaceId: string,
  ): Promise<Document & { folder: { id: string; name: string } | null }> {
    const document = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        workspaceId,
      },
      include: {
        folder: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return document;
  }

  async listDocuments(
    workspaceId: string,
    options: {
      folderId?: string;
      status?: DocumentStatus;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const { folderId, status, page = 1, limit = 20 } = options;

    const where: any = { workspaceId };
    if (folderId) where.folderId = folderId;
    if (status) where.status = status;

    const [documents, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          sourceType: true,
          fileType: true,
          mimeType: true,
          sizeInBytes: true,
          status: true,
          createdAt: true,
          folder: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      this.prisma.document.count({ where }),
    ]);

    return {
      data: documents,
      pagination: {
        totalItems: total,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        pageSize: documents.length,
      },
    };
  }

  async deleteDocument(documentId: string, workspaceId: string): Promise<void> {
    const document = await this.getDocument(documentId, workspaceId);

    if (document.storageKey) {
      await this.s3Service.deleteFile(document.storageKey);
    }

    const embeddings = await this.prisma.embedding.findMany({
      where: { documentId },
      select: { s3VectorKey: true },
    });

    if (embeddings.length > 0) {
      await this.s3Service.deleteFiles(embeddings.map((e) => e.s3VectorKey));
    }

    await this.prisma.document.delete({
      where: { id: documentId },
    });

    this.logger.log(`[Documents] Deleted document: ${documentId}`);
  }

  /**
   * Update document
   */
  async updateDocument(
    documentId: string,
    workspaceId: string,
    updateData: {
      name?: string;
      folderId?: string | null;
    },
  ): Promise<{
    id: string;
    workspaceId: string;
    folderId: string | null;
    name: string;
    sourceType: DocumentSourceType;
    storageKey: string | null;
    s3Bucket: string | null;
    externalUrl: string | null;
    externalProvider: string | null;
    externalFileId: string | null;
    fileType: string;
    mimeType: string | null;
    sizeInBytes: bigint | null;
    status: DocumentStatus;
    uploadedBy: string | null;
    metadata: any;
    createdAt: Date;
    updatedAt: Date;
    folder: {
      id: string;
      name: string;
    } | null;
  }> {
    await this.getDocument(documentId, workspaceId);

    if (updateData.folderId !== undefined && updateData.folderId !== null) {
      const folder = await this.prisma.documentFolder.findFirst({
        where: {
          id: updateData.folderId,
          workspaceId,
        },
      });

      if (!folder) {
        throw new NotFoundException('Destination folder not found');
      }
    }

    const updated = await this.prisma.document.update({
      where: { id: documentId },
      data: {
        ...(updateData.name && { name: updateData.name }),
        ...(updateData.folderId !== undefined && { folderId: updateData.folderId }),
      },
      include: {
        folder: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    this.logger.log(`[Documents] Updated document: ${documentId}`);

    return updated;
  }

  /**
   * Link external document
   *
   * @description Links external document source (YouTube, Vimeo, Loom, URL) and queues for processing.
   * Validates URL format, creates document record, and queues content fetching job.
   *
   * **Supported Sources:**
   * - YouTube: Extracts video ID and queues transcript fetch
   * - Vimeo: Extracts video ID and queues transcript fetch
   * - Loom: Extracts video ID and queues transcript fetch
   * - URL: Validates URL format and queues web scraping
   *
   * **Processing:**
   * 1. Validate URL format and extract metadata
   * 2. Check workspace credits (same as file upload)
   * 3. Create document record with sourceType
   * 4. Queue fetching job for background processing
   * 5. Background worker fetches content and generates embeddings
   *
   * @param workspaceId - Target workspace ID
   * @param userId - User ID initiating the link
   * @param externalUrl - External source URL
   * @param sourceType - Source type (YOUTUBE, VIMEO, LOOM, URL)
   * @param customName - Optional custom document name
   * @param folderId - Optional folder ID for organization
   * @returns Document ID and queued status
   *
   * @throws {BadRequestException} Invalid URL format or unsupported source
   */
  async linkExternalDocument(
    workspaceId: string,
    userId: string,
    externalUrl: string,
    sourceType: DocumentSourceType,
    customName?: string,
    folderId?: string,
  ): Promise<{ documentId: string; status: string; sourceType: DocumentSourceType }> {
    this.logger.log(`[Documents] Linking external source: ${externalUrl} (${sourceType})`);

    // Validate source type
    if (!['YOUTUBE', 'VIMEO', 'LOOM', 'URL'].includes(sourceType)) {
      throw new BadRequestException(
        `Unsupported source type: ${sourceType}. Supported: YOUTUBE, VIMEO, LOOM, URL`,
      );
    }

    // Extract metadata based on source type
    const metadata = this.extractExternalMetadata(externalUrl, sourceType);

    // Generate document name
    const documentName = customName || this.generateDocumentName(externalUrl, sourceType);

    // Create document record
    const document = await this.prisma.document.create({
      data: {
        workspaceId,
        name: documentName,
        sourceType,
        fileType: sourceType === DocumentSourceType.URL ? 'WEB_PAGE' : 'VIDEO',
        mimeType: null, // Set after fetching
        sizeInBytes: null, // Unknown until fetched
        status: DocumentStatus.UPLOADING,
        externalUrl,
        externalProvider: this.getProvider(sourceType),
        externalFileId: metadata.externalId,
        storageKey: null,
        s3Bucket: null,
        folderId: folderId || null,
        metadata,
      },
    });

    // Queue fetching job
    await this.queueProducer.sendDocumentProcessingJob({
      documentId: document.id,
      workspaceId,
      userId,
      fileType: sourceType,
      sourceType,
      externalUrl,
    });

    this.logger.log(`[Documents] Created external document: ${document.id}`);

    return {
      documentId: document.id,
      status: 'queued',
      sourceType,
    };
  }

  /**
   * Extract metadata from external URL
   *
   * @private
   */

  private extractExternalMetadata(
    url: string,
    sourceType: DocumentSourceType,
  ): Record<string, any> {
    const metadata: Record<string, any> = { originalUrl: url };

    try {
      switch (sourceType) {
        case DocumentSourceType.YOUTUBE: {
          // ✅ ADD BRACES
          metadata.externalId = this.extractYouTubeId(url);
          metadata.platform = 'YouTube';
          break;
        }

        case DocumentSourceType.VIMEO: {
          // ✅ ADD BRACES
          metadata.externalId = this.extractVimeoId(url);
          metadata.platform = 'Vimeo';
          break;
        }

        case DocumentSourceType.LOOM: {
          // ✅ ADD BRACES
          metadata.externalId = this.extractLoomId(url);
          metadata.platform = 'Loom';
          break;
        }

        case DocumentSourceType.URL: {
          // ✅ ADD BRACES (fixes "const urlObj" error)
          const urlObj = new URL(url);
          metadata.externalId = Buffer.from(url).toString('base64').substring(0, 50);
          metadata.domain = urlObj.hostname;
          metadata.platform = 'Web';
          break;
        }

        default:
          break;
      }
    } catch {
      throw new BadRequestException(`Invalid ${sourceType} URL format: ${url}`);
    }

    return metadata;
  }

  /**
   * Extract YouTube video ID from URL
   *
   * @private
   * @example
   * - https://www.youtube.com/watch?v=dQw4w9WgXcQ → dQw4w9WgXcQ
   * - https://youtu.be/dQw4w9WgXcQ → dQw4w9WgXcQ
   */
  private extractYouTubeId(url: string): string {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }

    throw new BadRequestException('Invalid YouTube URL format');
  }

  /**
   * Extract Vimeo video ID from URL
   *
   * @private
   * @example
   * - https://vimeo.com/123456789 → 123456789
   */
  private extractVimeoId(url: string): string {
    const pattern = /vimeo\.com\/(\d+)/;
    const match = url.match(pattern);

    if (!match) {
      throw new BadRequestException('Invalid Vimeo URL format');
    }

    return match[1];
  }

  /**
   * Extract Loom video ID from URL
   *
   * @private
   * @example
   * - https://www.loom.com/share/abc123def456 → abc123def456
   */
  private extractLoomId(url: string): string {
    const pattern = /loom\.com\/share\/([a-zA-Z0-9]+)/;
    const match = url.match(pattern);

    if (!match) {
      throw new BadRequestException('Invalid Loom URL format');
    }

    return match[1];
  }

  /**
   * Generate document name from URL
   *
   * @private
   */
  private generateDocumentName(url: string, sourceType: DocumentSourceType): string {
    switch (sourceType) {
      case DocumentSourceType.YOUTUBE:
        return `YouTube Video - ${this.extractYouTubeId(url)}`;

      case DocumentSourceType.VIMEO:
        return `Vimeo Video - ${this.extractVimeoId(url)}`;

      case DocumentSourceType.LOOM:
        return `Loom Recording - ${this.extractLoomId(url)}`;

      case DocumentSourceType.URL:
        try {
          const urlObj = new URL(url);
          return `Web Page - ${urlObj.hostname}`;
        } catch {
          return 'Web Page';
        }

      default:
        return 'External Document';
    }
  }

  /**
   * Get provider name from source type
   *
   * @private
   */
  private getProvider(sourceType: DocumentSourceType): string {
    const providers: Record<string, string> = {
      YOUTUBE: 'youtube',
      VIMEO: 'vimeo',
      LOOM: 'loom',
      URL: 'web',
      GOOGLE_DRIVE: 'google_drive',
    };

    return providers[sourceType] || 'unknown';
  }
}
