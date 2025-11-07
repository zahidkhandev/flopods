import { Injectable, Logger } from '@nestjs/common';
import { V1YouTubeTranscriptExtractor } from '../helpers/youtube-transcript-extractor';
import { YouTubeTranscriptResult, YouTubeExtractionOptions } from '../types/youtube.types';
import { V1YouTubeURLParser } from '../utils';

@Injectable()
export class V1YouTubeProcessorService {
  private readonly logger = new Logger(V1YouTubeProcessorService.name);

  constructor(private extractor: V1YouTubeTranscriptExtractor) {
    this.logger.log('[Processor] ✅ YouTube Processor initialized');
  }

  async processYouTubeURL(
    videoUrl: string,
    options?: YouTubeExtractionOptions,
  ): Promise<YouTubeTranscriptResult> {
    this.logger.debug(`[Processor] 📥 Processing URL: ${videoUrl}`);

    const videoId = V1YouTubeURLParser.extractVideoId(videoUrl);
    this.logger.debug(`[Processor] 📝 Extracted video ID: ${videoId}`);

    const result = await this.extractor.extractTranscript(null, videoId, options);

    this.logger.log(
      `[Processor] ✅ Successfully extracted: ${result.videoTitle} (${result.characterCount} chars)`,
    );

    return result;
  }

  async healthCheck(): Promise<{ status: string; message: string }> {
    return {
      status: 'healthy',
      message: '✅ YouTube Transcript Service ready',
    };
  }
}
