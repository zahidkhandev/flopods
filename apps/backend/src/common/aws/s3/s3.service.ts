import {
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface UploadOptions {
  key: string;
  body: Buffer;
  contentType?: string;
  metadata?: Record<string, string>;
  acl?: 'private' | 'public-read' | 'public-read-write';
}

export interface ListObjectsOptions {
  prefix?: string;
  maxKeys?: number;
  continuationToken?: string;
}

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3Client: S3Client | null = null;
  private readonly bucketName: string;
  private readonly isEnabled: boolean;
  private readonly region: string;

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION') || 'us-east-1';
    const accessKeyId = this.configService.get<string>('AWS_S3_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_S3_SECRET_ACCESS_KEY');
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME') || '';

    this.isEnabled = !!(this.region && accessKeyId && secretAccessKey && this.bucketName);

    if (this.isEnabled && accessKeyId && secretAccessKey) {
      this.s3Client = new S3Client({
        region: this.region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
        maxAttempts: 3,
      });
      this.logger.log('✅ AWS S3 initialized successfully');
    } else {
      this.logger.warn('⚠️  AWS S3 not configured');
    }
  }

  /**
   * Upload file to S3
   */
  async uploadFile(options: UploadOptions): Promise<string> {
    if (!this.isEnabled || !this.s3Client) {
      throw new InternalServerErrorException('S3 not configured');
    }

    const { key, body, contentType, metadata, acl } = options;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
        Metadata: metadata,
        ACL: acl || 'private',
      });

      await this.s3Client.send(command);
      this.logger.log(`📁 File uploaded to S3: ${key}`);

      return acl === 'public-read'
        ? `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`
        : key;
    } catch (error: any) {
      this.logger.error('❌ S3 upload error:', error);
      throw new InternalServerErrorException(`Failed to upload file: ${error.message}`);
    }
  }

  /**
   * Get signed URL for secure file access
   */
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    if (!this.isEnabled || !this.s3Client) {
      throw new InternalServerErrorException('S3 not configured');
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      // Type assertion to fix AWS SDK version mismatch
      const url = await getSignedUrl(this.s3Client as any, command as any, { expiresIn });
      this.logger.log(`🔗 Generated signed URL for: ${key} (expires in ${expiresIn}s)`);
      return url;
    } catch (error: any) {
      this.logger.error('❌ S3 get signed URL error:', error);
      throw new InternalServerErrorException(`Failed to generate signed URL: ${error.message}`);
    }
  }

  /**
   * Get signed URL for file upload (client-side upload)
   */

  async getUploadSignedUrl(
    key: string,
    contentType: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    if (!this.isEnabled || !this.s3Client) {
      throw new InternalServerErrorException('S3 not configured');
    }

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: contentType,
      });

      // Type assertion to fix AWS SDK version mismatch
      const url = await getSignedUrl(this.s3Client as any, command as any, { expiresIn });
      this.logger.log(`🔗 Generated upload signed URL for: ${key}`);
      return url;
    } catch (error: any) {
      this.logger.error('❌ S3 get upload signed URL error:', error);
      throw new InternalServerErrorException(`Failed to generate upload URL: ${error.message}`);
    }
  }

  /**
   * Delete single file
   */
  async deleteFile(key: string): Promise<void> {
    if (!this.isEnabled || !this.s3Client) {
      throw new InternalServerErrorException('S3 not configured');
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      this.logger.log(`🗑️  File deleted from S3: ${key}`);
    } catch (error: any) {
      this.logger.error('❌ S3 delete error:', error);
      throw new InternalServerErrorException(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * Delete multiple files
   */
  async deleteFiles(keys: string[]): Promise<void> {
    if (!this.isEnabled || !this.s3Client) {
      throw new InternalServerErrorException('S3 not configured');
    }

    if (keys.length === 0) return;

    try {
      const command = new DeleteObjectsCommand({
        Bucket: this.bucketName,
        Delete: {
          Objects: keys.map((key) => ({ Key: key })),
        },
      });

      await this.s3Client.send(command);
      this.logger.log(`🗑️  ${keys.length} files deleted from S3`);
    } catch (error: any) {
      this.logger.error('❌ S3 batch delete error:', error);
      throw new InternalServerErrorException(`Failed to delete files: ${error.message}`);
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(key: string): Promise<boolean> {
    if (!this.isEnabled || !this.s3Client) {
      throw new InternalServerErrorException('S3 not configured');
    }

    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(key: string): Promise<Record<string, any>> {
    if (!this.isEnabled || !this.s3Client) {
      throw new InternalServerErrorException('S3 not configured');
    }

    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      return {
        contentType: response.ContentType,
        contentLength: response.ContentLength,
        lastModified: response.LastModified,
        metadata: response.Metadata,
      };
    } catch (error: any) {
      this.logger.error('❌ S3 get metadata error:', error);
      throw new NotFoundException(`File not found: ${key}`);
    }
  }

  /**
   * List objects in bucket
   */
  async listObjects(options: ListObjectsOptions = {}): Promise<{
    files: Array<{ key: string; size: number; lastModified: Date }>;
    nextToken?: string;
  }> {
    if (!this.isEnabled || !this.s3Client) {
      throw new InternalServerErrorException('S3 not configured');
    }

    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: options.prefix,
        MaxKeys: options.maxKeys || 1000,
        ContinuationToken: options.continuationToken,
      });

      const response = await this.s3Client.send(command);

      return {
        files: (response.Contents || []).map((item) => ({
          key: item.Key || '',
          size: item.Size || 0,
          lastModified: item.LastModified || new Date(),
        })),
        nextToken: response.NextContinuationToken,
      };
    } catch (error: any) {
      this.logger.error('❌ S3 list objects error:', error);
      throw new InternalServerErrorException(`Failed to list objects: ${error.message}`);
    }
  }

  /**
   * Copy file within S3
   */
  async copyFile(sourceKey: string, destinationKey: string): Promise<void> {
    if (!this.isEnabled || !this.s3Client) {
      throw new InternalServerErrorException('S3 not configured');
    }

    try {
      const command = new CopyObjectCommand({
        Bucket: this.bucketName,
        CopySource: `${this.bucketName}/${sourceKey}`,
        Key: destinationKey,
      });

      await this.s3Client.send(command);
      this.logger.log(`📋 File copied: ${sourceKey} → ${destinationKey}`);
    } catch (error: any) {
      this.logger.error('❌ S3 copy error:', error);
      throw new InternalServerErrorException(`Failed to copy file: ${error.message}`);
    }
  }

  /**
   * Check if S3 is configured
   */
  isConfigured(): boolean {
    return this.isEnabled;
  }

  /**
   * Get S3 configuration info
   */
  getConfig() {
    return {
      isEnabled: this.isEnabled,
      region: this.region,
      bucket: this.bucketName,
    };
  }
}
