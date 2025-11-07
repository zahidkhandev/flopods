/**
 * V1 Document Module
 *
 * @description Production-grade module for document management system.
 * Provides comprehensive document processing, storage, search, and organization.
 *
 * Includes:
 * - Document upload, storage, and retrieval
 * - Vector embeddings and semantic search
 * - Image vision analysis (Gemini)
 * - YouTube transcript extraction
 * - Cost tracking and analytics
 * - Queue-based async processing
 *
 * @module v1/documents
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Controllers
import { V1DocumentsController } from './controllers/documents.controller';
import { V1DocumentFoldersController } from './controllers/folders.controller';
import { V1DocumentCostTrackingController } from './controllers/cost-tracking.controller';
import { V1EmbeddingsController } from './controllers/embeddings.controller';

// Services
import { V1DocumentsService } from './services/documents.service';
import { V1DocumentFoldersService } from './services/folders.service';
import { V1DocumentVectorSearchService } from './services/vector-search.service';
import { V1DocumentCostTrackingService } from './services/cost-tracking.service';
import { V1DocumentEmbeddingsService } from './services/embeddings.service';
import { V1DocumentOrchestratorService } from './services/document-orchestrator.service';
import { V1GeminiVisionService } from './services/gemini-vision.service';
import { V1YouTubeProcessorService } from './services/youtube-processor.service';

// Helpers
import { V1YouTubeTranscriptExtractor } from './helpers/youtube-transcript-extractor';

// Guards
import { V1WorkspaceOwnershipGuard } from './guards/workspace-ownership.guard';
import { V1DocumentAccessGuard } from './guards/document-access.guard';

// Interceptors
import { V1FileSizeLimitInterceptor } from './interceptors/file-size-limit.interceptor';
import { V1FileTypeValidatorInterceptor } from './interceptors/file-type-validator.interceptor';

// Queue
import { V1DocumentQueueProducer } from './queues/document-queue.producer';
import { V1DocumentQueueFactory } from './queues/queue.factory';
import {
  V1DocumentQueueConsumer,
  V1BullMQDocumentQueueService,
  V1SQSDocumentQueueService,
} from './queues';

// Common
import { PrismaModule } from '../../prisma/prisma.module';
import { AwsModule } from '../../common/aws/aws.module';
import { V1ApiKeyService } from '../workspace/services/api-key.service';
import { ApiKeyEncryptionService } from '../../common/services/encryption.service';

@Module({
  imports: [ConfigModule, PrismaModule, AwsModule],
  controllers: [
    V1DocumentsController,
    V1DocumentFoldersController,
    V1DocumentCostTrackingController,
    V1EmbeddingsController,
  ],
  providers: [
    // ✅ Core Services
    ApiKeyEncryptionService,
    V1ApiKeyService,
    V1DocumentsService,
    V1DocumentFoldersService,
    V1DocumentVectorSearchService,
    V1DocumentCostTrackingService,
    V1DocumentEmbeddingsService,
    V1DocumentOrchestratorService,
    V1GeminiVisionService,

    // ✅ YouTube Services (NO DUPLICATE)
    V1YouTubeTranscriptExtractor,
    V1YouTubeProcessorService,

    // ✅ Guards
    V1WorkspaceOwnershipGuard,
    V1DocumentAccessGuard,

    // ✅ Interceptors
    V1FileSizeLimitInterceptor,
    V1FileTypeValidatorInterceptor,

    // ✅ Queue Services
    V1BullMQDocumentQueueService,
    V1SQSDocumentQueueService,
    V1DocumentQueueProducer,
    V1DocumentQueueFactory,
    V1DocumentQueueConsumer,
  ],
  exports: [
    V1DocumentsService,
    V1DocumentFoldersService,
    V1DocumentVectorSearchService,
    V1DocumentCostTrackingService,
    V1DocumentEmbeddingsService,
    V1DocumentOrchestratorService,
    V1GeminiVisionService,
    V1YouTubeProcessorService,
    V1YouTubeTranscriptExtractor,
    V1DocumentQueueProducer,
  ],
})
export class V1DocumentModule {}
