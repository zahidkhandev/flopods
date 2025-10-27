/**
 * V1 Document Module
 *
 * @description Production-grade module for document management system.
 * Provides comprehensive document processing, storage, search, and organization.
 *
 * **Core Features:**
 * - Multi-source document ingestion (files, YouTube, Vimeo, Loom, URLs)
 * - Automatic text extraction and embedding generation
 * - Semantic search powered by pgvector (sub-250ms for 10M vectors)
 * - Hierarchical folder organization (tree structure, unlimited depth)
 * - Tier-based file size limits (HOBBYIST: 10MB, PRO: 100MB, TEAM: 500MB)
 * - BYOK support (Bring Your Own Key) with AES-256-GCM encryption
 * - Credit-based billing with comprehensive cost tracking
 * - Async processing via BullMQ (dev) / SQS (prod)
 * - Dual storage: PostgreSQL (pgvector) + S3 (backup)
 *
 * **Architecture:**
 * - Controllers: REST API endpoints with validation
 * - Services: Business logic and data operations
 * - Guards: JWT auth + workspace/document access control
 * - Interceptors: File validation (type, size)
 * - Queue: Async document processing
 * - Storage: S3 for files, PostgreSQL for metadata + vectors
 *
 * **Security:**
 * - JWT authentication on all routes
 * - Workspace isolation enforced
 * - File type whitelist validation
 * - Tier-based size limits
 * - API key encryption (AES-256-GCM)
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

// Guards
import { V1WorkspaceOwnershipGuard } from './guards/workspace-ownership.guard';
import { V1DocumentAccessGuard } from './guards/document-access.guard';

// Interceptors
import { V1FileSizeLimitInterceptor } from './interceptors/file-size-limit.interceptor';
import { V1FileTypeValidatorInterceptor } from './interceptors/file-type-validator.interceptor';

// Queue
import { V1DocumentQueueProducer } from './queues/document-queue.producer';
import { V1DocumentQueueFactory } from './queues/queue.factory';

// Shared modules
import { PrismaModule } from '../../prisma/prisma.module';
import { AwsModule } from '../../common/aws/aws.module';
import { V1BullMQDocumentQueueService, V1SQSDocumentQueueService } from './queues';

/**
 * V1 Document Module
 *
 * @description Encapsulates all document-related functionality including
 * document management, embeddings, search, folders, and cost tracking.
 *
 * **Module Organization:**
 *
 * **Controllers (REST API):**
 * - DocumentsController: Upload, search, CRUD operations
 * - FoldersController: Folder hierarchy management
 * - CostTrackingController: Cost analytics and reporting
 * - EmbeddingsController: Embedding inspection and regeneration
 *
 * **Services (Business Logic):**
 * - DocumentsService: Document lifecycle management
 * - FoldersService: Folder tree operations
 * - VectorSearchService: Semantic search via pgvector
 * - CostTrackingService: Cost calculation and tracking
 * - EmbeddingsService: Embedding generation with Gemini
 *
 * **Guards (Security):**
 * - WorkspaceOwnershipGuard: Validates workspace membership
 * - DocumentAccessGuard: Validates document access rights
 *
 * **Interceptors (Validation):**
 * - FileSizeLimitInterceptor: Tier-based size limits
 * - FileTypeValidatorInterceptor: MIME type whitelist
 *
 * **Queue (Async Processing):**
 * - DocumentQueueProducer: Send jobs to queue
 * - DocumentQueueFactory: Create queue service (BullMQ/SQS)
 *
 * **Dependencies:**
 * - PrismaModule: Database access
 * - S3Module: File storage
 * - ConfigModule: Environment configuration
 */
@Module({
  imports: [
    ConfigModule, // Environment variables
    PrismaModule, // Database access
    AwsModule,
  ],
  controllers: [
    V1DocumentsController, // Main document API
    V1DocumentFoldersController, // Folder organization API
    V1DocumentCostTrackingController, // Cost analytics API
    V1EmbeddingsController, // Embeddings management API
  ],
  providers: [
    // Core Services
    V1DocumentsService,
    V1DocumentFoldersService,
    V1DocumentVectorSearchService,
    V1DocumentCostTrackingService,
    V1DocumentEmbeddingsService,

    // Guards
    V1WorkspaceOwnershipGuard,
    V1DocumentAccessGuard,

    // Interceptors
    V1FileSizeLimitInterceptor,
    V1FileTypeValidatorInterceptor,
    V1BullMQDocumentQueueService,
    V1SQSDocumentQueueService,
    // Queue
    V1DocumentQueueProducer,
    V1DocumentQueueFactory,
  ],
  exports: [
    // Export services for use in other modules
    V1DocumentsService,
    V1DocumentFoldersService,
    V1DocumentVectorSearchService,
    V1DocumentCostTrackingService,
    V1DocumentEmbeddingsService,
    V1DocumentQueueProducer,
  ],
})
export class V1DocumentModule {}
