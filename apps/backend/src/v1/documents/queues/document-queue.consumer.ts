import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import type { IDocumentQueueService } from './queue.interface';
import type { DocumentQueueMessage } from '../types';
import { V1DocumentQueueFactory } from './queue.factory';
import { V1DocumentOrchestratorService } from '../services/document-orchestrator.service';

@Injectable()
export class V1DocumentQueueConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(V1DocumentQueueConsumer.name);
  private readonly queueService: IDocumentQueueService;

  constructor(
    private readonly queueFactory: V1DocumentQueueFactory,
    private readonly orchestrator: V1DocumentOrchestratorService,
  ) {
    this.queueService = this.queueFactory.createDocumentQueue();
  }

  async onModuleInit() {
    this.logger.log('[Consumer] 🚀 Starting document queue consumer...');

    try {
      await this.queueService.startDocumentConsumer(this.handleDocumentMessage.bind(this));
      this.logger.log('[Consumer] Document queue consumer started successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[Consumer] ❌ Failed to start consumer: ${errorMessage}`);
      throw error;
    }
  }

  async onModuleDestroy() {
    this.logger.log('[Consumer] Stopping document queue consumer...');

    try {
      await this.queueService.stopDocumentConsumer();
      this.logger.log('[Consumer] Consumer stopped gracefully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[Consumer] ⚠️ Error during shutdown: ${errorMessage}`);
    }
  }

  private async handleDocumentMessage(message: DocumentQueueMessage): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.log(
        `[Consumer] 📨 Processing: ${message.documentId} (action: ${message.action})`,
      );

      // Route to orchestrator
      await this.orchestrator.processDocument(message);

      const duration = Date.now() - startTime;
      this.logger.log(`[Consumer] Success: ${message.documentId} (${duration}ms)`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const duration = Date.now() - startTime;

      this.logger.error(
        `[Consumer] ❌ Failed: ${message.documentId} (${duration}ms) - ${errorMessage}`,
      );

      // Don't fail on quota - let embeddings service handle retry
      if (errorMessage.includes('429') || errorMessage.includes('quota')) {
        this.logger.warn(`[Consumer] ⏰ Quota exceeded - Will retry with backoff`);
        return;
      }

      throw error;
    }
  }

  async getDocumentQueueMetrics() {
    return this.queueService.getDocumentQueueMetrics();
  }
}
