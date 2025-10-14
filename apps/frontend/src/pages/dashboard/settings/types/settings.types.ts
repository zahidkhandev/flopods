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

export interface WorkspaceApiKey {
  id: string;
  provider: string;
  displayName: string;
  endpoint: string | null;
  authType: string;
  providerConfig: any;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  expiresAt: string | null;
}

export interface AddMemberDto {
  email: string;
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
  canCreateCanvas?: boolean;
  canDeleteCanvas?: boolean;
  canInviteMembers?: boolean;
  canManageMembers?: boolean;
  canManageApiKeys?: boolean;
}

export interface SendInvitationDto {
  email: string;
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
  permissions?: Record<string, boolean>;
}

export interface AddApiKeyDto {
  provider: string;
  displayName: string;
  apiKey: string;
  endpoint?: string;
  authType?: string;
  providerConfig?: any;
}

export interface UpdateApiKeyDto {
  displayName?: string;
  apiKey?: string;
  endpoint?: string;
  isActive?: boolean;
  providerConfig?: any;
}
