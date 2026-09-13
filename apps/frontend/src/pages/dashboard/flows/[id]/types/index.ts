// File: apps/frontend/src/pages/dashboard/types/index.ts

// ==========================================
// ENUMS (matching backend Prisma schema)
// ==========================================

export enum PodExecutionStatus {
  IDLE = 'IDLE',
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
  CANCELLED = 'CANCELLED',
}

export enum LLMProvider {
  OPENAI = 'OPENAI',
  ANTHROPIC = 'ANTHROPIC',
  GOOGLE_GEMINI = 'GOOGLE_GEMINI',
  XAI = 'XAI',
  PERPLEXITY = 'PERPLEXITY',
  MISTRAL = 'MISTRAL',
  COHERE = 'COHERE',
  GROQ = 'GROQ',
  DEEPSEEK = 'DEEPSEEK',
  CUSTOM = 'CUSTOM',
}

export enum PodType {
  TEXT_INPUT = 'TEXT_INPUT',
  DOCUMENT_INPUT = 'DOCUMENT_INPUT',
  URL_INPUT = 'URL_INPUT',
  IMAGE_INPUT = 'IMAGE_INPUT',
  VIDEO_INPUT = 'VIDEO_INPUT',
  AUDIO_INPUT = 'AUDIO_INPUT',
  LLM_PROMPT = 'LLM_PROMPT',
  EMBEDDING_POD = 'EMBEDDING_POD',
  TOOL_POD = 'TOOL_POD',
  TEXT_OUTPUT = 'TEXT_OUTPUT',
  IMAGE_OUTPUT = 'IMAGE_OUTPUT',
  VIDEO_OUTPUT = 'VIDEO_OUTPUT',
  AUDIO_OUTPUT = 'AUDIO_OUTPUT',
  CONTEXT_MODULE = 'CONTEXT_MODULE',
  FLOW_CONTEXT_INPUT = 'FLOW_CONTEXT_INPUT',
  CODE_EXECUTION = 'CODE_EXECUTION',
}

export enum FlowVisibility {
  PRIVATE = 'PRIVATE',
  WORKSPACE = 'WORKSPACE',
  PUBLIC = 'PUBLIC',
}

// ==========================================
// POD TYPES
// ==========================================

export interface LLMPodConfig {
  provider: LLMProvider;
  model: string;
  temperature?: number;
  maxTokens?: number;
  autoContext?: boolean;
  ragThreshold?: number;
  ragMaxResults?: number;
  systemPrompt?: string;
  userPrompt?: string;
  topP?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  responseFormat?: 'text' | 'json' | 'json_object';
  thinkingBudget?: number;
}

export interface SourcePodConfig {
  sourceType: 'text' | 'document' | 'url' | 'image' | 'video' | 'audio' | 'youtube';
  content?: string;
  url?: string;
  fileId?: string;
}

export interface PodData {
  label: string;
  config: LLMPodConfig | SourcePodConfig | Record<string, any>;
  executionStatus: PodExecutionStatus;
  lastExecutionId?: string | null;
  backendType?: PodType;
}

export interface LLMPodData extends PodData {
  config: LLMPodConfig;
  messages?: Message[];
  streamingContent?: string;
  isExecuting?: boolean;
}

export interface SourcePodData extends PodData {
  config: SourcePodConfig;
}

// ==========================================
// EXECUTION TYPES
// ==========================================

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  executionId?: string;
  isStreaming?: boolean;
  isThinking?: boolean;
  metadata?: {
    runtime?: number;
    tokens?: number;
    cost?: string;
    inputTokens?: number;
    outputTokens?: number;
    reasoningTokens?: number;
  };
}

// UPDATED: Matches backend response exactly
export interface Execution {
  id: string;
  podId: string;
  flowId: string;
  status: PodExecutionStatus;
  provider: LLMProvider;
  modelId: string;
  modelName: string | null;

  // Token fields
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;

  // Cost and runtime
  costInUsd: string | null;
  runtimeInMs: number | null;

  // Timestamps
  startedAt: string;
  finishedAt: string | null;

  // Metadata
  requestMetadata: any;
  responseMetadata: any;

  // Error info
  errorMessage: string | null;
  errorCode: string | null;
}

// ==========================================
// FLOW TYPES
// ==========================================

export interface Flow {
  id: string;
  workspaceId: string;
  spaceId: string | null;
  name: string;
  description: string | null;
  version: number;
  visibility: FlowVisibility;
  createdBy: string;
  thumbnailS3Key: string | null;
  thumbnailGeneratedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  podCount?: number;
  collaboratorCount?: number;
}

export interface FlowPagination {
  totalItems: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

export interface FlowsResponse {
  data: Flow[];
  pagination: FlowPagination;
}

// ==========================================
// MODEL TYPES
// ==========================================

export interface ModelInfo {
  modelId: string;
  modelName: string;
  provider: LLMProvider;
  contextWindow: number;
  maxOutputTokens: number;
  pricing?: {
    inputCost: number;
    outputCost: number;
  };
}

// ==========================================
// API RESPONSE TYPES
// ==========================================

export interface ApiResponse<T> {
  statusCode: number;
  message: string;
  data: T;
  timestamp: string;
  errors?: string[];
  pagination?: FlowPagination;
}

// ==========================================
// UTILITY TYPES
// ==========================================

export type PodVariant = 'input' | 'process' | 'output';

export interface Position {
  x: number;
  y: number;
}
