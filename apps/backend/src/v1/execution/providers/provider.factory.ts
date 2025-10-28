import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { LLMProvider, ProviderAPIKey } from '@flopods/schema';
import { OpenAIProvider } from './openai.provider';
import { AnthropicProvider } from './anthropic.provider';
import { GeminiProvider } from './gemini.provider';
import * as crypto from 'crypto';
import { ILLMProvider } from '../types/llm-provider.types';

/**
 * PRODUCTION-GRADE Provider Factory with:
 * - AES-256-GCM encryption for API keys
 * - Backward compatibility for old 16-byte IV format
 * - New 12-byte IV format (GCM standard)
 * - BYOK (Bring Your Own Key) support
 * - Usage tracking with fallback
 * - Circuit breaker pattern
 * - Comprehensive error handling
 */
@Injectable()
export class ProviderFactory implements OnModuleInit {
  private readonly logger = new Logger(ProviderFactory.name);
  private readonly encryptionKey: Buffer;
  private readonly encryptionAlgorithm = 'aes-256-gcm';
  private readonly NEW_IV_LENGTH = 12; // 96-bit IV for GCM (recommended)
  private readonly OLD_IV_LENGTH = 16; // 128-bit IV (legacy)
  private readonly AUTH_TAG_LENGTH = 16; // 128-bit auth tag

