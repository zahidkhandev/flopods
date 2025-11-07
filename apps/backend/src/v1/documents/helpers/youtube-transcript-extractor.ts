import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { YoutubeTranscript } from 'youtube-transcript';
import { YouTubeTranscriptResult, YouTubeExtractionOptions } from '../types/youtube.types';
import { createHttpClient } from '../../../common/config/http-client';

interface Caption {
  text: string;
  start: string;
  dur: string;
}

@Injectable()
export class V1YouTubeTranscriptExtractor {
  private readonly logger = new Logger(V1YouTubeTranscriptExtractor.name);
  private readonly httpClient: AxiosInstance;

  constructor() {
    this.httpClient = createHttpClient();
  }

  async extractTranscript(
    _youtube: any,
    videoId: string,
    options: YouTubeExtractionOptions = {},
  ): Promise<YouTubeTranscriptResult> {
    const startTime = Date.now();

    this.logger.debug(`[Extractor] 🎬 Starting extraction: ${videoId}`);

    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.debug(
          `[Extractor] 🔍 Fetching transcript (attempt ${attempt}/${maxRetries}): ${videoId}`,
        );

        // Try timedtext API first (fastest)
        const transcript = await this.fetchGoogleTimedText(videoId, options).catch((error) => {
          this.logger.warn(
            `[Extractor] ⚠️ Timedtext API failed: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`,
          );
          return null;
        });

        if (transcript) {
          const duration = Date.now() - startTime;
          this.logger.log(
            `[Extractor] ✅ Extraction complete (${duration}ms): ${transcript.length} chars`,
          );

          return {
            videoId,
            videoTitle: `YouTube Video ${videoId}`,
            transcript,
            language: options?.preferredLanguage || 'en',
            captionType: 'manual',
            characterCount: transcript.length,
            captionEventCount: transcript.split('\n').length,
            extractedAt: new Date(),
          };
        }

        // Fallback to youtube-transcript package
        this.logger.debug(`[Extractor] 🔄 Falling back to youtube-transcript package...`);

        const fallbackTranscript = await this.fetchUsingYoutubeTranscript(videoId, options);

        const duration = Date.now() - startTime;
        this.logger.log(
          `[Extractor] ✅ Extraction complete (${duration}ms): ${fallbackTranscript.length} chars`,
        );

        return {
          videoId,
          videoTitle: `YouTube Video ${videoId}`,
          transcript: fallbackTranscript,
          language: options?.preferredLanguage || 'en',
          captionType: 'manual',
          characterCount: fallbackTranscript.length,
          captionEventCount: fallbackTranscript.split('\n').length,
          extractedAt: new Date(),
        };
      } catch (error) {
        lastError = error;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        this.logger.warn(`[Extractor] ⚠️ Attempt ${attempt} failed: ${errorMessage}. Retrying...`);

        if (attempt < maxRetries) {
          await this.delay(1000 * attempt);
        }
      }
    }

    const duration = Date.now() - startTime;
    const errorMessage = lastError instanceof Error ? lastError.message : 'Unknown error';

    this.logger.error(
      `[Extractor] ❌ Failed (${duration}ms) after ${maxRetries} retries: ${errorMessage}`,
    );

    throw lastError;
  }

  private async fetchUsingYoutubeTranscript(
    videoId: string,
    options: YouTubeExtractionOptions,
  ): Promise<string> {
    try {
      this.logger.debug(`[Extractor] 📦 Using youtube-transcript package...`);

      const transcriptData = await YoutubeTranscript.fetchTranscript(videoId, {
        lang: options?.preferredLanguage || 'en',
      });

      if (!Array.isArray(transcriptData) || transcriptData.length === 0) {
        throw new Error('youtube-transcript returned empty array');
      }

      const text = transcriptData
        .map((item: any) => item.text || '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      this.logger.log(
        `[Extractor] ✅ youtube-transcript: ${transcriptData.length} items, ${text.length} chars`,
      );

      return text;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`youtube-transcript failed: ${errorMessage}`);
    }
  }

  private async fetchGoogleTimedText(
    videoId: string,
    options: YouTubeExtractionOptions,
  ): Promise<string> {
    const lang = options?.preferredLanguage || 'en';

    this.logger.debug(`[Extractor] 🌐 Trying Google timedtext API...`);

    // TIER 1: Manual captions
    try {
      const manualUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}`;
      this.logger.debug(`[Extractor] 📡 Requesting: ${manualUrl.substring(0, 80)}...`);

      const response = await this.httpClient.get(manualUrl, {
        timeout: 10000,
      });

      const captions = this.parseXmlCaptions(response.data);

      if (captions.length > 0) {
        this.logger.log(`[Extractor] ✅ Manual captions: ${captions.length} items`);
        return this.formatCaptions(captions);
      }
    } catch (error) {
      this.logger.debug(
        `[Extractor] ⚠️ Manual captions failed: ${
          error instanceof Error ? error.message : 'Unknown'
        }`,
      );
    }

    // TIER 2: Auto-generated (ASR)
    try {
      const asrUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&track=asr`;
      this.logger.debug(`[Extractor] 📡 Requesting ASR: ${asrUrl.substring(0, 80)}...`);

      const response = await this.httpClient.get(asrUrl, {
        timeout: 10000,
      });

      const captions = this.parseXmlCaptions(response.data);

      if (captions.length > 0) {
        this.logger.log(`[Extractor] ✅ Auto-generated captions: ${captions.length} items`);
        return this.formatCaptions(captions);
      }
    } catch (error) {
      this.logger.debug(
        `[Extractor] ⚠️ Auto captions failed: ${
          error instanceof Error ? error.message : 'Unknown'
        }`,
      );
    }

    throw new Error(`No captions found via timedtext API for ${videoId} in language ${lang}`);
  }

  private parseXmlCaptions(xmlData: string): Caption[] {
    const captions: Caption[] = [];

    const regex = /<text[^>]*start="([^"]*)"[^>]*dur="([^"]*)"[^>]*>([^<]*)<\/text>/g;
    let match;

    while ((match = regex.exec(xmlData)) !== null) {
      captions.push({
        start: match[1],
        dur: match[2],
        text: this.decodeHtml(match[3]),
      });
    }

    return captions;
  }

  private formatCaptions(captions: Caption[]): string {
    return captions
      .map((c) => c.text)
      .join(' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private decodeHtml(html: string): string {
    return html
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"');
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
