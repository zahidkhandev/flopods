export interface YouTubeVideoInfo {
  videoId: string;
  title: string;
  description: string;
  channel: string;
  publishedAt: string;
  duration: string;
  viewCount: number;
  likeCount?: number;
  commentCount?: number;
}

export interface YouTubeCaption {
  id: string;
  language: string;
  trackKind: 'standard' | 'asr' | 'forced';
  name: string;
  isDefault: boolean;
  isAutoSynced: boolean;
  isCC: boolean;
}

export interface YouTubeCaptionEvent {
  tStart?: number;
  dur?: number;
  segs?: Array<{
    utf8: string;
  }>;
}

export interface YouTubeTranscriptResult {
  videoId: string;
  videoTitle: string;
  transcript: string;
  language: string;
  captionType: 'manual' | 'auto-generated' | 'metadata-fallback';
  characterCount: number;
  captionEventCount: number;
  extractedAt: Date;
}

export interface YouTubeExtractionOptions {
  preferredLanguage?: string;
  includeMetadata?: boolean;
  maxRetries?: number;
  timeoutMs?: number;
}

export enum YouTubeExtractionStatus {
  SUCCESS = 'SUCCESS',
  PARTIAL_SUCCESS = 'PARTIAL_SUCCESS',
  METADATA_FALLBACK = 'METADATA_FALLBACK',
  FAILED = 'FAILED',
}

export interface YouTubeExtractionMetadata {
  status: YouTubeExtractionStatus;
  captions: YouTubeCaption[];
  selectedCaption?: YouTubeCaption;
  extractionMethod: 'manual' | 'auto' | 'metadata';
  errorMessage?: string;
  retryCount: number;
  processingTimeMs: number;
}
