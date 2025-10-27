/**
 * YouTube Document Processor Service
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { YoutubeTranscript } from 'youtube-transcript';
import { BaseDocumentProcessor } from './base-processor.abstract';
import type { DocumentExtractedContent } from '../types';
import { DocumentSourceType } from '@actopod/schema';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class YouTubeDocumentProcessor extends BaseDocumentProcessor {
  private readonly logger = new Logger(YouTubeDocumentProcessor.name);
  private static readonly YOUTUBE_URL_REGEX =
    /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/;

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async processDocument(documentId: string): Promise<DocumentExtractedContent> {
    this.logger.log(`[YouTube Processor] Starting: ${documentId}`);

    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        name: true,
        externalUrl: true,
        metadata: true,
      },
    });

    if (!document) {
      throw new NotFoundException(`Document not found: ${documentId}`);
    }

    if (!document.externalUrl) {
      throw new BadRequestException(`YouTube URL missing: ${documentId}`);
    }

    const videoId = this.extractVideoId(document.externalUrl);
    if (!videoId) {
      throw new BadRequestException(`Invalid YouTube URL: ${document.externalUrl}`);
    }

    this.logger.debug(`[YouTube Processor] Fetching transcript for: ${videoId}`);

    const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);

    if (!transcriptItems || transcriptItems.length === 0) {
      throw new BadRequestException(`No transcript available for video: ${videoId}`);
    }

    const text = transcriptItems.map((item) => item.text).join(' ');

    const extractedContent: DocumentExtractedContent = {
      text,
      metadata: {
        videoId,
        duration: transcriptItems[transcriptItems.length - 1]?.offset || 0,
        segmentCount: transcriptItems.length,
        url: document.externalUrl,
      },
      sourceType: DocumentSourceType.YOUTUBE,
    };

    this.logger.log(
      `[YouTube Processor] Completed: ${documentId} (${text.length} chars, ${transcriptItems.length} segments)`,
    );

    return extractedContent;
  }

  private extractVideoId(url: string): string | null {
    const match = url.match(YouTubeDocumentProcessor.YOUTUBE_URL_REGEX);
    return match ? match[1] : null;
  }

  async validateDocument(_buffer?: Buffer, url?: string): Promise<boolean> {
    if (!url) {
      throw new BadRequestException('YouTube URL is required');
    }

    const videoId = this.extractVideoId(url);
    if (!videoId) {
      throw new BadRequestException('Invalid YouTube URL format');
    }

    return true;
  }

  async getDocumentMetadata(_buffer?: Buffer, url?: string): Promise<Record<string, any>> {
    if (!url) {
      throw new BadRequestException('YouTube URL is required');
    }

    const videoId = this.extractVideoId(url);
    return {
      videoId,
      url,
      platform: 'YouTube',
    };
  }
}
