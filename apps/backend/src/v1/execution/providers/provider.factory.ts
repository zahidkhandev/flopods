import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { LLMProvider, ProviderAPIKey } from '@actopod/schema';
import { OpenAIProvider } from './openai.provider';
import { AnthropicProvider } from './anthropic.provider';
import { GeminiProvider } from './gemini.provider';
import * as crypto from 'crypto';
import { ILLMProvider } from '../types/llm-provider.types';

/**
 * PRODUCTION-GRADE Provider Factory
 * - AES-256-GCM encryption for API keys
 * - BYOK (Bring Your Own Key) support
 * - Usage tracking
 * - Error handling
 */
@Injectable()
export class ProviderFactory {
  private readonly logger = new Logger(ProviderFactory.name);
  private readonly encryptionKey: Buffer;
  private readonly encryptionAlgorithm = 'aes-256-gcm';

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    // Initialize encryption key
    const key = this.configService.get<string>('API_KEY_ENCRYPTION_SECRET');

    if (!key) {
      throw new Error(
        "API_KEY_ENCRYPTION_SECRET must be set. Generate: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
      );
    }

    this.encryptionKey = Buffer.from(key, 'hex');

    if (this.encryptionKey.length !== 32) {
      throw new Error(
        `API_KEY_ENCRYPTION_SECRET must be 32 bytes (64 hex chars). Current: ${this.encryptionKey.length} bytes`,
      );
    }

    this.logger.log('✅ Encryption initialized successfully');
  }

  /**
   * Get provider instance
   */
  getProvider(provider: LLMProvider): ILLMProvider {
    switch (provider) {
      case LLMProvider.OPENAI:
        return new OpenAIProvider(this.prisma);
      case LLMProvider.ANTHROPIC:
        return new AnthropicProvider(this.prisma);
      case LLMProvider.GOOGLE_GEMINI:
        return new GeminiProvider(this.prisma);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * Get and decrypt workspace API key
   */
  async getWorkspaceApiKey(
    workspaceId: string,
    provider: LLMProvider,
  ): Promise<{ apiKey: string; keyId: string; customEndpoint?: string } | null> {
    const apiKeyRecord = await this.prisma.providerAPIKey.findFirst({
      where: {
        workspaceId,
        provider,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!apiKeyRecord) {
      return null;
    }

    // Decrypt API key
    const decryptedKey = this.decryptApiKey(apiKeyRecord.keyHash);

    return {
      apiKey: decryptedKey,
      keyId: apiKeyRecord.id,
      customEndpoint: (apiKeyRecord as any).customEndpoint,
    };
  }

  /**
   * Encrypt API key using AES-256-GCM
   */
  encryptApiKey(plaintext: string): string {
    const iv = crypto.randomBytes(12); // 96-bit IV for GCM
    const cipher = crypto.createCipheriv(this.encryptionAlgorithm, this.encryptionKey, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt API key using AES-256-GCM
   */
  private decryptApiKey(encryptedData: string): string {
    try {
      const [ivHex, authTagHex, encrypted] = encryptedData.split(':');

      if (!ivHex || !authTagHex || !encrypted) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      const decipher = crypto.createDecipheriv(this.encryptionAlgorithm, this.encryptionKey, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error('Failed to decrypt API key:', error);
      throw new Error('Failed to decrypt API key');
    }
  }

  /**
   * Track API key usage (BYOK mode - tokens only, no credits)
   */
  async trackApiKeyUsage(
    keyId: string,
    tokens: { input: number; output: number; reasoning?: number },
    cost: number,
    success: boolean,
  ): Promise<void> {
    try {
      // Update API key stats
      await this.prisma.providerAPIKey.update({
        where: { id: keyId },
        data: {
          lastUsedAt: new Date(),
          usageCount: { increment: 1 },
          totalTokens: {
            increment: BigInt(tokens.input + tokens.output + (tokens.reasoning || 0)),
          },
          totalCost: { increment: cost },
          ...(success ? {} : { lastErrorAt: new Date() }),
        },
      });

      // Update daily metrics
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const workspace = await this.prisma.providerAPIKey.findUnique({
        where: { id: keyId },
        select: { workspaceId: true },
      });

      if (!workspace) return;

      await this.prisma.usageMetric.upsert({
        where: {
          keyId_date: {
            keyId,
            date: today,
          },
        },
        create: {
          keyId,
          workspaceId: workspace.workspaceId,
          date: today,
          requestCount: 1,
          successCount: success ? 1 : 0,
          errorCount: success ? 0 : 1,
          promptTokens: BigInt(tokens.input),
          completionTokens: BigInt(tokens.output + (tokens.reasoning || 0)),
          totalTokens: BigInt(tokens.input + tokens.output + (tokens.reasoning || 0)),
          estimatedCost: cost,
        },
        update: {
          requestCount: { increment: 1 },
          successCount: success ? { increment: 1 } : undefined,
          errorCount: success ? undefined : { increment: 1 },
          promptTokens: { increment: BigInt(tokens.input) },
          completionTokens: { increment: BigInt(tokens.output + (tokens.reasoning || 0)) },
          totalTokens: {
            increment: BigInt(tokens.input + tokens.output + (tokens.reasoning || 0)),
          },
          estimatedCost: { increment: cost },
        },
      });
    } catch (error) {
      this.logger.error(`Failed to track usage for key ${keyId}:`, error);
      // Don't throw - tracking failure shouldn't break execution
    }
  }

  /**
   * Get all active API keys for workspace
   */
  async getWorkspaceApiKeys(workspaceId: string): Promise<ProviderAPIKey[]> {
    return this.prisma.providerAPIKey.findMany({
      where: {
        workspaceId,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
