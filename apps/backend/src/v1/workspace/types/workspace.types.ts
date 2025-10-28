// src/modules/workspace/types/workspace.types.ts

import { WorkspaceType, WorkspaceRole, InvitationStatus, LLMProvider } from '@flopods/schema';

export interface InvitationDetailsResponse {
  workspace: {
    id: string;
    name: string;
    type: string;
  };
  email: string;
  role: string;
  permissions: Record<string, boolean> | null;
  expiresAt: Date;
  status: string;
}
/**
 * Response type for workspace list
 */
export interface WorkspaceListItem {
  id: string;
  name: string;
  type: WorkspaceType;
  role: WorkspaceRole;
  permissions: {
    canCreateCanvas: boolean;
    canDeleteCanvas: boolean;
    canManageBilling: boolean;
    canInviteMembers: boolean;
    canManageMembers: boolean;
    canManageApiKeys: boolean;
  };
  memberCount: number;
  canvasCount: number;
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Response type for workspace details
 */
export interface WorkspaceDetails {
  id: string;
  name: string;
  type: WorkspaceType;
  createdAt: Date;
  updatedAt: Date;
  members: Array<{
    userId: string;
    workspaceId: string;
    role: WorkspaceRole;
    canCreateCanvas: boolean;
    canDeleteCanvas: boolean;
    canManageBilling: boolean;
    canInviteMembers: boolean;
    canManageMembers: boolean;
    canManageApiKeys: boolean;
    joinedAt: Date;
    invitedBy: string | null;
    user: {
      id: string;
      email: string;
      name: string | null;
      image: string | null;
    };
  }>;
  _count: {
    flows: number;
    documents: number;
    apiKeys: number;
  };
  currentUserRole: WorkspaceRole;
  currentUserPermissions: {
    canCreateCanvas: boolean;
    canDeleteCanvas: boolean;
    canManageBilling: boolean;
    canInviteMembers: boolean;
    canManageMembers: boolean;
    canManageApiKeys: boolean;
  };
}

/**
 * Response type for workspace member
 */
export interface WorkspaceMemberResponse {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
  canCreateCanvas: boolean;
  canDeleteCanvas: boolean;
  canManageBilling: boolean;
  canInviteMembers: boolean;
  canManageMembers: boolean;
  canManageApiKeys: boolean;
  joinedAt: Date;
  invitedBy: string | null;
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
  };
}

/**
 * Simplified API key response (with usage tracking)
 */
export interface ApiKeyResponse {
  id: string;
  provider: LLMProvider;
  displayName: string;
  isActive: boolean;
  lastUsedAt: Date | null;
  createdAt: Date;

  // Usage metrics
  usageCount: number;
  totalTokens: string; // BigInt as string
  totalCost: number;

  // Error tracking
  lastErrorAt: Date | null;

  // Creator
  createdBy: {
    id: string;
    name: string | null;
    email: string;
  };
}

/**
 * Response type for invitations
 */
export interface InvitationResponse {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  permissions: any;
  token: string;
  status: InvitationStatus;
  expiresAt: Date;
  createdAt: Date;
  invitedBy: string;
  invitedUserId: string | null;
  acceptedAt: Date | null;
}

/**
 * Response type for invitation acceptance
 */
export interface AcceptInvitationResponse {
  workspace: {
    id: string;
    name: string;
    type: WorkspaceType;
    createdAt: Date;
    updatedAt: Date;
  };
  member: any;
  message: string;
}

/**
 * Standard message response
 */
export interface MessageResponse {
  message: string;
}

/**
 * API key usage statistics (simplified)
 */
export interface ApiKeyUsageStats {
  totalKeys: number;
  activeKeys: number;
  inactiveKeys: number;
  providerBreakdown: Record<string, number>;

  // Cumulative metrics
  totalUsageCount: number;
  totalTokensConsumed: string; // BigInt as string
  totalCostIncurred: number;
}

/**
 * Usage metric response (daily aggregated)
 */
export interface UsageMetricResponse {
  id: string;
  date: Date;
  requestCount: number;
  successCount: number;
  errorCount: number;
  promptTokens: string; // BigInt as string
  completionTokens: string; // BigInt as string
  totalTokens: string; // BigInt as string
  estimatedCost: number;
}
