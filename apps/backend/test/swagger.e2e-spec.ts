import { Test } from '@nestjs/testing';
import { VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { V1AuthController } from '../src/v1/auth/auth.controller';
import { V1AuthService } from '../src/v1/auth/auth.service';
import { V1WorkspaceController } from '../src/v1/workspace/workspace.controller';
import { V1WorkspaceService } from '../src/v1/workspace/workspace.service';
import { V1FlowController } from '../src/v1/flow/flow.controller';
import { V1FlowService } from '../src/v1/flow/flow.service';
import { V1NotificationController } from '../src/v1/notification/notification.controller';
import { V1NotificationService } from '../src/v1/notification/notification.service';
import { V1PodController } from '../src/v1/pods/pod.controller';
import { V1PodService } from '../src/v1/pods/pod.service';
import { V1EdgeService } from '../src/v1/pods/edge.service';
import { V1ExecutionController } from '../src/v1/execution/execution.controller';
import { V1ExecutionService } from '../src/v1/execution/execution.service';
import { V1DocumentsController } from '../src/v1/documents/controllers/documents.controller';
import { V1DocumentsService } from '../src/v1/documents/services/documents.service';
import { V1DocumentVectorSearchService } from '../src/v1/documents/services/vector-search.service';
import { V1DocumentCostTrackingService } from '../src/v1/documents/services/cost-tracking.service';
import { V1EmbeddingsController } from '../src/v1/documents/controllers/embeddings.controller';
import { V1DocumentEmbeddingsService } from '../src/v1/documents/services/embeddings.service';
import { V1BullMQDocumentQueueService } from '../src/v1/documents/queues/bullmq-queue.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { V1DocumentFoldersController } from '../src/v1/documents/controllers/folders.controller';
import { V1DocumentFoldersService } from '../src/v1/documents/services/folders.service';
import { V1DocumentCostTrackingController } from '../src/v1/documents/controllers/cost-tracking.controller';
import { V1ModelsController } from '../src/v1/models/models.controller';
import { V1ModelsService } from '../src/v1/models/models.service';
import { V1UserController } from '../src/v1/user/user.controller';
import { V1UserService } from '../src/v1/user/user.service';
import { V1HealthController } from '../src/v1/server/health/health.controller';
import { HealthCheckService, HttpHealthIndicator } from '@nestjs/terminus';
import { PrismaHealthIndicator } from '../src/v1/server/health/prisma.health';

describe('Swagger documentation coverage (e2e)', () => {
  it('includes tags, summaries, and responses for all routes', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [
        V1AuthController,
        V1WorkspaceController,
        V1FlowController,
        V1NotificationController,
        V1PodController,
        V1ExecutionController,
        V1DocumentsController,
        V1EmbeddingsController,
        V1DocumentFoldersController,
        V1DocumentCostTrackingController,
        V1ModelsController,
        V1UserController,
        V1HealthController,
      ],
      providers: [
        { provide: V1AuthService, useValue: {} },
        { provide: V1WorkspaceService, useValue: {} },
        { provide: V1FlowService, useValue: {} },
        { provide: V1NotificationService, useValue: {} },
        { provide: V1PodService, useValue: {} },
        { provide: V1EdgeService, useValue: {} },
        { provide: V1ExecutionService, useValue: {} },
        { provide: V1DocumentsService, useValue: {} },
        { provide: V1DocumentVectorSearchService, useValue: {} },
        { provide: V1DocumentCostTrackingService, useValue: {} },
        { provide: V1DocumentEmbeddingsService, useValue: {} },
        { provide: V1BullMQDocumentQueueService, useValue: {} },
        { provide: PrismaService, useValue: {} },
        { provide: V1DocumentFoldersService, useValue: {} },
        { provide: V1ModelsService, useValue: {} },
        { provide: V1UserService, useValue: {} },
        { provide: HealthCheckService, useValue: { check: jest.fn() } },
        { provide: HttpHealthIndicator, useValue: { pingCheck: jest.fn() } },
        { provide: PrismaHealthIndicator, useValue: { isHealthy: jest.fn() } },
      ],
    }).compile();

    const app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });

    await app.init();

    const swaggerConfig = new DocumentBuilder()
      .setTitle('Flopods API v1')
      .setDescription('AI Workflow Canvas - Multi-LLM Node-Based Platform')
      .setVersion('1.0')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig, {
      deepScanRoutes: true,
    });

    const missingSummaries: string[] = [];
    const missingTags: string[] = [];
    const missingResponses: string[] = [];

    const methods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'] as const;

    Object.entries(document.paths).forEach(([path, pathItem]) => {
      methods.forEach((method) => {
        const operation = (pathItem as any)[method];
        if (!operation) return;

        const operationId = `${method.toUpperCase()} ${path}`;

        if (!operation.summary) {
          missingSummaries.push(operationId);
        }

        if (!operation.tags || operation.tags.length === 0) {
          missingTags.push(operationId);
        }

        if (!operation.responses || Object.keys(operation.responses).length === 0) {
          missingResponses.push(operationId);
        }
      });
    });

    expect(missingSummaries).toEqual([]);
    expect(missingTags).toEqual([]);
    expect(missingResponses).toEqual([]);

    await app.close();
  });
});
