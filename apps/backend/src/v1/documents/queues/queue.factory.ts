/**
 * Document Queue Factory
 *
 * @description Factory service to create appropriate queue implementation
 * based on environment configuration (BullMQ for dev, SQS for production).
 *
 * @module v1/documents/queues/queue-factory
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IDocumentQueueService } from './queue.interface';
import { V1BullMQDocumentQueueService } from './bullmq-queue.service';
import { V1SQSDocumentQueueService } from './sqs-queue.service';

/**
 * Factory for creating document queue service instances
 *
 * @description Creates the appropriate queue service based on the
 * QUEUE_BACKEND environment variable. Returns BullMQ for 'redis'
 * or SQS for 'sqs'.
 *
 * @example
 * ```
 * // In documents.module.ts
 * {
 *   provide: 'DOCUMENT_QUEUE_SERVICE',
 *   useFactory: (factory: DocumentQueueFactory) => factory.createDocumentQueue(),
 *   inject: [DocumentQueueFactory],
 * }
 * ```
 */
@Injectable()
export class V1DocumentQueueFactory {
  private readonly logger = new Logger(V1DocumentQueueFactory.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly bullMQService: V1BullMQDocumentQueueService,
    private readonly sqsService: V1SQSDocumentQueueService,
  ) {}

  /**
   * Create document queue service based on environment configuration
   *
   * @description Selects queue implementation based on QUEUE_BACKEND env var.
   * - 'redis' -> BullMQ (local development)
   * - 'sqs' -> AWS SQS (production)
   *
   * @returns Document queue service instance
   *
   * @throws {Error} If QUEUE_BACKEND is not set or invalid
   *
   * @example
   * ```
   * const queue = factory.createDocumentQueue();
   * await queue.sendDocumentMessage(message);
   * ```
   */
  createDocumentQueue(): IDocumentQueueService {
    const backend = this.configService.get<string>('QUEUE_BACKEND');

    if (!backend) {
      throw new Error('QUEUE_BACKEND environment variable is not set');
    }

    switch (backend.toLowerCase()) {
      case 'redis':
        this.logger.log('Using BullMQ Document Queue (Redis)');
        return this.bullMQService;

      case 'sqs':
        this.logger.log('Using SQS Document Queue');
        return this.sqsService;

      default:
        throw new Error(`Invalid QUEUE_BACKEND: ${backend}. Must be 'redis' or 'sqs'`);
    }
  }
}
