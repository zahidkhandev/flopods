/**
 * Embedding Type Definitions
 *
 * @description Type definitions for embedding generation and storage.
 * Uses Google Gemini text-embedding-004 as the platform provider.
 *
 * @module v1/documents/types/embedding
 */

/**
 * Document embedding provider information
 *
 * @description Configuration and pricing for embedding providers.
 * Used to calculate costs and select appropriate provider.
 */
export interface DocumentEmbeddingProvider {
  /** Model identifier */
  model: string;

  /** Embedding vector dimensions */
  dimensions: number;

  /** Cost per 1 million tokens in USD */
  costPer1MTokens: number;
}

/**
 * Gemini embedding provider configuration
 *
 * @description Google's Gemini text-embedding-004 model.
 * 768 dimensions, optimized for retrieval tasks.
 * This is the ONLY platform embedding provider used.
 *
 * @constant
 */
export const GEMINI_EMBEDDING_PROVIDER: DocumentEmbeddingProvider = {
  model: 'text-embedding-004',
  dimensions: 768,
  costPer1MTokens: 0.01,
};

/**
 * Document embedding generation configuration
 *
 * @description Configuration for embedding generation process.
 * Includes provider selection, API keys, and batch settings.
 */
export interface DocumentEmbeddingConfig {
  /** Selected embedding provider (Gemini) */
  provider: DocumentEmbeddingProvider;

  /** API key for Gemini (BYOK or platform key) */
  apiKey: string;

  /** Number of chunks to process per batch */
  batchSize: number;

  /** Maximum concurrent batch requests */
  concurrency: number;
}
