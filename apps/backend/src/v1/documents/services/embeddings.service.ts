/**
 * Document Embeddings Service
 *
 * @description Production-grade embedding generation using Gemini text-embedding-004.
 * Supports BYOK (Bring Your Own Key) with AES-256-GCM encryption.
 * Implements credit checking, cost tracking, and dual storage (pgvector + S3).
 *
 * @module v1/documents/services/embeddings
 */

import { Injectable, Logger, ForbiddenException, BadRequestException } from '@nestjs/common';
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
/**
 * Document embeddings service
 *
 * @description Generates embeddings for document chunks and stores them in PostgreSQL + S3.
 * Handles BYOK (user's Gemini key) or platform credits.
 */
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
    // Use the SAME encryption key as workspace service
    const key = this.configService.get<string>('API_KEY_ENCRYPTION_SECRET');
    if (!key || key.length !== 64) {
      throw new Error('API_KEY_ENCRYPTION_SECRET must be 64 hex characters (32 bytes)');
    }
    this.encryptionKey = Buffer.from(key, 'hex');
  }

  /**
   * Generate embeddings for document text
   *
   * @description Main method to generate and store embeddings for a document.
   * Flow: Chunk text -> Check credits -> Generate embeddings -> Store in DB + S3 -> Record cost
   *
   * @param documentId - Document ID from database
   * @param text - Extracted text content
   * @throws {BadRequestException} If document not found
   * @throws {ForbiddenException} If insufficient credits
   */
  async generateDocumentEmbeddings(documentId: string, text: string): Promise<void> {
    this.logger.log(`[Embeddings] Starting generation for: ${documentId}`);

    // Fetch document
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        workspaceId: true,
        name: true,
      },
    });

    if (!document) {
      throw new BadRequestException('Document not found');
    }

    // Get embedding configuration (BYOK or platform)
    const config = await this.getDocumentEmbeddingConfig(document.workspaceId);

    // Chunk text
    const chunks = chunkDocumentText(text);
    this.logger.debug(`[Embeddings] Created ${chunks.length} chunks for ${documentId}`);

    // Calculate cost
    const totalTokens = chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0);
    const cost = calculateDocumentEmbeddingCost(totalTokens);
    const credits = convertDocumentCostToCredits(cost);

    this.logger.debug(`[Embeddings] Cost: $${cost.toFixed(6)}, Credits: ${credits}`);

    // Check and deduct credits if using platform key
    if (config.isPlatformKey) {
      await this.checkAndDeductDocumentCredits(document.workspaceId, credits);
    }

    // Generate embeddings in batches
    const genAI = new GoogleGenerativeAI(config.apiKey);
    const model = genAI.getGenerativeModel({ model: config.provider.model });

    const vectorBucket = this.configService.getOrThrow<string>('DOCUMENT_VECTOR_S3_BUCKET');

    for (let i = 0; i < chunks.length; i += config.batchSize) {
      const batch = chunks.slice(i, i + config.batchSize);

      await Promise.all(
        batch.map(async (chunk) => {
          try {
            // Generate embedding
            const result = await model.embedContent(chunk.text);
            const embedding = result.embedding.values;

            // Store in S3 first (backup)
            const s3Key = `embeddings/${documentId}/chunk-${chunk.index}.json`;
            await this.s3Service.uploadFile({
              key: s3Key,
              body: Buffer.from(
                JSON.stringify({
                  embedding,
                  tokenCount: chunk.tokenCount,
                  text: chunk.text,
                }),
              ),
              contentType: 'application/json',
            });

            // Store in PostgreSQL (note: vector field is handled by raw SQL)
            await this.prisma.$executeRaw`
              INSERT INTO "documents"."Embedding"
              (id, "documentId", model, "chunkIndex", "chunkText", vector, "s3VectorBucket", "s3VectorKey", "vectorDimension", metadata, "createdAt")
              VALUES (
                gen_random_uuid()::text,
                ${document.id},
                ${config.provider.model},
                ${chunk.index},
                ${chunk.text},
                ${`[${embedding.join(',')}]`}::vector(768),
                ${vectorBucket},
                ${s3Key},
                ${config.provider.dimensions},
                ${JSON.stringify({
                  tokenCount: chunk.tokenCount,
                  startChar: chunk.startChar,
                  endChar: chunk.endChar,
                })}::jsonb,
                NOW()
              )
            `;

            this.logger.debug(`[Embeddings] Stored chunk ${chunk.index} for ${documentId}`);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(
              `[Embeddings] Failed to process chunk ${chunk.index}: ${errorMessage}`,
            );
            throw error;
          }
        }),
      );

      this.logger.debug(
        `[Embeddings] Processed batch ${Math.floor(i / config.batchSize) + 1}/${Math.ceil(chunks.length / config.batchSize)} for ${documentId}`,
      );
    }

    // Record processing cost
    await this.recordDocumentProcessingCost(
      document.id,
      document.workspaceId,
      totalTokens,
      chunks.length,
      cost,
      credits,
    );

    this.logger.log(
      `[Embeddings] ✅ Completed ${documentId}: ${chunks.length} embeddings, ${totalTokens} tokens, ${credits} credits`,
    );
  }

  /**
   * Get embedding configuration (BYOK or platform key)
   *
   * @param workspaceId - Workspace ID
   * @returns Embedding configuration with API key
   */
  private async getDocumentEmbeddingConfig(
    workspaceId: string,
  ): Promise<DocumentEmbeddingConfig & { isPlatformKey: boolean }> {
    // Check for BYOK (Bring Your Own Key)
    const workspaceApiKey = await this.prisma.providerAPIKey.findFirst({
      where: {
        workspaceId,
        provider: 'GOOGLE_GEMINI',
        isActive: true,
      },
    });

    if (workspaceApiKey) {
      this.logger.debug(`[Embeddings] Using BYOK for workspace: ${workspaceId}`);

      const decryptedKey = this.decryptApiKey(workspaceApiKey.keyHash);

      return {
        provider: GEMINI_EMBEDDING_PROVIDER,
        apiKey: decryptedKey,
        batchSize: 10,
        concurrency: 5,
        isPlatformKey: false,
      };
    }

    // Use platform key
    this.logger.debug(`[Embeddings] Using platform key for workspace: ${workspaceId}`);

    const platformKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!platformKey) {
      throw new ForbiddenException('Platform Gemini API key not configured');
    }

    return {
      provider: GEMINI_EMBEDDING_PROVIDER,
      apiKey: platformKey,
      batchSize: 10,
      concurrency: 5,
      isPlatformKey: true,
    };
  }

  /**
   * Check and deduct credits from subscription
   *
   * @param workspaceId - Workspace ID
   * @param credits - Number of credits to deduct
   * @throws {ForbiddenException} If insufficient credits
   */
  private async checkAndDeductDocumentCredits(workspaceId: string, credits: number): Promise<void> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { workspaceId },
    });

    if (!subscription) {
      throw new ForbiddenException('No subscription found for workspace');
    }

    if (subscription.credits < credits) {
      throw new ForbiddenException(
        `Insufficient credits. Required: ${credits}, Available: ${subscription.credits}. ` +
          `Please add credits or configure your own Gemini API key.`,
      );
    }

    // Deduct credits atomically
    await this.prisma.subscription.update({
      where: { workspaceId },
      data: {
        credits: {
          decrement: credits,
        },
      },
    });

    this.logger.debug(`[Embeddings] ✅ Deducted ${credits} credits from workspace: ${workspaceId}`);
  }

  /**
   * Record document processing cost in database
   *
   * @param documentId - Document ID
   * @param workspaceId - Workspace ID
   * @param tokensProcessed - Total tokens processed
   * @param chunkCount - Number of chunks created
   * @param costInUsd - Total cost in USD
   * @param credits - Total credits consumed
   */
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

    this.logger.debug(`[Embeddings] ✅ Recorded cost for ${documentId}`);
  }

  /**
   * Encrypt API key using AES-256-GCM
   *
   * @param apiKey - Plain API key
   * @returns Encrypted key in format "iv:authTag:encrypted"
   */
  encryptApiKey(apiKey: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);

    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');

    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypt API key using AES-256-GCM
   *
   * @param encryptedKey - Encrypted key in format "iv:authTag:encrypted"
   * @returns Plain API key
   */
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

  /**
   * Regenerate document embeddings
   *
   * @description Deletes existing embeddings and regenerates them from source document.
   * Useful after model upgrades, quality issues, or chunk size changes.
   *
   * **Process:**
   * 1. Verify document exists and has source text
   * 2. Delete existing embeddings (PostgreSQL + S3)
   * 3. Re-extract text from original source
   * 4. Generate new embeddings with current model
   *
   * **Note:** This consumes credits same as initial processing
   *
   * @param documentId - Document ID to regenerate
   * @returns Status message
   * @throws {BadRequestException} If document not found or no source available
   */
  async regenerateDocumentEmbeddings(documentId: string): Promise<{
    documentId: string;
    status: string;
    message: string;
  }> {
    this.logger.log(`[Embeddings] Regenerating for: ${documentId}`);

    // Fetch document
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        workspaceId: true,
        name: true,
        storageKey: true,
        s3Bucket: true,
        externalUrl: true,
        sourceType: true,
        mimeType: true,
      },
    });

    if (!document) {
      throw new BadRequestException('Document not found');
    }

    // Verify we have a source to regenerate from
    if (!document.storageKey && !document.externalUrl) {
      throw new BadRequestException('Document has no source file to regenerate from');
    }

    // Delete existing embeddings
    const existingEmbeddings = await this.prisma.embedding.findMany({
      where: { documentId },
      select: { id: true, s3VectorKey: true },
    });

    if (existingEmbeddings.length > 0) {
      this.logger.debug(
        `[Embeddings] Deleting ${existingEmbeddings.length} existing embeddings for ${documentId}`,
      );

      // Delete from S3
      const s3Keys = existingEmbeddings.map((e) => e.s3VectorKey);
      if (s3Keys.length > 0) {
        await this.s3Service.deleteFiles(s3Keys);
      }

      // Delete from PostgreSQL
      await this.prisma.embedding.deleteMany({
        where: { documentId },
      });

      this.logger.debug(`[Embeddings] Deleted existing embeddings for ${documentId}`);
    }

    // Update document status to PROCESSING
    await this.prisma.document.update({
      where: { id: documentId },
      data: { status: 'PROCESSING' },
    });

    // ✅ Queue regeneration job
    await this.queueProducer.sendDocumentReprocessingJob({
      documentId: document.id,
      workspaceId: document.workspaceId,
      userId: 'system', // System-initiated regeneration
    });

    this.logger.log(`[Embeddings] ✅ Queued regeneration for: ${documentId}`);

    return {
      documentId,
      status: 'queued',
      message:
        `Embeddings regeneration queued. Previous ${existingEmbeddings.length} embeddings deleted. ` +
        `New embeddings will be generated shortly. This will consume credits.`,
    };
  }
}