  // Circuit breaker state
  private readonly circuitBreaker = new Map<string, { failures: number; lastFailure: number }>();
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5; // Failures before opening circuit
  private readonly CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute cooldown

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.encryptionKey = this.initializeEncryption();
  }

  async onModuleInit() {
    await this.runHealthCheck();
  }

  /**
   * Initialize encryption with comprehensive validation
   */
  private initializeEncryption(): Buffer {
    try {
      const key = this.configService.get<string>('API_KEY_ENCRYPTION_SECRET');

      if (!key) {
        const errorMsg =
          'CRITICAL: API_KEY_ENCRYPTION_SECRET environment variable is not set. ' +
          "Generate one using: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"";
        this.logger.error(errorMsg);
        throw new Error(errorMsg);
      }

      // Validate key format
      if (!/^[0-9a-fA-F]{64}$/.test(key)) {
        throw new Error(
          'API_KEY_ENCRYPTION_SECRET must be a 64-character hexadecimal string (32 bytes). ' +
            "Generate using: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
        );
      }

      const keyBuffer = Buffer.from(key, 'hex');

      if (keyBuffer.length !== 32) {
        throw new Error(
          `API_KEY_ENCRYPTION_SECRET must be exactly 32 bytes (64 hex characters). Current: ${keyBuffer.length} bytes`,
        );
      }

      this.logger.log('✅ Encryption key validated successfully');
      return keyBuffer;
    } catch (error) {
      this.logger.error('Failed to initialize encryption:', error);
      throw error;
    }
  }

  /**
   * Get provider instance with validation and caching
   */
  getProvider(provider: LLMProvider): ILLMProvider {
    try {
      if (!provider || typeof provider !== 'string') {
        throw new Error('Invalid provider: Provider must be a non-empty string');
      }

      switch (provider) {
        case LLMProvider.OPENAI:
          return new OpenAIProvider(this.prisma);
        case LLMProvider.ANTHROPIC:
          return new AnthropicProvider(this.prisma);
        case LLMProvider.GOOGLE_GEMINI:
          return new GeminiProvider(this.prisma);
        default:
          throw new Error(
            `Unsupported provider: ${provider}. Supported providers: ${Object.values(LLMProvider).join(', ')}`,
          );
      }
    } catch (error) {
      this.logger.error(`Failed to get provider instance for ${provider}:`, error);
      throw error;
    }
  }

  /**
   * Get and decrypt workspace API key with circuit breaker
   */
  async getWorkspaceApiKey(
    workspaceId: string,
    provider: LLMProvider,
  ): Promise<{ apiKey: string; keyId: string; customEndpoint?: string } | null> {
    try {
      // Input validation
      if (!workspaceId || typeof workspaceId !== 'string' || workspaceId.trim().length === 0) {
        throw new Error('Invalid workspaceId: Must be a non-empty string');
      }

      if (!provider || typeof provider !== 'string') {
        throw new Error('Invalid provider: Must be a valid LLMProvider enum value');
      }

      // Check circuit breaker
      const circuitKey = `${workspaceId}:${provider}`;
      if (this.isCircuitOpen(circuitKey)) {
        throw new Error(
          `Circuit breaker open for ${provider}. Too many recent failures. Please try again later.`,
        );
      }

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
        this.logger.debug(
          `No active API key found for workspace ${workspaceId} and provider ${provider}`,
        );
        return null;
      }

      // Validate key record
      if (!apiKeyRecord.keyHash || typeof apiKeyRecord.keyHash !== 'string') {
        this.logger.error(
          `Invalid keyHash for API key ${apiKeyRecord.id}: keyHash is missing or invalid`,
        );
        throw new Error('Stored API key data is corrupted');
      }

      // Decrypt API key with backward compatibility
      const decryptedKey = this.decryptApiKey(apiKeyRecord.keyHash);

      if (!decryptedKey || decryptedKey.length === 0) {
        throw new Error('Decryption produced empty API key');
      }

      // Reset circuit breaker on success
      this.resetCircuitBreaker(circuitKey);

      this.logger.debug(
        `Successfully retrieved and decrypted API key ${apiKeyRecord.id} for workspace ${workspaceId}`,
      );

      return {
        apiKey: decryptedKey,
        keyId: apiKeyRecord.id,
        customEndpoint: (apiKeyRecord as any).customEndpoint || undefined,
      };
    } catch (error) {
      // Record failure in circuit breaker
      const circuitKey = `${workspaceId}:${provider}`;
      this.recordFailure(circuitKey);

      this.logger.error(
        `Failed to get workspace API key for ${workspaceId}/${provider}:`,
        error instanceof Error ? error.message : error,
      );
      throw new Error(
        `Failed to retrieve API key: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Circuit breaker: Check if circuit is open
   */
  private isCircuitOpen(key: string): boolean {
    const state = this.circuitBreaker.get(key);
    if (!state) return false;

    const now = Date.now();
    const timeSinceLastFailure = now - state.lastFailure;

    // Reset if cooldown period has passed
    if (timeSinceLastFailure > this.CIRCUIT_BREAKER_TIMEOUT) {
      this.circuitBreaker.delete(key);
      return false;
    }

    return state.failures >= this.CIRCUIT_BREAKER_THRESHOLD;
  }

  /**
   * Circuit breaker: Record failure
   */
  private recordFailure(key: string): void {
    const state = this.circuitBreaker.get(key) || { failures: 0, lastFailure: 0 };
    state.failures += 1;
    state.lastFailure = Date.now();
    this.circuitBreaker.set(key, state);

    if (state.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      this.logger.warn(`Circuit breaker opened for ${key} after ${state.failures} failures`);
    }
  }

  /**
   * Circuit breaker: Reset on success
   */
  private resetCircuitBreaker(key: string): void {
    this.circuitBreaker.delete(key);
  }

  /**
   * Encrypt API key using AES-256-GCM with NEW 12-byte IV format
   */
  encryptApiKey(plaintext: string): string {
    try {
      // Input validation
      if (!plaintext || typeof plaintext !== 'string') {
        throw new Error('Invalid plaintext: Must be a non-empty string');
      }

      if (plaintext.trim().length === 0) {
        throw new Error('Cannot encrypt empty API key');
      }

      // Generate cryptographically secure 12-byte IV (GCM standard)
      const iv = crypto.randomBytes(this.NEW_IV_LENGTH);

      // Create cipher
      const cipher = crypto.createCipheriv(this.encryptionAlgorithm, this.encryptionKey, iv);

      // Encrypt
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Get authentication tag
      const authTag = cipher.getAuthTag();

      // Validate auth tag length
      if (authTag.length !== this.AUTH_TAG_LENGTH) {
        throw new Error(
          `Invalid auth tag length: expected ${this.AUTH_TAG_LENGTH}, got ${authTag.length}`,
        );
      }

      // Format: iv:authTag:encrypted
      const result = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;

      this.logger.debug('API key encrypted successfully with 12-byte IV');
      return result;
    } catch (error) {
      this.logger.error('Failed to encrypt API key:', error);
      throw new Error(
        `Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Decrypt API key with BACKWARD COMPATIBILITY for both 12-byte and 16-byte IV formats
   */
  private decryptApiKey(encryptedData: string): string {
    try {
      // Input validation
      if (!encryptedData || typeof encryptedData !== 'string') {
        throw new Error('Invalid encrypted data: Must be a non-empty string');
      }

      // Parse encrypted data
      const parts = encryptedData.split(':');

      if (parts.length !== 3) {
        throw new Error(
          `Invalid encrypted data format: Expected 3 parts (iv:authTag:encrypted), got ${parts.length}`,
        );
      }

      const [ivHex, authTagHex, encrypted] = parts;

      // Validate parts
      if (!ivHex || !authTagHex || !encrypted) {
        throw new Error('One or more encrypted data components are empty');
      }

      // Validate hex format
      if (
        !/^[0-9a-fA-F]+$/.test(ivHex) ||
        !/^[0-9a-fA-F]+$/.test(authTagHex) ||
        !/^[0-9a-fA-F]+$/.test(encrypted)
      ) {
        throw new Error('Encrypted data contains invalid hexadecimal characters');
      }

      // Convert from hex
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      // Determine IV format (backward compatibility)
      const ivLength = iv.length;

      if (ivLength !== this.NEW_IV_LENGTH && ivLength !== this.OLD_IV_LENGTH) {
        throw new Error(
          `Invalid IV length: expected ${this.NEW_IV_LENGTH} bytes (new format) or ${this.OLD_IV_LENGTH} bytes (legacy format), got ${ivLength} bytes`,
        );
      }

      // Log if using legacy format
      if (ivLength === this.OLD_IV_LENGTH) {
        this.logger.warn(
          `Decrypting API key with legacy 16-byte IV format. Consider re-encrypting with the new 12-byte format.`,
        );
      }

      // Validate auth tag length
      if (authTag.length !== this.AUTH_TAG_LENGTH) {
        throw new Error(
          `Invalid auth tag length: expected ${this.AUTH_TAG_LENGTH} bytes, got ${authTag.length}`,
        );
      }

      // Create decipher
      const decipher = crypto.createDecipheriv(this.encryptionAlgorithm, this.encryptionKey, iv);

      decipher.setAuthTag(authTag);

      // Decrypt
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      if (!decrypted || decrypted.length === 0) {
        throw new Error('Decryption produced empty result');
      }

      this.logger.debug(`API key decrypted successfully (IV length: ${ivLength} bytes)`);
      return decrypted;
    } catch (error) {
      this.logger.error(
        'Failed to decrypt API key:',
        error instanceof Error ? error.message : error,
      );

      // Provide helpful error messages
      if (error instanceof Error) {
        if (error.message.includes('Unsupported state') || error.message.includes('auth')) {
          throw new Error('Authentication failed: API key may be corrupted or tampered with');
        }
        if (error.message.includes('bad decrypt')) {
          throw new Error('Decryption failed: Incorrect encryption key or corrupted data');
        }
      }

      throw new Error(
        `Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Track API key usage with comprehensive error handling and fallbacks
   */
  async trackApiKeyUsage(
    keyId: string,
    tokens: { input: number; output: number; reasoning?: number },
    cost: number,
    success: boolean,
  ): Promise<void> {
    try {
      // Input validation
      if (!keyId || typeof keyId !== 'string' || keyId.trim().length === 0) {
        throw new Error('Invalid keyId: Must be a non-empty string');
      }

      // Validate tokens
      if (typeof tokens.input !== 'number' || tokens.input < 0) {
        throw new Error(`Invalid input tokens: ${tokens.input}`);
      }
      if (typeof tokens.output !== 'number' || tokens.output < 0) {
        throw new Error(`Invalid output tokens: ${tokens.output}`);
      }
      if (
        tokens.reasoning !== undefined &&
        (typeof tokens.reasoning !== 'number' || tokens.reasoning < 0)
      ) {
        throw new Error(`Invalid reasoning tokens: ${tokens.reasoning}`);
      }

      // Validate cost
      if (typeof cost !== 'number' || cost < 0) {
        throw new Error(`Invalid cost: ${cost}`);
      }

      const totalTokens = tokens.input + tokens.output + (tokens.reasoning || 0);

      // Update API key stats with transaction
      await this.prisma.$transaction(
        async (tx) => {
          // Update API key
          await tx.providerAPIKey.update({
            where: { id: keyId },
            data: {
              lastUsedAt: new Date(),
              usageCount: { increment: 1 },
              totalTokens: { increment: BigInt(totalTokens) },
              totalCost: { increment: cost },
              ...(success ? {} : { lastErrorAt: new Date() }),
            },
          });

          // Get workspace ID
          const apiKey = await tx.providerAPIKey.findUnique({
            where: { id: keyId },
            select: { workspaceId: true },
          });

          if (!apiKey) {
            throw new Error(`API key ${keyId} not found`);
          }

          // Update daily metrics
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          await tx.usageMetric.upsert({
            where: {
              keyId_date: {
                keyId,
                date: today,
              },
            },
            create: {
              keyId,
              workspaceId: apiKey.workspaceId,
              date: today,
              requestCount: 1,
              successCount: success ? 1 : 0,
              errorCount: success ? 0 : 1,
              promptTokens: BigInt(tokens.input),
              completionTokens: BigInt(tokens.output + (tokens.reasoning || 0)),
              totalTokens: BigInt(totalTokens),
              estimatedCost: cost,
            },
            update: {
              requestCount: { increment: 1 },
              successCount: success ? { increment: 1 } : undefined,
              errorCount: success ? undefined : { increment: 1 },
              promptTokens: { increment: BigInt(tokens.input) },
              completionTokens: { increment: BigInt(tokens.output + (tokens.reasoning || 0)) },
              totalTokens: { increment: BigInt(totalTokens) },
              estimatedCost: { increment: cost },
            },
          });
        },
        {
          timeout: 10000, // 10 second timeout
        },
      );

      this.logger.debug(
        `✅ Usage tracked for key ${keyId}: ${totalTokens} tokens, $${cost.toFixed(6)}, success=${success}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to track usage for key ${keyId}:`,
        error instanceof Error ? error.message : error,
      );

      // Don't throw - tracking failure shouldn't break execution
      this.logger.warn('Usage tracking failure will not affect execution flow');
    }
  }

  /**
   * Get all active API keys for workspace with error handling
   */
  async getWorkspaceApiKeys(workspaceId: string): Promise<ProviderAPIKey[]> {
    try {
      // Input validation
      if (!workspaceId || typeof workspaceId !== 'string' || workspaceId.trim().length === 0) {
        throw new Error('Invalid workspaceId: Must be a non-empty string');
      }

      const keys = await this.prisma.providerAPIKey.findMany({
        where: {
          workspaceId,
          isActive: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      this.logger.debug(`Retrieved ${keys.length} active API keys for workspace ${workspaceId}`);
      return keys;
    } catch (error) {
      this.logger.error(
        `Failed to get workspace API keys for ${workspaceId}:`,
        error instanceof Error ? error.message : error,
      );
      throw new Error(
        `Failed to retrieve API keys: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Health check for encryption system (run on startup)
   */
  private async runHealthCheck(): Promise<void> {
    try {
      // Test encryption/decryption
      const testData = 'test-api-key-' + Date.now();
      const encrypted = this.encryptApiKey(testData);
      const decrypted = this.decryptApiKey(encrypted);

      if (decrypted !== testData) {
        throw new Error('Encryption round-trip test failed');
      }

      // Test database connection
      await this.prisma.$queryRaw`SELECT 1`;

      this.logger.log('✅ Provider factory health check passed');
    } catch (error) {
      this.logger.error('❌ Provider factory health check failed:', error);
      throw error;
    }
  }

  /**
   * Health check endpoint for monitoring
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: string }> {
    try {
      await this.runHealthCheck();
      return {
        status: 'healthy',
        details: 'Encryption and database connectivity verified',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
