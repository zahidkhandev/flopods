// /src/modules/workspaces/services/api-key.service.ts

import {
  Injectable,
  Logger,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { LLMProvider } from '@flopods/schema'; // Import enum
import { Decimal } from '@prisma/client/runtime/library'; // Import Decimal
import { PrismaService } from '../../../prisma/prisma.service';
import { ApiKeyEncryptionService } from '../../../common/services/encryption.service';

export interface ApiKeyResponse {
  id: string;
  provider: string;
  displayName: string;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  usageCount: number;
  totalTokens: string;
  totalCost: number;
  lastErrorAt: string | null;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
}

export interface WorkspaceAddApiKeyDto {
  provider: LLMProvider; // Use enum, not string
  displayName: string;
  apiKey: string;
}

@Injectable()
export class V1ApiKeyService {
  private readonly logger = new Logger(V1ApiKeyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: ApiKeyEncryptionService,
  ) {}

  /**
   * Add new API key to workspace (encrypted storage)
   */
  async addApiKey(
    workspaceId: string,
    userId: string,
    dto: WorkspaceAddApiKeyDto,
  ): Promise<ApiKeyResponse> {
    try {
      // Check workspace exists
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { id: true },
      });

      if (!workspace) {
        throw new NotFoundException('Workspace not found');
      }

      // FIX: Use workspaceUser (not workspaceMember)
      const member = await this.prisma.workspaceUser.findUnique({
        where: {
          userId_workspaceId: {
            workspaceId,
            userId,
          },
        },
        select: { role: true, canManageApiKeys: true },
      });

      if (!member || (!['OWNER', 'ADMIN'].includes(member.role) && !member.canManageApiKeys)) {
        throw new ForbiddenException(
          'You do not have permission to manage API keys in this workspace',
        );
      }

      // Check if key already exists
      const existing = await this.prisma.providerAPIKey.findUnique({
        where: {
          workspaceId_provider_displayName: {
            workspaceId,
            provider: dto.provider,
            displayName: dto.displayName,
          },
        },
      });

      if (existing) {
        throw new ConflictException(
          `An API key with name "${dto.displayName}" already exists for ${dto.provider}`,
        );
      }

      // Encrypt API key before storing
      const encryptedKey = this.encryptionService.encrypt(dto.apiKey);
      const fingerprint = this.encryptionService.getFingerprint(dto.apiKey);

      this.logger.log(
        `[ApiKeyService] Adding ${dto.provider} key "${dto.displayName}" (${fingerprint}) for workspace ${workspaceId}`,
      );

      // Create API key record with proper types
      const apiKey = await this.prisma.providerAPIKey.create({
        data: {
          workspaceId,
          provider: dto.provider, // Already LLMProvider enum
          displayName: dto.displayName,
          keyHash: encryptedKey,
          isActive: true,
          createdById: userId,
          usageCount: 0,
          totalTokens: BigInt(0),
          totalCost: new Decimal(0), // Use Decimal
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      this.logger.log(`[ApiKeyService] API key created: ${apiKey.id} (${fingerprint})`);

      // Transform response
      return this.formatApiKeyResponse(apiKey);
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof ForbiddenException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[ApiKeyService] ❌ Failed to add API key: ${errorMessage}`, error);
      throw new InternalServerErrorException('Failed to add API key');
    }
  }

  /**
   * Format API key for response
   */
  private formatApiKeyResponse(apiKey: any): ApiKeyResponse {
    return {
      id: apiKey.id,
      provider: String(apiKey.provider), // Convert enum to string
      displayName: apiKey.displayName,
      isActive: apiKey.isActive,
      lastUsedAt: apiKey.lastUsedAt?.toISOString() || null,
      createdAt: apiKey.createdAt.toISOString(),
      usageCount: apiKey.usageCount,
      totalTokens: apiKey.totalTokens.toString(),
      totalCost: Number(apiKey.totalCost),
      lastErrorAt: apiKey.lastErrorAt?.toISOString() || null,
      createdBy: {
        id: apiKey.createdBy.id,
        name: apiKey.createdBy.name || '',
        email: apiKey.createdBy.email,
      },
    };
  }

  /**
   * Get encrypted API key (for internal use only)
   */
  async getEncryptedKey(workspaceId: string, keyId: string): Promise<string> {
    const apiKey = await this.prisma.providerAPIKey.findUnique({
      where: {
        id: keyId,
        workspaceId,
      },
      select: { keyHash: true, displayName: true, provider: true },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    this.logger.debug(
      `[ApiKeyService] 🔑 Retrieving encrypted key: ${apiKey.provider}/${apiKey.displayName}`,
    );

    return apiKey.keyHash;
  }

  /**
   * Decrypt API key for use (NEVER expose to frontend)
   */
  async getDecryptedKey(workspaceId: string, keyId: string): Promise<string> {
    const encrypted = await this.getEncryptedKey(workspaceId, keyId);

    try {
      const decrypted = this.encryptionService.decrypt(encrypted);

      if (!decrypted || decrypted.length < 20) {
        throw new Error('Decrypted key is invalid or corrupted');
      }

      const fingerprint = this.encryptionService.getFingerprint(decrypted);
      this.logger.debug(`[ApiKeyService] Key decrypted successfully (${fingerprint})`);

      return decrypted;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[ApiKeyService] ❌ Failed to decrypt key: ${errorMessage}`);
      throw new InternalServerErrorException('Failed to decrypt API key');
    }
  }

  /**
   * List all API keys for workspace (NOT decrypted)
   */
  async listApiKeys(workspaceId: string): Promise<ApiKeyResponse[]> {
    const keys = await this.prisma.providerAPIKey.findMany({
      where: { workspaceId, isActive: true },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform all keys using formatter
    return keys.map((k) => this.formatApiKeyResponse(k));
  }

  /**
   * Update API key usage stats
   */
  async updateUsageStats(keyId: string, tokensUsed: number, costUsd: number): Promise<void> {
    await this.prisma.providerAPIKey.update({
      where: { id: keyId },
      data: {
        usageCount: { increment: 1 },
        totalTokens: { increment: BigInt(tokensUsed) },
        totalCost: { increment: new Decimal(costUsd) }, // Use Decimal
        lastUsedAt: new Date(),
      },
    });

    this.logger.debug(`[ApiKeyService] 📊 Updated usage for key ${keyId}`);
  }

  /**
   * Log API key error
   */
  async logError(keyId: string, error: string): Promise<void> {
    await this.prisma.providerAPIKey.update({
      where: { id: keyId },
      data: { lastErrorAt: new Date() },
    });

    this.logger.error(`[ApiKeyService] Error on key ${keyId}: ${error}`);
  }

  /**
   * Delete API key
   */
  async deleteApiKey(workspaceId: string, keyId: string): Promise<void> {
    const key = await this.prisma.providerAPIKey.findUnique({
      where: { id: keyId, workspaceId },
    });

    if (!key) {
      throw new NotFoundException('API key not found');
    }

    await this.prisma.providerAPIKey.delete({
      where: { id: keyId },
    });

    const fingerprint = `key_${keyId.slice(-8)}`;
    this.logger.log(
      `[ApiKeyService] API key deleted: ${key.provider}/${key.displayName} (${fingerprint})`,
    );
  }

  /**
   * Get active API key for workspace and provider
   */
  async getActiveKey(workspaceId: string, provider: LLMProvider): Promise<string | null> {
    const apiKey = await this.prisma.providerAPIKey.findFirst({
      where: { workspaceId, provider, isActive: true },
      select: { keyHash: true },
    });

    if (!apiKey) {
      return null;
    }

    try {
      return this.encryptionService.decrypt(apiKey.keyHash);
    } catch (error) {
      this.logger.error(`Failed to decrypt active key for ${provider}`);
      return null;
    }
  }
}
