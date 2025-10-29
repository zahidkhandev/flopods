/**
 * Document Embeddings Service - FIXED
 */

import {
  Injectable,
  Logger,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { S3Service } from '../../../common/aws/s3/s3.service';
import {
  chunkDocumentText,
  calculateDocumentEmbeddingCost,
  convertDocumentCostToCredits,
} from '../utils';
import { DocumentProcessingType, GEMINI_EMBEDDING_PROVIDER } from '../types';
import type { DocumentEmbeddingConfig } from '../types';
import { V1DocumentQueueProducer } from '../queues/document-queue.producer';

@Injectable()
export class V1DocumentEmbeddingsService {
  private readonly logger = new Logger(V1DocumentEmbeddingsService.name);
  private readonly encryptionKey: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    private readonly configService: ConfigService,
    private readonly queueProducer: V1DocumentQueueProducer,
  ) {
    const key = this.configService.get<string>('API_KEY_ENCRYPTION_SECRET');
    if (!key || key.length !== 64) {
      throw new Error(
        'API_KEY_ENCRYPTION_SECRET must be 64 hex characters (32 bytes). Generate with: openssl rand -hex 32',
      );
    }
    this.encryptionKey = Buffer.from(key, 'hex');
  }

  /**
   * ✅ NEW: Sanitize text to remove null bytes and invalid UTF-8 sequences
   */
  private sanitizeText(text: string): string {
    return (
      text
        .replace(/\0/g, '') // Remove null bytes
        .replace(/\uFFFD/g, '') // Remove replacement characters
        // eslint-disable-next-line no-control-regex
        .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters except \t, \n, \r
        .trim()
    );
  }

  async generateDocumentEmbeddings(documentId: string, text: string): Promise<void> {
    this.logger.log(`[Embeddings] 🚀 Starting for: ${documentId}`);

    // ✅ SANITIZE TEXT FIRST
    const sanitizedText = this.sanitizeText(text);

    if (!sanitizedText || sanitizedText.length < 10) {
      throw new BadRequestException('Document text is empty or too short after sanitization');
    }

    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        workspaceId: true,
        name: true,
        workspace: { select: { id: true, name: true } },
      },
    });

    if (!document) {
      throw new BadRequestException(`Document not found: ${documentId}`);
    }

    const config = await this.getDocumentEmbeddingConfig(document.workspaceId);

    // ✅ USE SANITIZED TEXT FOR CHUNKING
    const chunks = chunkDocumentText(sanitizedText);
    const totalTokens = chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0);
    const cost = calculateDocumentEmbeddingCost(totalTokens);
    const credits = convertDocumentCostToCredits(cost);

    this.logger.debug(
      `[Embeddings] 📊 ${chunks.length} chunks, ${totalTokens} tokens, ${credits} credits`,
    );

    if (config.isPlatformKey) {
      await this.checkAndDeductDocumentCredits(document.workspaceId, credits);
    }

    const genAI = new GoogleGenerativeAI(config.apiKey);
    const model = genAI.getGenerativeModel({ model: config.provider.model });
    const vectorBucket = this.configService.getOrThrow<string>('DOCUMENT_VECTOR_S3_BUCKET');

    for (let i = 0; i < chunks.length; i += config.batchSize) {
      const batch = chunks.slice(i, i + config.batchSize);

      await Promise.all(
        batch.map(async (chunk) => {
          // ✅ SANITIZE CHUNK TEXT AGAIN (extra safety)
          const cleanChunkText = this.sanitizeText(chunk.text);

          const result = await model.embedContent(cleanChunkText);
          const embedding = result.embedding.values;

          const s3Key = `embeddings/${documentId}/chunk-${chunk.index}.json`;
          await this.s3Service.uploadFile({
            key: s3Key,
            body: Buffer.from(
              JSON.stringify(
                {
                  documentId: document.id,
                  documentName: document.name,
                  workspaceId: document.workspaceId,
                  chunkIndex: chunk.index,
                  chunkText: cleanChunkText,
                  embedding,
                  tokenCount: chunk.tokenCount,
                  model: config.provider.model,
                  dimensions: config.provider.dimensions,
                  generatedAt: new Date().toISOString(),
                },
                null,
                2,
              ),
            ),
            contentType: 'application/json',
          });

          const vectorString = `[${embedding.join(',')}]`;

          await this.prisma.$executeRaw`
              INSERT INTO "documents"."Embedding"
              (
                id,
                "documentId",
                model,
                "chunkIndex",
                "chunkText",
                vector,
                "s3VectorBucket",
                "s3VectorKey",
                "vectorDimension",
                metadata,
                "createdAt"
              )
              VALUES (
                gen_random_uuid()::text,
                ${document.id},
                ${config.provider.model},
                ${chunk.index},
                ${cleanChunkText},
                ${vectorString}::vector(768),
                ${vectorBucket},
                ${s3Key},
                ${config.provider.dimensions},
                ${JSON.stringify({
                  tokenCount: chunk.tokenCount,
                  startChar: chunk.startChar,
                  endChar: chunk.endChar,
                  workspaceId: document.workspaceId,
                  documentName: document.name,
                })}::jsonb,
                NOW()
              )
            `;
        }),
      );
    }

    await this.recordDocumentProcessingCost(
      document.id,
      document.workspaceId,
      totalTokens,
      chunks.length,
      cost,
      credits,
    );

    this.logger.log(`[Embeddings] 🎉 Completed ${documentId}: ${chunks.length} embeddings`);
  }

  // ... rest of the methods stay the same ...

  private async getDocumentEmbeddingConfig(
    workspaceId: string,
  ): Promise<DocumentEmbeddingConfig & { isPlatformKey: boolean }> {
    const workspaceApiKey = await this.prisma.providerAPIKey.findFirst({
      where: { workspaceId, provider: 'GOOGLE_GEMINI', isActive: true },
    });

    if (workspaceApiKey) {
      return {
        provider: GEMINI_EMBEDDING_PROVIDER,
        apiKey: this.decryptApiKey(workspaceApiKey.keyHash),
        batchSize: 10,
        concurrency: 5,
        isPlatformKey: false,
      };
    }

    const platformKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!platformKey) {
      throw new ForbiddenException(
        'No Gemini API key available. Configure GEMINI_API_KEY or add your own key in workspace settings.',
      );
    }

    return {
      provider: GEMINI_EMBEDDING_PROVIDER,
      apiKey: platformKey,
      batchSize: 10,
      concurrency: 5,
      isPlatformKey: true,
    };
  }

  private async checkAndDeductDocumentCredits(workspaceId: string, credits: number): Promise<void> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { workspaceId },
      select: { id: true, credits: true, tier: true },
    });

    if (!subscription) {
      throw new ForbiddenException('No active subscription found');
    }

    if (subscription.credits < credits) {
      throw new ForbiddenException(
        `Insufficient credits. Required: ${credits}, Available: ${subscription.credits}`,
      );
    }

    await this.prisma.subscription.update({
      where: { workspaceId },
      data: { credits: { decrement: credits } },
    });
  }

  private async recordDocumentProcessingCost(
    documentId: string,
    workspaceId: string,
    tokensProcessed: number,
    chunkCount: number,
    costInUsd: number,
    credits: number,
  ): Promise<void> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { workspaceId },
      select: { id: true },
    });

    if (!subscription) return;

    await this.prisma.documentProcessingCost.create({
      data: {
        documentId,
        workspaceId,
        subscriptionId: subscription.id,
        processingType: DocumentProcessingType.DOCUMENT_EMBEDDING,
        creditsConsumed: credits,
        extractionCost: 0,
        embeddingCost: costInUsd,
        totalCostInUsd: costInUsd,
        chunkCount,
        embeddingModel: GEMINI_EMBEDDING_PROVIDER.model,
        tokensProcessed,
      },
    });
  }

  encryptApiKey(apiKey: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);

    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');

    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  private decryptApiKey(encryptedKey: string): string {
    const [ivHex, authTagHex, encrypted] = encryptedKey.split(':');

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  async regenerateDocumentEmbeddings(documentId: string): Promise<{
    documentId: string;
    status: string;
    message: string;
  }> {
    this.logger.log(`[Embeddings] 🔄 Regenerating: ${documentId}`);

    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        workspaceId: true,
        name: true,
        storageKey: true,
        externalUrl: true,
        workspace: { select: { name: true } },
      },
    });

    if (!document) {
      throw new NotFoundException(`Document not found: ${documentId}`);
    }

    if (!document.storageKey && !document.externalUrl) {
      throw new BadRequestException('Document has no source file to regenerate from');
    }

    const existingEmbeddings = await this.prisma.embedding.findMany({
      where: { documentId },
      select: { s3VectorKey: true },
    });

    if (existingEmbeddings.length > 0) {
      const s3Keys = existingEmbeddings.map((e) => e.s3VectorKey);
      await this.s3Service.deleteFiles(s3Keys);
      await this.prisma.embedding.deleteMany({ where: { documentId } });
    }

    await this.prisma.document.update({
      where: { id: documentId },
      data: { status: 'PROCESSING' },
    });

    await this.queueProducer.sendDocumentReprocessingJob({
      documentId: document.id,
      workspaceId: document.workspaceId,
      userId: 'system',
    });

    return {
      documentId,
      status: 'queued',
      message: `Regeneration queued for "${document.name}". Deleted ${existingEmbeddings.length} embeddings.`,
    };
  }
}
