import { Injectable, Logger } from '@nestjs/common';
import { getSubtitles, getVideoDetails, Subtitle } from 'youtube-caption-extractor';
import { YouTubeTranscriptResult, YouTubeExtractionOptions } from '../types/youtube.types';

@Injectable()
export class V1YouTubeTranscriptExtractor {
  private readonly logger = new Logger(V1YouTubeTranscriptExtractor.name);

  constructor() {
    this.logger.log(
      '[Extractor] ✅ YouTube Extractor initialized (using youtube-caption-extractor v1.9.1)',
    );
  }

  async extractTranscript(
    _youtube: any,
    videoId: string,
    options: YouTubeExtractionOptions = {},
  ): Promise<YouTubeTranscriptResult> {
    const startTime = Date.now();

    this.logger.debug(`[Extractor] 🎬 Starting extraction: ${videoId}`);

    try {
      // Validate video ID format
      if (!this.isValidVideoId(videoId)) {
        throw new Error(`Invalid video ID format: ${videoId}`);
      }

      const lang = options?.preferredLanguage || 'en';
      const maxRetries = options?.maxRetries || 3;

      this.logger.debug(
        `[Extractor] 📦 Fetching subtitles - Language: ${lang}, Retries: ${maxRetries}`,
      );

      let subtitles: Subtitle[] = [];

      // Retry logic for network resilience
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          subtitles = await getSubtitles({
            videoID: videoId,
            lang: lang,
          });

          if (subtitles && subtitles.length > 0) {
            this.logger.debug(`[Extractor] ✅ Captions fetched on attempt ${attempt}`);
            break;
          }
        } catch (error) {
          this.logger.debug(
            `[Extractor] ⚠️ Attempt ${attempt}/${maxRetries} failed: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`,
          );

          if (attempt < maxRetries) {
            await this.delay(1000 * attempt);
          }
        }
      }

      // Handle case where no subtitles were found
      if (!subtitles || subtitles.length === 0) {
        this.logger.warn(`[Extractor] ⚠️ No subtitles found for video: ${videoId}`);

        return {
          videoId,
          videoTitle: `YouTube Video ${videoId}`,
          transcript: '[No captions available for this video]',
          language: lang,
          captionType: 'none',
          characterCount: 0,
          captionEventCount: 0,
          extractedAt: new Date(),
          hasTranscript: false,
          source: 'no_captions',
        };
      }

      // Format subtitles into readable text
      const transcript = this.formatSubtitles(subtitles);
      const duration = Date.now() - startTime;

      this.logger.log(
        `[Extractor] ✅ Extraction complete (${duration}ms): ${subtitles.length} captions, ${transcript.length} chars`,
      );

      return {
        videoId,
        videoTitle: `YouTube Video ${videoId}`,
        transcript,
        language: lang,
        captionType: 'manual',
        characterCount: transcript.length,
        captionEventCount: subtitles.length,
        extractedAt: new Date(),
        hasTranscript: true,
        source: 'subtitles',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const duration = Date.now() - startTime;

      this.logger.error(`[Extractor] ❌ Extraction failed (${duration}ms): ${errorMessage}`);

      // Return graceful fallback instead of throwing
      return {
        videoId,
        videoTitle: `YouTube Video ${videoId}`,
        transcript: '[Failed to extract captions - video may have no subtitles available]',
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
   * Get comprehensive video details including title and description
   */
  async getVideoDetails(
    videoId: string,
    lang: string = 'en',
  ): Promise<{
    title: string;
    description: string;
    subtitleCount: number;
    success: boolean;
  }> {
    try {
      this.logger.debug(`[Extractor] 📹 Fetching video details: ${videoId}`);

      if (!this.isValidVideoId(videoId)) {
        throw new Error(`Invalid video ID format: ${videoId}`);
      }

      const videoDetails = await getVideoDetails({
        videoID: videoId,
        lang: lang,
      });

      this.logger.log(`[Extractor] ✅ Video details fetched: ${videoDetails.title || 'Unknown'}`);

      return {
        title: videoDetails.title || `YouTube Video ${videoId}`,
        description: videoDetails.description || '',
        subtitleCount: videoDetails.subtitles?.length || 0,
        success: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`[Extractor] ⚠️ Failed to fetch video details: ${errorMessage}`);

      return {
        title: `YouTube Video ${videoId}`,
        description: '',
        subtitleCount: 0,
        success: false,
      };
    }
  }

  /**
   * Health check endpoint
   */
  async healthCheck(): Promise<{ status: string; message: string }> {
    return {
      status: 'healthy',
      message: '✅ YouTube Transcript Service (youtube-caption-extractor v1.9.1) ready',
    };
  }

  /**
   * Format subtitles array into readable transcript
   */
  private formatSubtitles(subtitles: Subtitle[]): string {
    return subtitles
      .map((subtitle) => subtitle.text || '')
      .filter((text) => text.trim().length > 0)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Validate YouTube video ID format
   */
  private isValidVideoId(videoId: string): boolean {
    return /^[a-zA-Z0-9_-]{11}$/.test(videoId);
  }

  /**
   * Utility delay function for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
