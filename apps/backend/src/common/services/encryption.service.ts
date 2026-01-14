// /src/common/services/encryption.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

@Injectable()
export class ApiKeyEncryptionService {
  private readonly logger = new Logger(ApiKeyEncryptionService.name);
  private readonly encryptionKey: Buffer;

  constructor(private readonly configService: ConfigService) {
    const key = this.configService.get<string>('API_KEY_ENCRYPTION_SECRET');
    if (!key || key.length !== 64) {
      throw new Error(
        'API_KEY_ENCRYPTION_SECRET must be 64 hex characters (32 bytes). Generate with: openssl rand -hex 32',
      );
    }
    this.encryptionKey = Buffer.from(key, 'hex');
  }

  /**
   * Encrypt sensitive API keys using AES-256-GCM
   * @param plaintext The API key or secret to encrypt
   * @returns Encrypted string in format: iv:authTag:ciphertext
   */
  encrypt(plaintext: string): string {
    try {
      const iv = randomBytes(16);
      const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);

      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag().toString('hex');

      return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[Encryption] ❌ Encryption failed: ${errorMessage}`);
      throw new Error(`Encryption failed: ${errorMessage}`);
    }
  }

  /**
   * Decrypt API keys encrypted with encrypt()
   * @param encryptedData The encrypted string in format: iv:authTag:ciphertext
   * @returns Decrypted plaintext
   */
  decrypt(encryptedData: string): string {
    try {
      const parts = encryptedData.split(':');

      if (parts.length !== 3) {
        throw new Error(`Invalid encrypted format. Expected 3 parts, got ${parts.length}`);
      }

      const [ivHex, authTagHex, ciphertext] = parts;

      if (!ivHex || !authTagHex || !ciphertext) {
        throw new Error('Encrypted data is malformed or corrupted');
      }

      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[Encryption] ❌ Decryption failed: ${errorMessage}`);
      throw new Error(`Decryption failed: ${errorMessage}`);
    }
  }

  /**
   * Get fingerprint of API key (last 8 chars, safe for logs)
   */
  getFingerprint(plaintext: string): string {
    return `key_${plaintext.slice(-8)}`;
  }
}
