// src/modules/v1/documents/types/processor.types.ts

import { DocumentSourceType } from '@flopods/schema';

export interface DocumentProcessorConfig {
  maxFileSize: number;
  supportedMimeTypes: string[];
  chunkSize: number;
  chunkOverlap: number;
}

export interface DocumentExtractedContent {
  text: string;
  metadata: Record<string, any>;
  sourceType: DocumentSourceType;
}

export interface DocumentTextChunk {
  index: number;
  text: string;
  tokenCount: number;
  startChar: number;
  endChar: number;
  metadata?: Record<string, any>;
}
