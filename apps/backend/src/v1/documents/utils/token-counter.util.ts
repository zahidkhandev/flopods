/**
 * Document Token Counter Utility
 *
 * @description Provides token counting functionality for document processing using tiktoken.
 * Uses cl100k_base encoding (GPT-4, GPT-3.5-turbo compatible).
 * Caches encoder instance for performance.
 *
 * @module v1/documents/utils/token-counter
 */

import { encoding_for_model } from 'tiktoken';
import type { TiktokenModel } from 'tiktoken';

let cachedDocumentEncoder: ReturnType<typeof encoding_for_model> | null = null;

/**
 * Get cached tiktoken encoder instance for documents
 *
 * @description Returns cached encoder or creates new one.
 * Uses cl100k_base encoding for consistency.
 *
 * @returns Tiktoken encoder instance
 *
 * @example
 * ```
 * const encoder = getDocumentEncoder();
 * const tokens = encoder.encode('Hello world');
 * console.log(tokens.length); // 2
 * ```
 */
function getDocumentEncoder() {
  if (!cachedDocumentEncoder) {
    cachedDocumentEncoder = encoding_for_model('gpt-4' as TiktokenModel);
  }
  return cachedDocumentEncoder;
}

/**
 * Count tokens in document text using tiktoken
 *
 * @description Counts the number of tokens in the provided document text.
 * Uses cl100k_base encoding for accurate token counting.
 *
 * @param text - Document text to count tokens in
 * @returns Number of tokens in the text
 *
 * @throws {Error} If text is not a string
 *
 * @example
 * ```
 * const text = 'This is a sample document with multiple sentences.';
 * const tokenCount = countDocumentTokens(text);
 * console.log(tokenCount); // 9
 * ```
 */
export function countDocumentTokens(text: string): number {
  if (typeof text !== 'string') {
    throw new Error('Input must be a string');
  }

  if (text.length === 0) {
    return 0;
  }

  const encoder = getDocumentEncoder();
  const tokens = encoder.encode(text);
  return tokens.length;
}

/**
 * Free cached document encoder resources
 *
 * @description Frees the cached encoder instance.
 * Should be called when shutting down the application.
 *
 * @example
 * ```
 * // On application shutdown
 * freeDocumentEncoder();
 * ```
 */
export function freeDocumentEncoder(): void {
  if (cachedDocumentEncoder) {
    cachedDocumentEncoder.free();
    cachedDocumentEncoder = null;
  }
}
