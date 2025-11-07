import { Injectable, Logger } from '@nestjs/common';
import { V1YouTubeTranscriptExtractor } from '../helpers/youtube-transcript-extractor';
import { YouTubeTranscriptResult, YouTubeExtractionOptions } from '../types/youtube.types';
import { V1YouTubeURLParser } from '../utils';

@Injectable()
export class V1YouTubeProcessorService {
  private readonly logger = new Logger(V1YouTubeProcessorService.name);

  constructor(private readonly extractor: V1YouTubeTranscriptExtractor) {
    this.logger.log('[Processor] ✅ YouTube Processor initialized');
  }

  /**
   * Process YouTube URL and extract transcript
   */
  async processYouTubeURL(
    videoUrl: string,
    options?: YouTubeExtractionOptions,
  ): Promise<YouTubeTranscriptResult> {
    this.logger.debug(`[Processor] 📥 Processing URL: ${videoUrl}`);

    try {
      const videoId = V1YouTubeURLParser.extractVideoId(videoUrl);
      this.logger.debug(`[Processor] 📝 Extracted video ID: ${videoId}`);

      const result = await this.extractor.extractTranscript(null, videoId, options);

      if (result.hasTranscript) {
        this.logger.log(
          `[Processor] ✅ Successfully extracted: ${result.videoTitle} (${result.characterCount} chars)`,
        );
      } else {
        this.logger.warn(`[Processor] ⚠️ No transcript available: ${result.videoTitle}`);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[Processor] ❌ URL processing failed: ${errorMessage}`);

      // Return error result instead of throwing
      return {
        videoId: 'unknown',
        videoTitle: 'YouTube Video (Error)',
        transcript: `[Failed to process URL: ${errorMessage}]`,
        language: options?.preferredLanguage || 'en',
        captionType: 'none',
        characterCount: 0,
        captionEventCount: 0,
        extractedAt: new Date(),
        hasTranscript: false,
        error: errorMessage,
        source: 'error',
      };
    }
  }

  /**
   * Get video details without extracting transcript
   */
  async getVideoDetails(videoId: string, lang: string = 'en') {
    return this.extractor.getVideoDetails(videoId, lang);
  }

  /**
   * Health check endpoint
   */
  async healthCheck(): Promise<{ status: string; message: string }> {
    return {
      status: 'healthy',
      message: '✅ YouTube Transcript Service ready',
    };
  }
}
