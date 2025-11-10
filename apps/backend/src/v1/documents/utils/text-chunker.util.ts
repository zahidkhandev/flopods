// /src/modules/v1/documents/utils/text-chunker.util.ts

import { countDocumentTokens } from './token-counter.util';
import type { DocumentTextChunk } from '../types';

export interface DocumentChunkConfig {
  maxTokens: number;
  overlapTokens: number;
  minTokens: number;
}

export const DEFAULT_DOCUMENT_CHUNK_CONFIG: DocumentChunkConfig = {
  maxTokens: 512,
  overlapTokens: 50,
  minTokens: 50,
};

const DOCUMENT_TEXT_SEPARATORS = ['\n\n', '\n', '. ', '! ', '? ', '; ', ', ', ' '];

export function chunkDocumentText(
  text: string,
  config: DocumentChunkConfig = DEFAULT_DOCUMENT_CHUNK_CONFIG,
): DocumentTextChunk[] {
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Text must be a non-empty string');
  }

  const chunks: DocumentTextChunk[] = [];
  const totalTokens = countDocumentTokens(text);

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

  let chunkIndex = 0;
  let currentPosition = 0;

  while (currentPosition < text.length) {
    const chunkEnd = findDocumentChunkEnd(text, currentPosition, config.maxTokens);
    const chunkText = text.substring(currentPosition, chunkEnd).trim();
    const tokenCount = countDocumentTokens(chunkText);

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

    const overlapStart = Math.max(
      0,
      chunkEnd - calculateDocumentOverlapChars(text, chunkEnd, config.overlapTokens),
    );

    currentPosition = overlapStart > currentPosition ? overlapStart : chunkEnd;

    if (currentPosition >= text.length) {
      break;
    }
  }

  return chunks;
}

function findDocumentChunkEnd(text: string, start: number, maxTokens: number): number {
  let end = text.length;
  let left = start;
  let right = end;

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

  const boundary = findDocumentSemanticBoundary(text, start, end);
  if (boundary > start) {
    return boundary;
  }

  return end;
}

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

function calculateDocumentOverlapChars(
  text: string,
  position: number,
  overlapTokens: number,
): number {
  if (overlapTokens === 0) return 0;

  let left = 0;
  let right = Math.min(position, 500);
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
