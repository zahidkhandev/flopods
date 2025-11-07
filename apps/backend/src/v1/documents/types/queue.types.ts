import { DocumentSourceType, LLMProvider } from '@flopods/schema';
import { DocumentProcessingAction, DocumentMessagePriority } from './document.types';

export interface DocumentQueueMessage {
  messageId?: string;
  documentId: string;
  workspaceId?: string;
  userId?: string;
  action: DocumentProcessingAction;
  priority: DocumentMessagePriority;
  metadata?: {
    fileType?: string;
    sourceType?: DocumentSourceType;
    externalUrl?: string;
    estimatedTokens?: number;
    visionProvider?: LLMProvider;
    retryCount?: number;
    extractedText?: string;
  };
  timestamp: string;
  retryCount?: number;
}

export interface DocumentQueueMetrics {
  waiting: number;
  active: number;
  completed?: number;
  failed?: number;
  delayed: number;
}

export interface DocumentProcessingJobData {
  documentId: string;
  workspaceId: string;
  userId: string;
  fileType: string;
  sourceType: string;
  externalUrl?: string;
  estimatedTokens?: number;
  visionProvider?: LLMProvider;
}
