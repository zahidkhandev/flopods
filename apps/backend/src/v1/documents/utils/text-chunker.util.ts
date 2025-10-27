/**
 * Document Text Chunker Utility
 *
 * @description Splits document text into chunks for embedding generation.
 * Uses smart chunking with token-based splitting and overlap.
 * Preserves sentence boundaries for better semantic coherence.
 *
 * @module v1/documents/utils/text-chunker
 */

import { countDocumentTokens } from './token-counter.util';
import type { DocumentTextChunk } from '../types';

/**
 * Document text chunking configuration
 */
export interface DocumentChunkConfig {
  /** Maximum tokens per chunk */
  maxTokens: number;

  /** Token overlap between consecutive chunks */
  overlapTokens: number;

  /** Minimum chunk size in tokens (discard smaller chunks) */
  minTokens: number;
}

/**
 * Default document chunking configuration
 *
 * @description Optimized for Gemini text-embedding-004.
 * - 512 tokens: Good balance between context and granularity
 * - 50 overlap: Maintains context across chunks
 * - 50 min: Discards very small chunks
 */
export const DEFAULT_DOCUMENT_CHUNK_CONFIG: DocumentChunkConfig = {
  maxTokens: 512,
  overlapTokens: 50,
  minTokens: 50,
};

/**
 * Document text separators in priority order
 *
 * @description Splits text while preserving semantic boundaries.
 * Tries to split at paragraph/sentence boundaries first.
 */
const DOCUMENT_TEXT_SEPARATORS = [
  '\n\n', // Paragraphs
  '\n', // Lines
  '. ', // Sentences (period + space)
  '! ', // Exclamations
  '? ', // Questions
  '; ', // Semi-colons
  ', ', // Commas
  ' ', // Words
];

/**
 * Split document text into chunks with token-aware overlap
 *
 * @description Intelligently splits text into chunks suitable for embedding.
 * - Respects token limits (512 tokens per chunk)
 * - Maintains overlap between chunks (50 tokens)
 * - Preserves sentence boundaries
 * - Tracks chunk position in original document
 *
 * @param text - Full document text to chunk
 * @param config - Chunking configuration (optional)
 * @returns Array of text chunks with metadata
 *
 * @throws {Error} If text is empty or not a string
 *
 * @example
 * ```
 * const text = 'Long document text here...';
 * const chunks = chunkDocumentText(text);
 *
 * console.log(chunks);
 * // {
 * //   index: 0,
 * //   text: 'First chunk text...',
 * //   tokenCount: 480,
 * //   startChar: 0,
 * //   endChar: 2048
 * // }
 * ```
 */
export function chunkDocumentText(
  text: string,
  config: DocumentChunkConfig = DEFAULT_DOCUMENT_CHUNK_CONFIG,
): DocumentTextChunk[] {
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Text must be a non-empty string');
  }

  const chunks: DocumentTextChunk[] = [];
  const totalTokens = countDocumentTokens(text);

  // If text is smaller than max chunk size, return as single chunk
  if (totalTokens <= config.maxTokens) {
    return [
      {
        index: 0,
        text: text.trim(),
        tokenCount: totalTokens,
        startChar: 0,
        endChar: text.length,
      },
    ];
  }

  // Split text into chunks
  let chunkIndex = 0;
  let currentPosition = 0;

  while (currentPosition < text.length) {
    // Find the end of the current chunk
    const chunkEnd = findDocumentChunkEnd(text, currentPosition, config.maxTokens);

    const chunkText = text.substring(currentPosition, chunkEnd).trim();
    const tokenCount = countDocumentTokens(chunkText);

    // Only add chunk if it meets minimum token requirement
    if (tokenCount >= config.minTokens) {
      chunks.push({
        index: chunkIndex,
        text: chunkText,
        tokenCount,
        startChar: currentPosition,
        endChar: chunkEnd,
      });
      chunkIndex++;
    }

    // Calculate overlap for next chunk
    const overlapStart = Math.max(
      0,
      chunkEnd - calculateDocumentOverlapChars(text, chunkEnd, config.overlapTokens),
    );

    currentPosition = overlapStart > currentPosition ? overlapStart : chunkEnd;

    // Prevent infinite loop
    if (currentPosition >= text.length) {
      break;
    }
  }

  return chunks;
}

/**
 * Find optimal end position for current document chunk
 *
 * @description Finds the best position to split text while:
 * - Staying within token limit
 * - Preserving semantic boundaries (sentences, paragraphs)
 *
 * @param text - Full text being chunked
 * @param start - Starting position in text
 * @param maxTokens - Maximum tokens allowed in chunk
 * @returns Character position to end chunk
 */
function findDocumentChunkEnd(text: string, start: number, maxTokens: number): number {
  let end = text.length;
  let left = start;
  let right = end;

  // Binary search for optimal chunk size
  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    const chunkText = text.substring(start, mid);
    const tokens = countDocumentTokens(chunkText);

    if (tokens <= maxTokens) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }

  end = Math.max(start + 1, left - 1);

  // Try to split at semantic boundary
  const boundary = findDocumentSemanticBoundary(text, start, end);
  if (boundary > start) {
    return boundary;
  }

  return end;
}

/**
 * Find nearest semantic boundary in document (sentence, paragraph)
 *
 * @description Searches backward from end position to find
 * the nearest separator (period, newline, etc.)
 *
 * @param text - Full text
 * @param start - Chunk start position
 * @param end - Chunk end position
 * @returns Position of nearest separator, or end if none found
 */
function findDocumentSemanticBoundary(text: string, start: number, end: number): number {
  const searchText = text.substring(start, end);

  for (const separator of DOCUMENT_TEXT_SEPARATORS) {
    const lastIndex = searchText.lastIndexOf(separator);
    if (lastIndex > 0) {
      return start + lastIndex + separator.length;
    }
  }

  return end;
}

/**
 * Calculate character count for document overlap tokens
 *
 * @description Estimates how many characters correspond to
 * the desired overlap in tokens. Uses binary search.
 *
 * @param text - Full text
 * @param position - Current position in text
 * @param overlapTokens - Desired token overlap
 * @returns Character count for overlap
 */
function calculateDocumentOverlapChars(
  text: string,
  position: number,
  overlapTokens: number,
): number {
  if (overlapTokens === 0) return 0;

  let left = 0;
  let right = Math.min(position, 500); // Max 500 chars lookback
  let bestMatch = 0;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const overlapText = text.substring(position - mid, position);
    const tokens = countDocumentTokens(overlapText);

    if (tokens <= overlapTokens) {
      bestMatch = mid;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return bestMatch;
}
