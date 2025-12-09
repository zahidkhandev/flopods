/**
 * Document Queue Services Barrel Export
 *
 * @description Centralized export for all document queue services.
 *
 * @module v1/documents/queues
 */

export { IDocumentQueueService } from './queue.interface';
export { V1BullMQDocumentQueueService } from './bullmq-queue.service';
export { V1SQSDocumentQueueService } from './sqs-queue.service';
export { V1DocumentQueueFactory } from './queue.factory';
export { V1DocumentQueueProducer } from './document-queue.producer';
export { V1DocumentQueueConsumer } from './document-queue.consumer';
