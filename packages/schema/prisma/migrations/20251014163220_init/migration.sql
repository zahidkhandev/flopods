-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "admin";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "billing";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "canvas";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "core";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "documents";

-- CreateEnum
CREATE TYPE "admin"."AdminRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'FINANCE', 'SUPPORT', 'DEVELOPER', 'ANALYST');

-- CreateEnum
CREATE TYPE "admin"."AdminStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED', 'LOCKED');

-- CreateEnum
CREATE TYPE "admin"."AdminAction" AS ENUM ('USER_CREATED', 'USER_UPDATED', 'USER_DELETED', 'USER_SUSPENDED', 'WORKSPACE_DELETED', 'SUBSCRIPTION_UPDATED', 'SUBSCRIPTION_CANCELLED', 'CREDITS_ADDED', 'CREDITS_REMOVED', 'REFUND_ISSUED', 'MODEL_ADDED', 'MODEL_UPDATED', 'PRICING_CHANGED', 'ADMIN_INVITED', 'ADMIN_CREATED', 'ADMIN_ROLE_CHANGED', 'PERMISSION_GRANTED', 'SESSION_REVOKED', 'CONFIG_CHANGED', 'DATA_EXPORTED');

-- CreateEnum
CREATE TYPE "admin"."AdminResource" AS ENUM ('USER', 'WORKSPACE', 'SUBSCRIPTION', 'CREDIT', 'MODEL', 'ADMIN', 'PERMISSION', 'SESSION', 'API_KEY', 'CANVAS', 'ACTION_POD', 'DOCUMENT', 'AUDIT_LOG', 'SYSTEM_CONFIG');

-- CreateEnum
CREATE TYPE "admin"."SpecificPermission" AS ENUM ('USER_VIEW', 'USER_UPDATE', 'USER_DELETE', 'USER_SUSPEND', 'WORKSPACE_VIEW', 'WORKSPACE_DELETE', 'BILLING_VIEW', 'BILLING_MANAGE', 'CREDITS_MANAGE', 'REFUND_ISSUE', 'MODEL_VIEW', 'MODEL_MANAGE', 'PRICING_MANAGE', 'ADMIN_VIEW', 'ADMIN_INVITE', 'ADMIN_MANAGE', 'SYSTEM_CONFIG_VIEW', 'SYSTEM_CONFIG_MANAGE', 'AUDIT_LOG_VIEW', 'AUDIT_LOG_EXPORT', 'DATA_EXPORT', 'DATA_DELETE');

-- CreateEnum
CREATE TYPE "admin"."SecurityEventType" AS ENUM ('FAILED_LOGIN', 'MULTIPLE_FAILED_LOGINS', 'SUSPICIOUS_IP', 'ACCOUNT_LOCKED', 'MFA_FAILED', 'UNAUTHORIZED_ACCESS_ATTEMPT');

-- CreateEnum
CREATE TYPE "admin"."SecuritySeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "billing"."SubscriptionTier" AS ENUM ('HOBBYIST', 'PRO', 'TEAM');

-- CreateEnum
CREATE TYPE "billing"."SubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELED', 'PAST_DUE', 'TRIALING', 'INCOMPLETE', 'PAUSED');

-- CreateEnum
CREATE TYPE "billing"."ModelCategory" AS ENUM ('WORKHORSE', 'POWERHOUSE', 'REASONING', 'SPECIALIST', 'IMAGE_GEN', 'VIDEO_GEN', 'AUDIO_GEN', 'EMBEDDING', 'RERANKING', 'MODERATION', 'SEARCH', 'TRANSLATION');

-- CreateEnum
CREATE TYPE "canvas"."PodType" AS ENUM ('TEXT_INPUT', 'DOCUMENT_INPUT', 'URL_INPUT', 'IMAGE_INPUT', 'VIDEO_INPUT', 'AUDIO_INPUT', 'LLM_PROMPT', 'EMBEDDING_POD', 'TOOL_POD', 'TEXT_OUTPUT', 'IMAGE_OUTPUT', 'VIDEO_OUTPUT', 'AUDIO_OUTPUT', 'CONTEXT_MODULE', 'FLOW_CONTEXT_INPUT', 'CODE_EXECUTION');

-- CreateEnum
CREATE TYPE "canvas"."PodExecutionStatus" AS ENUM ('IDLE', 'QUEUED', 'RUNNING', 'PAUSED', 'COMPLETED', 'ERROR', 'CANCELLED');

-- CreateEnum
CREATE TYPE "canvas"."FlowVisibility" AS ENUM ('PRIVATE', 'WORKSPACE', 'PUBLIC');

-- CreateEnum
CREATE TYPE "canvas"."FlowAccessLevel" AS ENUM ('VIEWER', 'COMMENTER', 'EDITOR', 'OWNER');

-- CreateEnum
CREATE TYPE "canvas"."FlowActivityAction" AS ENUM ('FLOW_CREATED', 'FLOW_UPDATED', 'FLOW_DELETED', 'FLOW_SHARED', 'FLOW_VISIBILITY_CHANGED', 'POD_CREATED', 'POD_UPDATED', 'POD_DELETED', 'POD_MOVED', 'POD_EXECUTED', 'POD_LOCKED', 'POD_UNLOCKED', 'EDGE_CREATED', 'EDGE_DELETED', 'COLLABORATOR_ADDED', 'COLLABORATOR_REMOVED', 'COLLABORATOR_PERMISSIONS_CHANGED', 'COMMENT_ADDED', 'COMMENT_RESOLVED', 'USER_JOINED', 'USER_LEFT');

-- CreateEnum
CREATE TYPE "core"."AuthProvider" AS ENUM ('GOOGLE', 'GITHUB', 'EMAIL');

-- CreateEnum
CREATE TYPE "core"."WorkspaceType" AS ENUM ('PERSONAL', 'TEAM');

