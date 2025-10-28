/**
 * Image Document Processor Service
 *
 * @description Production-grade image OCR service with full S3 integration.
 * Compatible with ResponseInterceptor for consistent API responses.
 *
 * @module v1/documents/processors/image-processor
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { createWorker } from 'tesseract.js';
import sharp from 'sharp';
import { BaseDocumentProcessor } from './base-processor.abstract';
import type { DocumentExtractedContent } from '../types';
import { DocumentSourceType } from '@actopod/schema';
import { PrismaService } from '../../../prisma/prisma.service';
import { S3Service } from '../../../common/aws/s3/s3.service';

/**
 * Image document processor service
 *
 * @description Processes images using OCR to extract text content from S3.
 * Automatically optimizes large images before OCR processing.
 * Returns data compatible with ResponseInterceptor format.
 */
@Injectable()
export class ImageDocumentProcessor extends BaseDocumentProcessor {
  private readonly logger = new Logger(ImageDocumentProcessor.name);
  private static readonly MAX_IMAGE_SIZE_MB = 10;
  private static readonly RESIZE_DIMENSIONS = { width: 2000, height: 2000 };

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
  ) {
    super();
  }

  /**
   * Process image document and extract text via OCR
   *
   * @param documentId - Document ID from database
   * @returns Extracted content with OCR text and confidence
   * @throws {NotFoundException} If document not found
   * @throws {BadRequestException} If image is invalid or OCR fails
   */
  async processDocument(documentId: string): Promise<DocumentExtractedContent> {
    this.logger.log(`[Image Processor] Starting OCR processing: ${documentId}`);

    // Fetch document from database
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        name: true,
        storageKey: true,
        s3Bucket: true,
        mimeType: true,
        sizeInBytes: true,
      },
    });

    if (!document) {
      throw new NotFoundException(`Document not found: ${documentId}`);
    }

    if (!document.storageKey || !document.s3Bucket) {
      throw new BadRequestException(`Document storage information missing: ${documentId}`);
    }

    this.logger.debug(`[Image Processor] Downloading from S3: ${document.storageKey}`);

    // Get signed URL with 1 hour expiration
    const signedUrl = await this.s3Service.getSignedUrl(document.storageKey, 3600);

    // Download image from S3
    const response = await fetch(signedUrl);

    if (!response.ok) {
      this.logger.error(
        `[Image Processor] Download failed: ${response.status} ${response.statusText}`,
      );
      throw new BadRequestException(`Failed to download image from S3`);
    }

    const arrayBuffer = await response.arrayBuffer();
    let buffer: Buffer = Buffer.from(arrayBuffer);

    this.logger.debug(`[Image Processor] Downloaded ${buffer.length} bytes`);

    // Optimize image if needed
    buffer = await this.optimizeImage(buffer);

    // Validate image format
    await this.validateDocument(buffer);

    // Perform OCR using Tesseract.js
    this.logger.debug(`[Image Processor] Starting OCR...`);
    const worker = await createWorker('eng');

    try {
      const { data } = await worker.recognize(buffer);

      const extractedContent: DocumentExtractedContent = {
        text: data.text,
        metadata: {
          confidence: Math.round(data.confidence * 100) / 100,
          textLength: data.text.length,
          fileName: document.name,
          fileSize: document.sizeInBytes,
        },
        sourceType: DocumentSourceType.INTERNAL,
      };

      this.logger.log(
        `[Image Processor] OCR completed: ${documentId} (${data.text.length} chars, ${data.confidence.toFixed(2)}% confidence)`,
      );

      return extractedContent;
    } finally {
      await worker.terminate();
    }
  }

  /**
   * Optimize image for OCR processing
   *
   * @param buffer - Original image buffer
   * @returns Optimized image buffer
   */
  private async optimizeImage(buffer: Buffer): Promise<Buffer> {
    try {
      const sizeInMB = buffer.length / (1024 * 1024);

      if (sizeInMB > ImageDocumentProcessor.MAX_IMAGE_SIZE_MB) {
        this.logger.debug(
          `[Image Processor] Resizing large image: ${sizeInMB.toFixed(2)}MB -> target <${ImageDocumentProcessor.MAX_IMAGE_SIZE_MB}MB`,
        );

        const optimized = await sharp(buffer)
          .resize(
            ImageDocumentProcessor.RESIZE_DIMENSIONS.width,
            ImageDocumentProcessor.RESIZE_DIMENSIONS.height,
            {
              fit: 'inside',
              withoutEnlargement: true,
            },
          )
          .jpeg({ quality: 85 }) // Convert to JPEG for better compression
          .toBuffer();

        const newSizeMB = optimized.length / (1024 * 1024);
        this.logger.debug(
          `[Image Processor] Optimized: ${sizeInMB.toFixed(2)}MB -> ${newSizeMB.toFixed(2)}MB`,
        );

        return optimized;
      }

      return buffer;
    } catch {
      this.logger.warn('[Image Processor] Optimization failed, using original image');
      return buffer;
    }
  }

  /**
   * Validate image document format
   *
   * @param buffer - Image file buffer
   * @returns True if valid image
   * @throws {BadRequestException} If image is invalid
   */
  async validateDocument(buffer?: Buffer): Promise<boolean> {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('Invalid image buffer: empty or null');
    }

    try {
      const metadata = await sharp(buffer).metadata();

      if (!metadata.format) {
        throw new BadRequestException('Invalid image: unknown format');
      }

      // Check supported formats
      const supportedFormats = ['jpeg', 'jpg', 'png', 'webp', 'gif', 'bmp', 'tiff'];
      if (!supportedFormats.includes(metadata.format.toLowerCase())) {
        throw new BadRequestException(`Unsupported image format: ${metadata.format}`);
      }

      this.logger.debug(
        `[Image Processor] Validation passed: ${metadata.format}, ${metadata.width}x${metadata.height}`,
      );

      return true;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Invalid image file');
    }
  }

  /**
   * Get image metadata without OCR processing
   *
   * @param buffer - Image file buffer
   * @returns Image metadata object
   * @throws {BadRequestException} If metadata extraction fails
   */
  async getDocumentMetadata(buffer?: Buffer): Promise<Record<string, any>> {
    if (!buffer) {
      throw new BadRequestException('Buffer is required for image metadata extraction');
    }

    try {
      const metadata = await sharp(buffer).metadata();
      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: buffer.length,
        space: metadata.space,
        channels: metadata.channels,
        density: metadata.density,
      };
    } catch {
      throw new BadRequestException('Failed to extract image metadata');
    }
  }
}
