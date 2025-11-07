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
        sizeInBytes: BigInt(file.size),
        status: DocumentStatus.UPLOADING,
        storageKey: s3Key,
        s3Bucket,
        folderId: folderId || null,
        dynamoPartitionKey: `workspace#${workspaceId}`,
        dynamoSortKey: `document#${Date.now()}`,
        uploadedBy: userId,
        metadata: {
          uploadedAt: new Date().toISOString(),
        },
      },
    });

    await this.prisma.document.update({
      where: { id: document.id },
      data: {
        dynamoPartitionKey: `workspace#${workspaceId}`,
        dynamoSortKey: `document#${document.id}`,
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

  async updateDocument(
    documentId: string,
    workspaceId: string,
    updateData: {
      name?: string;
      folderId?: string | null;
    },
  ): Promise<any> {
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

  async linkExternalDocument(
    workspaceId: string,
    userId: string,
    externalUrl: string,
    sourceType: DocumentSourceType,
    name?: string,
    folderId?: string | null,
  ): Promise<any> {
    if (folderId) {
      const folder = await this.prisma.documentFolder.findUnique({
        where: { id: folderId },
      });

      if (!folder) {
        throw new BadRequestException(`Folder not found: ${folderId}`);
      }

      if (folder.workspaceId !== workspaceId) {
        throw new BadRequestException('Folder does not belong to this workspace');
      }
    }

    const documentName = name || this.generateDocumentName(externalUrl, sourceType);

    const document = await this.prisma.document.create({
      data: {
        workspaceId,
        folderId: folderId || null,
        name: documentName,
        sourceType,
        fileType: 'external',
        externalUrl,
        externalProvider: this.getProvider(sourceType),
        status: DocumentStatus.UPLOADING,
        uploadedBy: userId,
        dynamoPartitionKey: `workspace#${workspaceId}`,
        dynamoSortKey: `document#${Date.now()}`,
        metadata: {
          sourceUrl: externalUrl,
          createdAt: new Date().toISOString(),
          ...this.extractExternalMetadata(externalUrl, sourceType),
        },
      },
    });

    await this.prisma.document.update({
      where: { id: document.id },
      data: {
        dynamoPartitionKey: `workspace#${workspaceId}`,
        dynamoSortKey: `document#${document.id}`,
      },
    });

    await this.queueProducer.sendDocumentProcessingJob({
      documentId: document.id,
      workspaceId,
      userId,
      fileType: 'external',
      sourceType,
    });

    this.logger.log(`[Documents] Linking external source: ${externalUrl} (${sourceType})`);

    return { documentId: document.id, status: 'queued', sourceType };
  }

  private extractExternalMetadata(
    url: string,
    sourceType: DocumentSourceType,
  ): Record<string, any> {
    const metadata: Record<string, any> = { originalUrl: url };

    try {
      switch (sourceType) {
        case DocumentSourceType.YOUTUBE: {
          metadata.externalId = this.extractYouTubeId(url);
          metadata.platform = 'YouTube';
          break;
        }

        case DocumentSourceType.VIMEO: {
          metadata.externalId = this.extractVimeoId(url);
          metadata.platform = 'Vimeo';
          break;
        }

        case DocumentSourceType.LOOM: {
          metadata.externalId = this.extractLoomId(url);
          metadata.platform = 'Loom';
          break;
        }

        case DocumentSourceType.URL: {
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

  private extractVimeoId(url: string): string {
    const pattern = /vimeo\.com\/(\d+)/;
    const match = url.match(pattern);

    if (!match) {
      throw new BadRequestException('Invalid Vimeo URL format');
    }

    return match[1];
  }

  private extractLoomId(url: string): string {
    const pattern = /loom\.com\/share\/([a-zA-Z0-9]+)/;
    const match = url.match(pattern);

    if (!match) {
      throw new BadRequestException('Invalid Loom URL format');
    }

    return match[1];
  }

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