-- CreateEnum
CREATE TYPE "core"."WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "core"."InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "core"."ShareAccessLevel" AS ENUM ('VIEW_ONLY', 'COMMENT', 'EDIT');

-- CreateEnum
CREATE TYPE "core"."LLMProvider" AS ENUM ('OPENAI', 'ANTHROPIC', 'GOOGLE_GEMINI', 'PERPLEXITY', 'MISTRAL', 'META_AI', 'XAI', 'DEEPSEEK', 'COHERE', 'GROQ', 'TOGETHER', 'REPLICATE', 'HUGGINGFACE', 'OPENROUTER', 'BEDROCK', 'OLLAMA', 'VLLM', 'LLAMACPP', 'TEXTGEN_WEBUI', 'CUSTOM');

-- CreateEnum
CREATE TYPE "core"."AuthType" AS ENUM ('BEARER_TOKEN', 'API_KEY_HEADER', 'BASIC_AUTH', 'OAUTH2', 'AWS_SIGV4', 'CUSTOM_HEADER');

-- CreateEnum
CREATE TYPE "core"."ShareableAssetType" AS ENUM ('FLOW', 'CONTEXT_MODULE');

-- CreateEnum
CREATE TYPE "documents"."DocumentStatus" AS ENUM ('UPLOADING', 'PROCESSING', 'READY', 'ERROR', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "documents"."DocumentSourceType" AS ENUM ('INTERNAL', 'GOOGLE_DRIVE', 'YOUTUBE', 'VIMEO', 'LOOM', 'URL');

-- CreateEnum
CREATE TYPE "documents"."DocumentProcessingType" AS ENUM ('PDF_TEXT_EXTRACTION', 'IMAGE_OCR', 'VIDEO_TRANSCRIPT', 'AUDIO_TRANSCRIPT', 'DOCUMENT_EMBEDDING', 'URL_SCRAPING', 'VISION_EXTRACTION');

-- CreateTable
CREATE TABLE "admin"."Admin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "role" "admin"."AdminRole" NOT NULL DEFAULT 'SUPPORT',
    "status" "admin"."AdminStatus" NOT NULL DEFAULT 'PENDING',
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "requiresMfa" BOOLEAN NOT NULL DEFAULT true,
    "mfaSecret" VARCHAR(255),
    "mfaBackupCodes" JSONB,
    "mfaVerifiedAt" TIMESTAMPTZ(6),
    "allowedIpAddresses" JSONB,
    "lastLoginAt" TIMESTAMPTZ(6),
    "lastLoginIp" VARCHAR(45),
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMPTZ(6),
    "passwordChangedAt" TIMESTAMPTZ(6),
    "passwordResetToken" VARCHAR(255),
    "passwordResetExpiry" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdBy" TEXT,
    "deactivatedAt" TIMESTAMPTZ(6),
    "deactivatedBy" TEXT,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin"."AdminSession" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "refreshToken" VARCHAR(255),
    "ipAddress" VARCHAR(45) NOT NULL,
    "userAgent" VARCHAR(500) NOT NULL,
    "deviceFingerprint" VARCHAR(255),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "lastActivityAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ(6),
    "revokedReason" VARCHAR(255),

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin"."AdminAuditLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT,
    "action" "admin"."AdminAction" NOT NULL,
    "resource" "admin"."AdminResource" NOT NULL,
    "resourceId" VARCHAR(255),
    "method" VARCHAR(10) NOT NULL,
    "endpoint" VARCHAR(500) NOT NULL,
    "ipAddress" VARCHAR(45) NOT NULL,
    "userAgent" VARCHAR(500),
    "changesBefore" JSONB,
    "changesAfter" JSONB,
    "status" INTEGER NOT NULL,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "executionTimeMs" INTEGER,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin"."AdminPermission" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "permission" "admin"."SpecificPermission" NOT NULL,
    "resource" "admin"."AdminResource",
    "grantedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedBy" TEXT,
    "expiresAt" TIMESTAMPTZ(6),

    CONSTRAINT "AdminPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin"."AdminAPIKey" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "keyHash" VARCHAR(255) NOT NULL,
    "keyPrefix" VARCHAR(20) NOT NULL,
    "scopes" JSONB NOT NULL,
    "rateLimit" INTEGER,
    "allowedIps" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMPTZ(6),
    "expiresAt" TIMESTAMPTZ(6),
    "revokedAt" TIMESTAMPTZ(6),

    CONSTRAINT "AdminAPIKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin"."AdminInvitation" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "role" "admin"."AdminRole" NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "invitedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "acceptedAt" TIMESTAMPTZ(6),

    CONSTRAINT "AdminInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin"."AdminSecurityEvent" (
    "id" TEXT NOT NULL,
    "eventType" "admin"."SecurityEventType" NOT NULL,
    "severity" "admin"."SecuritySeverity" NOT NULL,
    "adminId" TEXT,
    "ipAddress" VARCHAR(45) NOT NULL,
    "userAgent" VARCHAR(500),
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMPTZ(6),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminSecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing"."Subscription" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "tier" "billing"."SubscriptionTier" NOT NULL DEFAULT 'HOBBYIST',
    "status" "billing"."SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "monthlyCreditQuota" INTEGER NOT NULL DEFAULT 0,
    "creditResetDate" TIMESTAMPTZ(6),
    "maxCanvases" INTEGER NOT NULL DEFAULT 3,
    "maxActionPodsPerCanvas" INTEGER NOT NULL DEFAULT 50,
    "maxDocumentSizeInMB" INTEGER NOT NULL DEFAULT 10,
    "maxCollaboratorsPerCanvas" INTEGER NOT NULL DEFAULT 0,
    "canInviteToWorkspace" BOOLEAN NOT NULL DEFAULT false,
    "canInviteToCanvas" BOOLEAN NOT NULL DEFAULT false,
    "canCreatePublicLinks" BOOLEAN NOT NULL DEFAULT true,
    "canUseAdvancedModels" BOOLEAN NOT NULL DEFAULT false,
    "canAccessAnalytics" BOOLEAN NOT NULL DEFAULT false,
    "canExportData" BOOLEAN NOT NULL DEFAULT false,
    "nextBillingDate" TIMESTAMPTZ(6),
    "currentPeriodStart" TIMESTAMPTZ(6),
    "currentPeriodEnd" TIMESTAMPTZ(6),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "isByokMode" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing"."CreditPurchase" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "creditsPurchased" INTEGER NOT NULL,
    "amountPaid" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "stripeChargeId" TEXT NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'succeeded',
    "purchasedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing"."CreditUsageLog" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "canvasId" TEXT NOT NULL,
    "podId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "balanceBefore" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "provider" "core"."LLMProvider" NOT NULL,
    "modelId" VARCHAR(255) NOT NULL,
    "modelName" VARCHAR(255),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing"."ModelPricingTier" (
    "id" TEXT NOT NULL,
    "provider" "core"."LLMProvider" NOT NULL,
    "modelId" VARCHAR(255) NOT NULL,
    "category" "billing"."ModelCategory" NOT NULL,
    "displayName" VARCHAR(255) NOT NULL,
    "description" VARCHAR(500),
    "inputTokenCost" DECIMAL(12,8) NOT NULL,
    "outputTokenCost" DECIMAL(12,8) NOT NULL,
    "reasoningTokenCost" DECIMAL(12,8) NOT NULL DEFAULT 0,
    "creditsPerMillionInputTokens" INTEGER NOT NULL,
    "creditsPerMillionOutputTokens" INTEGER NOT NULL,
    "creditsPerMillionReasoningTokens" INTEGER NOT NULL DEFAULT 0,
    "maxTokens" INTEGER,
    "maxOutputTokens" INTEGER,
    "supportsStreaming" BOOLEAN NOT NULL DEFAULT true,
    "supportsVision" BOOLEAN NOT NULL DEFAULT false,
    "supportsAudio" BOOLEAN NOT NULL DEFAULT false,
    "supportsVideo" BOOLEAN NOT NULL DEFAULT false,
    "supportsFunctions" BOOLEAN NOT NULL DEFAULT false,
    "supportsJsonMode" BOOLEAN NOT NULL DEFAULT false,
    "supportsSystemPrompt" BOOLEAN NOT NULL DEFAULT true,
    "providerConfig" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMPTZ(6) NOT NULL,
    "effectiveUntil" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ModelPricingTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canvas"."Space" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" VARCHAR(1000),
    "customInstructions" TEXT,
    "icon" VARCHAR(50),
    "color" VARCHAR(7),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Space_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canvas"."Flow" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "spaceId" TEXT,
    "name" VARCHAR(255) NOT NULL,
    "description" VARCHAR(500),
    "version" INTEGER NOT NULL DEFAULT 1,
    "visibility" "canvas"."FlowVisibility" NOT NULL DEFAULT 'PRIVATE',
    "createdBy" TEXT NOT NULL,
    "thumbnailS3Key" VARCHAR(512),
    "thumbnailGeneratedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Flow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canvas"."FlowInvitation" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "accessLevel" "canvas"."FlowAccessLevel" NOT NULL DEFAULT 'EDITOR',
    "permissions" JSONB,
    "invitedBy" TEXT NOT NULL,
    "invitedUserId" TEXT,
    "token" VARCHAR(255) NOT NULL,
    "status" "core"."InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "acceptedAt" TIMESTAMPTZ(6),

    CONSTRAINT "FlowInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canvas"."FlowCollaborator" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessLevel" "canvas"."FlowAccessLevel" NOT NULL DEFAULT 'EDITOR',
    "canEdit" BOOLEAN NOT NULL DEFAULT true,
    "canExecute" BOOLEAN NOT NULL DEFAULT true,
    "canDelete" BOOLEAN NOT NULL DEFAULT false,
    "canShare" BOOLEAN NOT NULL DEFAULT false,
    "canInvite" BOOLEAN NOT NULL DEFAULT false,
    "invitedBy" TEXT,
    "invitedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastViewedAt" TIMESTAMPTZ(6),

    CONSTRAINT "FlowCollaborator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canvas"."FlowSession" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "userId" TEXT,
    "anonymousName" VARCHAR(100),
    "sessionToken" VARCHAR(255),
    "socketId" VARCHAR(255),
    "cursorPosition" JSONB,
    "selectedPodIds" JSONB,
    "viewportState" JSONB,
    "userColor" VARCHAR(7),
    "userAgent" VARCHAR(500),
    "ipAddress" VARCHAR(45),
    "connectedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastHeartbeatAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disconnectedAt" TIMESTAMPTZ(6),

    CONSTRAINT "FlowSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canvas"."FlowActivityLog" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "userId" TEXT,
    "action" "canvas"."FlowActivityAction" NOT NULL,
    "entityType" VARCHAR(50),
    "entityId" VARCHAR(255),
    "changeData" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlowActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canvas"."FlowComment" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "userId" TEXT,
    "content" TEXT NOT NULL,
    "position" JSONB,
    "podId" TEXT,
    "parentId" TEXT,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "FlowComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canvas"."Pod" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "type" "canvas"."PodType" NOT NULL,
    "position" JSONB NOT NULL,
    "executionStatus" "canvas"."PodExecutionStatus" NOT NULL DEFAULT 'IDLE',
    "lastExecutionId" TEXT,
    "contextFlowId" TEXT,
    "documentId" TEXT,
    "lockedBy" TEXT,
    "lockedAt" TIMESTAMPTZ(6),
    "dynamoPartitionKey" VARCHAR(255) NOT NULL,
    "dynamoSortKey" VARCHAR(255) NOT NULL,
    "s3VectorBucket" VARCHAR(255),
    "s3VectorKey" VARCHAR(512),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Pod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canvas"."Edge" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "sourcePodId" TEXT NOT NULL,
    "targetPodId" TEXT NOT NULL,
    "sourceHandle" VARCHAR(100),
    "targetHandle" VARCHAR(100),
    "animated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Edge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canvas"."PodExecution" (
    "id" TEXT NOT NULL,
    "podId" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "status" "canvas"."PodExecutionStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ(6),
    "runtimeInMs" INTEGER,
    "provider" "core"."LLMProvider" NOT NULL,
    "modelId" VARCHAR(255) NOT NULL,
    "modelName" VARCHAR(255),
    "providerMetadata" JSONB,
    "requestMetadata" JSONB,
    "responseMetadata" JSONB,
    "errorMessage" TEXT,
    "errorCode" VARCHAR(100),
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "reasoningTokens" INTEGER NOT NULL DEFAULT 0,
    "creditsConsumed" INTEGER NOT NULL DEFAULT 0,
    "costInUsd" DECIMAL(12,8),

    CONSTRAINT "PodExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canvas"."PodUsageLog" (
    "id" TEXT NOT NULL,
    "podId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "provider" "core"."LLMProvider" NOT NULL,
    "modelId" VARCHAR(255) NOT NULL,
    "modelName" VARCHAR(255),
    "providerMetadata" JSONB,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "reasoningTokens" INTEGER NOT NULL DEFAULT 0,
    "creditsConsumed" INTEGER NOT NULL DEFAULT 0,
    "runtimeInMs" INTEGER,
    "inputTokenCost" DECIMAL(12,8) NOT NULL,
    "outputTokenCost" DECIMAL(12,8) NOT NULL,
    "reasoningTokenCost" DECIMAL(12,8) NOT NULL,
    "totalCostInUsd" DECIMAL(12,8) NOT NULL,
    "executedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PodUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canvas"."ContextModule" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" VARCHAR(1000),
    "definitionJson" JSONB NOT NULL,
    "originalFlowId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ContextModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "hash" VARCHAR(255),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."RefreshToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "deviceName" VARCHAR(255) NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "core"."AuthProvider" NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."Workspace" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" "core"."WorkspaceType" NOT NULL DEFAULT 'PERSONAL',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."WorkspaceUser" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "role" "core"."WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    "canCreateCanvas" BOOLEAN NOT NULL DEFAULT true,
    "canDeleteCanvas" BOOLEAN NOT NULL DEFAULT false,
    "canManageBilling" BOOLEAN NOT NULL DEFAULT false,
    "canInviteMembers" BOOLEAN NOT NULL DEFAULT false,
    "canManageMembers" BOOLEAN NOT NULL DEFAULT false,
    "canManageApiKeys" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invitedBy" TEXT,

    CONSTRAINT "WorkspaceUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."WorkspaceInvitation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "role" "core"."WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    "permissions" JSONB,
    "invitedBy" TEXT NOT NULL,
    "invitedUserId" TEXT,
    "token" VARCHAR(255) NOT NULL,
    "status" "core"."InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "acceptedAt" TIMESTAMPTZ(6),

    CONSTRAINT "WorkspaceInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."ProviderAPIKey" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" "core"."LLMProvider" NOT NULL,
    "displayName" VARCHAR(100) NOT NULL,
    "keyHash" VARCHAR(255) NOT NULL,
    "providerConfig" JSONB,
    "endpoint" VARCHAR(500),
    "authType" "core"."AuthType" NOT NULL DEFAULT 'BEARER_TOKEN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(6),

    CONSTRAINT "ProviderAPIKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."ShareLink" (
    "id" TEXT NOT NULL,
    "publicToken" TEXT NOT NULL,
    "assetType" "core"."ShareableAssetType" NOT NULL,
    "assetId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "accessLevel" "core"."ShareAccessLevel" NOT NULL DEFAULT 'VIEW_ONLY',
    "password" VARCHAR(255),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(6),

    CONSTRAINT "ShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents"."DocumentFolder" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "parentId" TEXT,
    "icon" VARCHAR(50),
    "color" VARCHAR(7),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "DocumentFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents"."Document" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "folderId" TEXT,
    "name" VARCHAR(255) NOT NULL,
    "sourceType" "documents"."DocumentSourceType" NOT NULL DEFAULT 'INTERNAL',
    "storageKey" VARCHAR(512),
    "s3Bucket" VARCHAR(255),
    "externalUrl" VARCHAR(2048),
    "externalProvider" VARCHAR(50),
    "externalFileId" VARCHAR(512),
    "fileType" VARCHAR(100) NOT NULL,
    "mimeType" VARCHAR(255),
    "sizeInBytes" BIGINT,
    "status" "documents"."DocumentStatus" NOT NULL DEFAULT 'UPLOADING',
    "uploadedBy" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents"."Embedding" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "chunkText" TEXT NOT NULL,
    "s3VectorBucket" VARCHAR(255) NOT NULL,
    "s3VectorKey" VARCHAR(512) NOT NULL,
    "vectorDimension" INTEGER NOT NULL DEFAULT 1536,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Embedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents"."DocumentProcessingCost" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "processingType" "documents"."DocumentProcessingType" NOT NULL,
    "creditsConsumed" INTEGER NOT NULL DEFAULT 0,
    "extractionCost" DECIMAL(12,8) NOT NULL DEFAULT 0,
    "embeddingCost" DECIMAL(12,8) NOT NULL DEFAULT 0,
    "totalCostInUsd" DECIMAL(12,8) NOT NULL,
    "chunkCount" INTEGER,
    "embeddingModel" VARCHAR(100),
    "processingTimeMs" INTEGER,
    "tokensProcessed" INTEGER NOT NULL DEFAULT 0,
    "processedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentProcessingCost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "admin"."Admin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_username_key" ON "admin"."Admin"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_passwordResetToken_key" ON "admin"."Admin"("passwordResetToken");

-- CreateIndex
CREATE INDEX "Admin_email_status_idx" ON "admin"."Admin"("email", "status");

-- CreateIndex
CREATE INDEX "Admin_username_idx" ON "admin"."Admin"("username");

-- CreateIndex
CREATE INDEX "Admin_status_role_idx" ON "admin"."Admin"("status", "role");

-- CreateIndex
CREATE INDEX "Admin_lastLoginAt_idx" ON "admin"."Admin"("lastLoginAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminSession_token_key" ON "admin"."AdminSession"("token");

-- CreateIndex
CREATE UNIQUE INDEX "AdminSession_refreshToken_key" ON "admin"."AdminSession"("refreshToken");

-- CreateIndex
CREATE INDEX "AdminSession_adminId_revokedAt_expiresAt_idx" ON "admin"."AdminSession"("adminId", "revokedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "AdminSession_token_idx" ON "admin"."AdminSession"("token");

-- CreateIndex
CREATE INDEX "AdminSession_expiresAt_idx" ON "admin"."AdminSession"("expiresAt");

-- CreateIndex
CREATE INDEX "AdminSession_ipAddress_createdAt_idx" ON "admin"."AdminSession"("ipAddress", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_adminId_createdAt_idx" ON "admin"."AdminAuditLog"("adminId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AdminAuditLog_action_createdAt_idx" ON "admin"."AdminAuditLog"("action", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AdminAuditLog_resource_resourceId_idx" ON "admin"."AdminAuditLog"("resource", "resourceId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_ipAddress_createdAt_idx" ON "admin"."AdminAuditLog"("ipAddress", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "admin"."AdminAuditLog"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "AdminPermission_adminId_idx" ON "admin"."AdminPermission"("adminId");

-- CreateIndex
CREATE INDEX "AdminPermission_permission_resource_idx" ON "admin"."AdminPermission"("permission", "resource");

-- CreateIndex
CREATE INDEX "AdminPermission_expiresAt_idx" ON "admin"."AdminPermission"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminPermission_adminId_permission_resource_key" ON "admin"."AdminPermission"("adminId", "permission", "resource");

-- CreateIndex
CREATE UNIQUE INDEX "AdminAPIKey_keyHash_key" ON "admin"."AdminAPIKey"("keyHash");

-- CreateIndex
CREATE INDEX "AdminAPIKey_adminId_idx" ON "admin"."AdminAPIKey"("adminId");

-- CreateIndex
CREATE INDEX "AdminAPIKey_keyHash_idx" ON "admin"."AdminAPIKey"("keyHash");

-- CreateIndex
CREATE INDEX "AdminAPIKey_expiresAt_revokedAt_idx" ON "admin"."AdminAPIKey"("expiresAt", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminInvitation_token_key" ON "admin"."AdminInvitation"("token");

-- CreateIndex
CREATE INDEX "AdminInvitation_token_expiresAt_idx" ON "admin"."AdminInvitation"("token", "expiresAt");

-- CreateIndex
CREATE INDEX "AdminInvitation_email_idx" ON "admin"."AdminInvitation"("email");

-- CreateIndex
CREATE INDEX "AdminSecurityEvent_eventType_severity_createdAt_idx" ON "admin"."AdminSecurityEvent"("eventType", "severity", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AdminSecurityEvent_adminId_createdAt_idx" ON "admin"."AdminSecurityEvent"("adminId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AdminSecurityEvent_resolved_severity_idx" ON "admin"."AdminSecurityEvent"("resolved", "severity");

-- CreateIndex
CREATE INDEX "AdminSecurityEvent_ipAddress_createdAt_idx" ON "admin"."AdminSecurityEvent"("ipAddress", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_workspaceId_key" ON "billing"."Subscription"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeCustomerId_key" ON "billing"."Subscription"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "billing"."Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_status_nextBillingDate_idx" ON "billing"."Subscription"("status", "nextBillingDate");

-- CreateIndex
CREATE INDEX "Subscription_tier_status_idx" ON "billing"."Subscription"("tier", "status");

-- CreateIndex
CREATE INDEX "Subscription_creditResetDate_idx" ON "billing"."Subscription"("creditResetDate");

-- CreateIndex
CREATE UNIQUE INDEX "CreditPurchase_stripeChargeId_key" ON "billing"."CreditPurchase"("stripeChargeId");

-- CreateIndex
CREATE INDEX "CreditPurchase_subscriptionId_purchasedAt_idx" ON "billing"."CreditPurchase"("subscriptionId", "purchasedAt" DESC);

-- CreateIndex
CREATE INDEX "CreditPurchase_stripeChargeId_idx" ON "billing"."CreditPurchase"("stripeChargeId");

-- CreateIndex
CREATE INDEX "CreditUsageLog_subscriptionId_createdAt_idx" ON "billing"."CreditUsageLog"("subscriptionId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "CreditUsageLog_workspaceId_createdAt_idx" ON "billing"."CreditUsageLog"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "CreditUsageLog_executionId_idx" ON "billing"."CreditUsageLog"("executionId");

-- CreateIndex
CREATE INDEX "CreditUsageLog_provider_modelId_createdAt_idx" ON "billing"."CreditUsageLog"("provider", "modelId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ModelPricingTier_provider_modelId_isActive_effectiveFrom_idx" ON "billing"."ModelPricingTier"("provider", "modelId", "isActive", "effectiveFrom");

-- CreateIndex
CREATE INDEX "ModelPricingTier_provider_category_isActive_idx" ON "billing"."ModelPricingTier"("provider", "category", "isActive");

-- CreateIndex
CREATE INDEX "ModelPricingTier_isActive_effectiveFrom_idx" ON "billing"."ModelPricingTier"("isActive", "effectiveFrom");

-- CreateIndex
CREATE INDEX "ModelPricingTier_category_isActive_idx" ON "billing"."ModelPricingTier"("category", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ModelPricingTier_provider_modelId_effectiveFrom_key" ON "billing"."ModelPricingTier"("provider", "modelId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "Space_workspaceId_updatedAt_idx" ON "canvas"."Space"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "Space_workspaceId_createdAt_idx" ON "canvas"."Space"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Space_workspaceId_name_key" ON "canvas"."Space"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "Flow_spaceId_updatedAt_idx" ON "canvas"."Flow"("spaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "Flow_spaceId_createdAt_idx" ON "canvas"."Flow"("spaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Flow_workspaceId_updatedAt_idx" ON "canvas"."Flow"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "Flow_workspaceId_createdAt_idx" ON "canvas"."Flow"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Flow_workspaceId_visibility_idx" ON "canvas"."Flow"("workspaceId", "visibility");

-- CreateIndex
CREATE INDEX "Flow_createdBy_createdAt_idx" ON "canvas"."Flow"("createdBy", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "FlowInvitation_token_key" ON "canvas"."FlowInvitation"("token");

-- CreateIndex
CREATE INDEX "FlowInvitation_flowId_status_idx" ON "canvas"."FlowInvitation"("flowId", "status");

-- CreateIndex
CREATE INDEX "FlowInvitation_email_status_idx" ON "canvas"."FlowInvitation"("email", "status");

-- CreateIndex
CREATE INDEX "FlowInvitation_token_expiresAt_idx" ON "canvas"."FlowInvitation"("token", "expiresAt");

-- CreateIndex
CREATE INDEX "FlowCollaborator_userId_idx" ON "canvas"."FlowCollaborator"("userId");

-- CreateIndex
CREATE INDEX "FlowCollaborator_flowId_accessLevel_idx" ON "canvas"."FlowCollaborator"("flowId", "accessLevel");

-- CreateIndex
CREATE UNIQUE INDEX "FlowCollaborator_flowId_userId_key" ON "canvas"."FlowCollaborator"("flowId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "FlowSession_sessionToken_key" ON "canvas"."FlowSession"("sessionToken");

-- CreateIndex
CREATE INDEX "FlowSession_flowId_disconnectedAt_idx" ON "canvas"."FlowSession"("flowId", "disconnectedAt");

-- CreateIndex
CREATE INDEX "FlowSession_socketId_idx" ON "canvas"."FlowSession"("socketId");

-- CreateIndex
CREATE INDEX "FlowSession_flowId_userId_disconnectedAt_idx" ON "canvas"."FlowSession"("flowId", "userId", "disconnectedAt");

-- CreateIndex
CREATE INDEX "FlowSession_lastHeartbeatAt_idx" ON "canvas"."FlowSession"("lastHeartbeatAt");

-- CreateIndex
CREATE INDEX "FlowSession_sessionToken_idx" ON "canvas"."FlowSession"("sessionToken");

-- CreateIndex
CREATE INDEX "FlowActivityLog_flowId_createdAt_idx" ON "canvas"."FlowActivityLog"("flowId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "FlowActivityLog_userId_createdAt_idx" ON "canvas"."FlowActivityLog"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "FlowActivityLog_action_createdAt_idx" ON "canvas"."FlowActivityLog"("action", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "FlowComment_flowId_createdAt_idx" ON "canvas"."FlowComment"("flowId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "FlowComment_userId_createdAt_idx" ON "canvas"."FlowComment"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "FlowComment_podId_idx" ON "canvas"."FlowComment"("podId");

-- CreateIndex
CREATE INDEX "FlowComment_parentId_idx" ON "canvas"."FlowComment"("parentId");

-- CreateIndex
CREATE INDEX "FlowComment_isResolved_idx" ON "canvas"."FlowComment"("isResolved");

-- CreateIndex
CREATE INDEX "Pod_flowId_type_executionStatus_idx" ON "canvas"."Pod"("flowId", "type", "executionStatus");

-- CreateIndex
CREATE INDEX "Pod_contextFlowId_idx" ON "canvas"."Pod"("contextFlowId");

-- CreateIndex
CREATE INDEX "Pod_documentId_idx" ON "canvas"."Pod"("documentId");

-- CreateIndex
CREATE INDEX "Pod_executionStatus_updatedAt_idx" ON "canvas"."Pod"("executionStatus", "updatedAt");

-- CreateIndex
CREATE INDEX "Pod_s3VectorBucket_s3VectorKey_idx" ON "canvas"."Pod"("s3VectorBucket", "s3VectorKey");

-- CreateIndex
CREATE INDEX "Pod_lockedBy_lockedAt_idx" ON "canvas"."Pod"("lockedBy", "lockedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Pod_dynamoPartitionKey_dynamoSortKey_key" ON "canvas"."Pod"("dynamoPartitionKey", "dynamoSortKey");

-- CreateIndex
CREATE INDEX "Edge_flowId_idx" ON "canvas"."Edge"("flowId");

-- CreateIndex
CREATE INDEX "Edge_sourcePodId_idx" ON "canvas"."Edge"("sourcePodId");

-- CreateIndex
CREATE INDEX "Edge_targetPodId_idx" ON "canvas"."Edge"("targetPodId");

-- CreateIndex
CREATE UNIQUE INDEX "Edge_flowId_sourcePodId_sourceHandle_targetPodId_targetHand_key" ON "canvas"."Edge"("flowId", "sourcePodId", "sourceHandle", "targetPodId", "targetHandle");

-- CreateIndex
CREATE INDEX "PodExecution_podId_startedAt_idx" ON "canvas"."PodExecution"("podId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "PodExecution_workspaceId_status_startedAt_idx" ON "canvas"."PodExecution"("workspaceId", "status", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "PodExecution_flowId_status_startedAt_idx" ON "canvas"."PodExecution"("flowId", "status", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "PodExecution_status_startedAt_idx" ON "canvas"."PodExecution"("status", "startedAt");

-- CreateIndex
CREATE INDEX "PodExecution_provider_modelId_startedAt_idx" ON "canvas"."PodExecution"("provider", "modelId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "PodExecution_provider_status_idx" ON "canvas"."PodExecution"("provider", "status");

-- CreateIndex
CREATE INDEX "PodUsageLog_workspaceId_executedAt_idx" ON "canvas"."PodUsageLog"("workspaceId", "executedAt" DESC);

-- CreateIndex
CREATE INDEX "PodUsageLog_subscriptionId_executedAt_idx" ON "canvas"."PodUsageLog"("subscriptionId", "executedAt" DESC);

-- CreateIndex
CREATE INDEX "PodUsageLog_executionId_idx" ON "canvas"."PodUsageLog"("executionId");

-- CreateIndex
CREATE INDEX "PodUsageLog_podId_executedAt_idx" ON "canvas"."PodUsageLog"("podId", "executedAt" DESC);

-- CreateIndex
CREATE INDEX "PodUsageLog_flowId_executedAt_idx" ON "canvas"."PodUsageLog"("flowId", "executedAt" DESC);

-- CreateIndex
CREATE INDEX "PodUsageLog_provider_modelId_executedAt_idx" ON "canvas"."PodUsageLog"("provider", "modelId", "executedAt" DESC);

-- CreateIndex
CREATE INDEX "PodUsageLog_provider_executedAt_idx" ON "canvas"."PodUsageLog"("provider", "executedAt" DESC);

-- CreateIndex
CREATE INDEX "ContextModule_workspaceId_updatedAt_idx" ON "canvas"."ContextModule"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "ContextModule_originalFlowId_idx" ON "canvas"."ContextModule"("originalFlowId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "core"."User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "core"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "core"."RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_expiresAt_idx" ON "core"."RefreshToken"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "RefreshToken_token_expiresAt_idx" ON "core"."RefreshToken"("token", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_userId_deviceName_key" ON "core"."RefreshToken"("userId", "deviceName");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "core"."Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "core"."Account"("provider", "providerAccountId");

-- CreateIndex
CREATE INDEX "Workspace_type_createdAt_idx" ON "core"."Workspace"("type", "createdAt");

-- CreateIndex
CREATE INDEX "WorkspaceUser_workspaceId_role_idx" ON "core"."WorkspaceUser"("workspaceId", "role");

-- CreateIndex
CREATE INDEX "WorkspaceUser_userId_idx" ON "core"."WorkspaceUser"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceUser_userId_workspaceId_key" ON "core"."WorkspaceUser"("userId", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceInvitation_token_key" ON "core"."WorkspaceInvitation"("token");

-- CreateIndex
CREATE INDEX "WorkspaceInvitation_workspaceId_status_idx" ON "core"."WorkspaceInvitation"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "WorkspaceInvitation_email_status_idx" ON "core"."WorkspaceInvitation"("email", "status");

-- CreateIndex
CREATE INDEX "WorkspaceInvitation_token_expiresAt_idx" ON "core"."WorkspaceInvitation"("token", "expiresAt");

-- CreateIndex
CREATE INDEX "ProviderAPIKey_workspaceId_isActive_idx" ON "core"."ProviderAPIKey"("workspaceId", "isActive");

-- CreateIndex
CREATE INDEX "ProviderAPIKey_provider_isActive_idx" ON "core"."ProviderAPIKey"("provider", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAPIKey_workspaceId_provider_displayName_key" ON "core"."ProviderAPIKey"("workspaceId", "provider", "displayName");

-- CreateIndex
CREATE UNIQUE INDEX "ShareLink_publicToken_key" ON "core"."ShareLink"("publicToken");

-- CreateIndex
CREATE INDEX "ShareLink_publicToken_expiresAt_idx" ON "core"."ShareLink"("publicToken", "expiresAt");

-- CreateIndex
CREATE INDEX "ShareLink_workspaceId_assetType_idx" ON "core"."ShareLink"("workspaceId", "assetType");

-- CreateIndex
CREATE INDEX "ShareLink_createdBy_createdAt_idx" ON "core"."ShareLink"("createdBy", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShareLink_assetType_assetId_key" ON "core"."ShareLink"("assetType", "assetId");

-- CreateIndex
CREATE INDEX "DocumentFolder_workspaceId_parentId_sortOrder_idx" ON "documents"."DocumentFolder"("workspaceId", "parentId", "sortOrder");

-- CreateIndex
CREATE INDEX "DocumentFolder_parentId_sortOrder_idx" ON "documents"."DocumentFolder"("parentId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentFolder_workspaceId_parentId_name_key" ON "documents"."DocumentFolder"("workspaceId", "parentId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Document_storageKey_key" ON "documents"."Document"("storageKey");

-- CreateIndex
CREATE INDEX "Document_workspaceId_folderId_status_createdAt_idx" ON "documents"."Document"("workspaceId", "folderId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Document_workspaceId_status_createdAt_idx" ON "documents"."Document"("workspaceId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Document_workspaceId_sourceType_createdAt_idx" ON "documents"."Document"("workspaceId", "sourceType", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Document_folderId_createdAt_idx" ON "documents"."Document"("folderId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Document_storageKey_idx" ON "documents"."Document"("storageKey");

-- CreateIndex
CREATE INDEX "Document_status_updatedAt_idx" ON "documents"."Document"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "Document_fileType_workspaceId_idx" ON "documents"."Document"("fileType", "workspaceId");

-- CreateIndex
CREATE INDEX "Document_externalProvider_externalFileId_idx" ON "documents"."Document"("externalProvider", "externalFileId");

-- CreateIndex
CREATE INDEX "Embedding_documentId_createdAt_idx" ON "documents"."Embedding"("documentId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Embedding_model_createdAt_idx" ON "documents"."Embedding"("model", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Embedding_s3VectorBucket_idx" ON "documents"."Embedding"("s3VectorBucket");

-- CreateIndex
CREATE UNIQUE INDEX "Embedding_documentId_chunkIndex_key" ON "documents"."Embedding"("documentId", "chunkIndex");

-- CreateIndex
CREATE UNIQUE INDEX "Embedding_s3VectorBucket_s3VectorKey_key" ON "documents"."Embedding"("s3VectorBucket", "s3VectorKey");

-- CreateIndex
CREATE INDEX "DocumentProcessingCost_documentId_processedAt_idx" ON "documents"."DocumentProcessingCost"("documentId", "processedAt" DESC);

-- CreateIndex
CREATE INDEX "DocumentProcessingCost_workspaceId_processedAt_idx" ON "documents"."DocumentProcessingCost"("workspaceId", "processedAt" DESC);

-- CreateIndex
CREATE INDEX "DocumentProcessingCost_subscriptionId_processedAt_idx" ON "documents"."DocumentProcessingCost"("subscriptionId", "processedAt" DESC);

-- CreateIndex
CREATE INDEX "DocumentProcessingCost_processingType_processedAt_idx" ON "documents"."DocumentProcessingCost"("processingType", "processedAt" DESC);

-- AddForeignKey
ALTER TABLE "admin"."AdminSession" ADD CONSTRAINT "AdminSession_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admin"."Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin"."AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admin"."Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin"."AdminPermission" ADD CONSTRAINT "AdminPermission_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admin"."Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin"."AdminAPIKey" ADD CONSTRAINT "AdminAPIKey_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admin"."Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin"."AdminInvitation" ADD CONSTRAINT "AdminInvitation_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "admin"."Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing"."Subscription" ADD CONSTRAINT "Subscription_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "core"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing"."CreditPurchase" ADD CONSTRAINT "CreditPurchase_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "billing"."Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing"."CreditUsageLog" ADD CONSTRAINT "CreditUsageLog_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "billing"."Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas"."Space" ADD CONSTRAINT "Space_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "core"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas"."Flow" ADD CONSTRAINT "Flow_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "core"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas"."Flow" ADD CONSTRAINT "Flow_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "canvas"."Space"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas"."FlowInvitation" ADD CONSTRAINT "FlowInvitation_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "canvas"."Flow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas"."FlowInvitation" ADD CONSTRAINT "FlowInvitation_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas"."FlowInvitation" ADD CONSTRAINT "FlowInvitation_invitedUserId_fkey" FOREIGN KEY ("invitedUserId") REFERENCES "core"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas"."FlowCollaborator" ADD CONSTRAINT "FlowCollaborator_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "canvas"."Flow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas"."FlowCollaborator" ADD CONSTRAINT "FlowCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas"."FlowSession" ADD CONSTRAINT "FlowSession_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "canvas"."Flow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas"."FlowActivityLog" ADD CONSTRAINT "FlowActivityLog_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "canvas"."Flow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas"."FlowComment" ADD CONSTRAINT "FlowComment_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "canvas"."Flow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas"."Pod" ADD CONSTRAINT "Pod_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "canvas"."Flow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas"."Pod" ADD CONSTRAINT "Pod_contextFlowId_fkey" FOREIGN KEY ("contextFlowId") REFERENCES "canvas"."Flow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas"."Pod" ADD CONSTRAINT "Pod_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"."Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas"."Edge" ADD CONSTRAINT "Edge_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "canvas"."Flow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas"."Edge" ADD CONSTRAINT "Edge_sourcePodId_fkey" FOREIGN KEY ("sourcePodId") REFERENCES "canvas"."Pod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas"."Edge" ADD CONSTRAINT "Edge_targetPodId_fkey" FOREIGN KEY ("targetPodId") REFERENCES "canvas"."Pod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas"."PodExecution" ADD CONSTRAINT "PodExecution_podId_fkey" FOREIGN KEY ("podId") REFERENCES "canvas"."Pod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas"."PodUsageLog" ADD CONSTRAINT "PodUsageLog_podId_fkey" FOREIGN KEY ("podId") REFERENCES "canvas"."Pod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas"."PodUsageLog" ADD CONSTRAINT "PodUsageLog_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "billing"."Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas"."ContextModule" ADD CONSTRAINT "ContextModule_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "core"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas"."ContextModule" ADD CONSTRAINT "ContextModule_originalFlowId_fkey" FOREIGN KEY ("originalFlowId") REFERENCES "canvas"."Flow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."WorkspaceUser" ADD CONSTRAINT "WorkspaceUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."WorkspaceUser" ADD CONSTRAINT "WorkspaceUser_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "core"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."WorkspaceInvitation" ADD CONSTRAINT "WorkspaceInvitation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "core"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."WorkspaceInvitation" ADD CONSTRAINT "WorkspaceInvitation_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."WorkspaceInvitation" ADD CONSTRAINT "WorkspaceInvitation_invitedUserId_fkey" FOREIGN KEY ("invitedUserId") REFERENCES "core"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."ProviderAPIKey" ADD CONSTRAINT "ProviderAPIKey_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "core"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."ShareLink" ADD CONSTRAINT "ShareLink_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "core"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents"."DocumentFolder" ADD CONSTRAINT "DocumentFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "documents"."DocumentFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents"."DocumentFolder" ADD CONSTRAINT "DocumentFolder_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "core"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents"."Document" ADD CONSTRAINT "Document_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "core"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents"."Document" ADD CONSTRAINT "Document_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "documents"."DocumentFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents"."Embedding" ADD CONSTRAINT "Embedding_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"."Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents"."DocumentProcessingCost" ADD CONSTRAINT "DocumentProcessingCost_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"."Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents"."DocumentProcessingCost" ADD CONSTRAINT "DocumentProcessingCost_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "billing"."Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
