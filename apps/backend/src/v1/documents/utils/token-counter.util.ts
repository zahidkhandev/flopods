// /src/modules/v1/documents/utils/token-counter.util.ts

import { encoding_for_model } from 'tiktoken';
import type { TiktokenModel } from 'tiktoken';

let cachedDocumentEncoder: ReturnType<typeof encoding_for_model> | null = null;

export function getDocumentEncoder() {
  if (!cachedDocumentEncoder) {
    cachedDocumentEncoder = encoding_for_model('gpt-4' as TiktokenModel);
  }
  return cachedDocumentEncoder;
}

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

export function freeDocumentEncoder(): void {
  if (cachedDocumentEncoder) {
    cachedDocumentEncoder.free();
    cachedDocumentEncoder = null;
  }
}
