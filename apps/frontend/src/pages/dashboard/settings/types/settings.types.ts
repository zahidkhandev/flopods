// types/settings.types.ts

/**
 * Workspace member
 */
export interface WorkspaceMember {
  userId: string;
  workspaceId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  canCreateCanvas: boolean;
  canDeleteCanvas: boolean;
  canManageBilling: boolean;
  canInviteMembers: boolean;
  canManageMembers: boolean;
  canManageApiKeys: boolean;
  joinedAt: string;
  invitedBy: string | null;
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
  };
}

/**
 * Workspace invitation
 */
export interface WorkspaceInvitation {
  id: string;
  workspaceId: string;
  email: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  permissions: Record<string, boolean> | null;
  token: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'REVOKED';
  expiresAt: string;
  createdAt: string;
  invitedBy: string;
  invitedUserId: string | null;
  acceptedAt: string | null;
}

/**
 * Workspace API key with usage tracking
 */
export interface WorkspaceApiKey {
  id: string;
  provider: string;
  displayName: string;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;

  // Usage metrics
  usageCount: number;
  totalTokens: string;
  totalCost: number;

  // Error tracking
  lastErrorAt: string | null;

  // Creator
  createdBy: {
    id: string;
    name: string | null;
    email: string;
  };
}

/**
 * API key usage statistics
 */
export interface ApiKeyUsageStats {
  totalKeys: number;
  activeKeys: number;
  inactiveKeys: number;
  providerBreakdown: Record<string, number>;
  totalUsageCount: number;
  totalTokensConsumed: string;
  totalCostIncurred: number;
}

/**
 * Daily usage metric
 */
export interface UsageMetric {
  id: string;
  date: string;
  requestCount: number;
  successCount: number;
  errorCount: number;
  promptTokens: string;
  completionTokens: string;
  totalTokens: string;
  estimatedCost: number;
}

/**
 * Add API key DTO
 */
export interface AddApiKeyDto {
  provider: string;
  displayName: string;
  apiKey: string;
}

/**
 * Update API key DTO
 */
export interface UpdateApiKeyDto {
  displayName?: string;
  apiKey?: string;
  isActive?: boolean;
}

/**
 * Add member DTO
 */
export interface AddMemberDto {
  email: string;
  role?: 'ADMIN' | 'MEMBER' | 'VIEWER';
  canCreateCanvas?: boolean;
  canDeleteCanvas?: boolean;
  canManageBilling?: boolean;
  canInviteMembers?: boolean;
  canManageMembers?: boolean;
  canManageApiKeys?: boolean;
}

/**
 * Send invitation DTO
 */
export interface SendInvitationDto {
  email: string;
  role?: 'MEMBER' | 'ADMIN' | 'VIEWER';
  permissions?: Record<string, boolean> | null;
}
