/**
 * URL Document Processor Service
 *
 * @description Scrapes and extracts content from web pages.
 * Compatible with ResponseInterceptor for consistent API responses.
 *
 * @module v1/documents/processors/url-processor
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { BaseDocumentProcessor } from './base-processor.abstract';
import type { DocumentExtractedContent } from '../types';
import { DocumentSourceType } from '@flopods/schema';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * URL web scraper processor service
 */
@Injectable()
export class URLDocumentProcessor extends BaseDocumentProcessor {
  private readonly logger = new Logger(URLDocumentProcessor.name);
  private static readonly URL_REGEX = /^https?:\/\/.+/;

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  /**
   * Process URL and extract web content
   */
  async processDocument(documentId: string): Promise<DocumentExtractedContent> {
    this.logger.log(`[URL Processor] Starting: ${documentId}`);

    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        name: true,
        externalUrl: true,
      },
    });

    if (!document) {
      throw new NotFoundException(`Document not found: ${documentId}`);
    }

    if (!document.externalUrl) {
      throw new BadRequestException(`URL missing: ${documentId}`);
    }

    await this.validateDocument(undefined, document.externalUrl);

    this.logger.debug(`[URL Processor] Fetching: ${document.externalUrl}`);

    // Fetch webpage
    const response = await fetch(document.externalUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ActopodBot/1.0)',
      },
    });

    if (!response.ok) {
      throw new BadRequestException(
        `Failed to fetch URL: ${response.status} ${response.statusText}`,
      );
    }

    const html = await response.text();

    // Extract content using Cheerio
    const $ = cheerio.load(html);

    // Remove unwanted elements
    $('script, style, nav, header, footer, aside, iframe, noscript').remove();

    // Extract title
    const title = $('title').text() || $('h1').first().text() || document.name;

    // Extract main content
    let text = '';

    // Try common content selectors
    const contentSelectors = ['article', 'main', '[role="main"]', '.content', '#content', 'body'];

    for (const selector of contentSelectors) {
      const content = $(selector).first();
      if (content.length > 0) {
        text = content.text();
        break;
      }
    }

    // Fallback to body if no content found
    if (!text) {
      text = $('body').text();
    }

    // Clean up text
    text = text
      .replace(/\s+/g, ' ') // Replace multiple spaces
      .replace(/\n+/g, '\n') // Replace multiple newlines
      .trim();

    const extractedContent: DocumentExtractedContent = {
      text,
      metadata: {
        title,
        url: document.externalUrl,
        textLength: text.length,
      },
      sourceType: DocumentSourceType.URL,
    };

    this.logger.log(`[URL Processor] Completed: ${documentId} (${text.length} chars)`);

    return extractedContent;
  }

  /**
   * Validate URL format
   */
  async validateDocument(_buffer?: Buffer, url?: string): Promise<boolean> {
    if (!url) {
      throw new BadRequestException('URL is required');
    }

    if (!URLDocumentProcessor.URL_REGEX.test(url)) {
      throw new BadRequestException('Invalid URL format');
    }

    // Check if URL is reachable
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (!response.ok) {
        throw new BadRequestException(`URL not accessible: ${response.status}`);
      }
    } catch {
      throw new BadRequestException('URL is not reachable');
    }

    return true;
  }

  /**
   * Get URL metadata
   */
  async getDocumentMetadata(_buffer?: Buffer, url?: string): Promise<Record<string, any>> {
    if (!url) {
      throw new BadRequestException('URL is required');
    }

    return {
      url,
      type: 'webpage',
    };
  }
}
