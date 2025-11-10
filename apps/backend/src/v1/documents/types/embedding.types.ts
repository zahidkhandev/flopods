// src/modules/v1/documents/types/embedding.types.ts

export interface DocumentEmbeddingProvider {
  model: string;
  dimensions: number;
  costPer1MTokens: number;
}

export interface DocumentEmbeddingConfig {
  provider: DocumentEmbeddingProvider;
  apiKey: string;
  batchSize: number;
  concurrency: number;
  isPlatformKey?: boolean;
}

export interface DocumentEmbeddingResult {
  chunkIndex: number;
  embedding: number[];
  model: string;
  dimension: number;
}
