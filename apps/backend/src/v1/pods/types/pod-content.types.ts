import { LLMProvider } from '@flopods/schema';

// ==========================================
// CORE TYPES
// ==========================================

export type PodPort = {
  id: string;
  label: string;
  type: 'source' | 'target';
  dataType:
    | 'string'
    | 'number'
    | 'boolean'
    | 'object'
    | 'array'
    | 'document'
    | 'image'
    | 'video'
    | 'audio'
    | 'any';
};

export type Position = {
  x: number;
  y: number;
};

// ==========================================
// POD CONFIGURATIONS (TYPE-SPECIFIC)
// ==========================================

export type LLMConfig = {
  provider: LLMProvider;
  model: string;
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  thinkingBudget?: number;
  topP?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  responseFormat?: 'text' | 'json' | 'json_object';
  streamEnabled?: boolean;
  autoContext?: boolean;
};

export type TextInputConfig = {
  text: string;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
};

export type DocumentInputConfig = {
  documentId: string;
  extractionType: 'full' | 'chunk';
  chunkSize?: number;
  chunkOverlap?: number;
};

export type URLInputConfig = {
  url: string;
  extractionType: 'full' | 'summary';
  timeout?: number;
};

export type ImageInputConfig = {
  imageUrl?: string;
  imageS3Key?: string;
  altText?: string;
};

export type VideoInputConfig = {
  videoUrl?: string;
  videoS3Key?: string;
  transcriptionEnabled?: boolean;
};

export type AudioInputConfig = {
  audioUrl?: string;
  audioS3Key?: string;
  transcriptionEnabled?: boolean;
};

export type CodeExecutionConfig = {
  language: 'javascript' | 'python' | 'typescript';
  code: string;
  timeout?: number;
};

export type EmbeddingConfig = {
  provider: LLMProvider;
  model: string;
  dimensions?: number;
};

export type ToolConfig = {
  toolName: string;
  toolParameters: Record<string, any>;
};

export type OutputConfig = {
  format?: 'text' | 'json' | 'markdown';
  saveToS3?: boolean;
};

export type ContextModuleConfig = {
  contextModuleId: string;
  parameters?: Record<string, any>;
};

export type FlowContextInputConfig = {
  sourceFlowId: string;
  selectedPodIds?: string[];
};

// ==========================================
// UNIFIED POD CONTENT (ALL TYPES)
// ==========================================

export type PodContent =
  | {
      type: 'LLM_PROMPT';
      label: string;
      description?: string;
      position: Position;
      config: LLMConfig;
      inputs: PodPort[];
      outputs: PodPort[];
      metadata?: Record<string, any>;
    }
  | {
      type: 'TEXT_INPUT';
      label: string;
      description?: string;
      position: Position;
      config: TextInputConfig;
      inputs: PodPort[];
      outputs: PodPort[];
      metadata?: Record<string, any>;
    }
  | {
      type: 'DOCUMENT_INPUT';
      label: string;
      description?: string;
      position: Position;
      config: DocumentInputConfig;
      inputs: PodPort[];
      outputs: PodPort[];
      metadata?: Record<string, any>;
    }
  | {
      type: 'URL_INPUT';
      label: string;
      description?: string;
      position: Position;
      config: URLInputConfig;
      inputs: PodPort[];
      outputs: PodPort[];
      metadata?: Record<string, any>;
    }
  | {
      type: 'IMAGE_INPUT';
      label: string;
      description?: string;
      position: Position;
      config: ImageInputConfig;
      inputs: PodPort[];
      outputs: PodPort[];
      metadata?: Record<string, any>;
    }
  | {
      type: 'VIDEO_INPUT';
      label: string;
      description?: string;
      position: Position;
      config: VideoInputConfig;
      inputs: PodPort[];
      outputs: PodPort[];
      metadata?: Record<string, any>;
    }
  | {
      type: 'AUDIO_INPUT';
      label: string;
      description?: string;
      position: Position;
      config: AudioInputConfig;
      inputs: PodPort[];
      outputs: PodPort[];
      metadata?: Record<string, any>;
    }
  | {
      type: 'CODE_EXECUTION';
      label: string;
      description?: string;
      position: Position;
      config: CodeExecutionConfig;
      inputs: PodPort[];
      outputs: PodPort[];
      metadata?: Record<string, any>;
    }
  | {
      type: 'EMBEDDING_POD';
      label: string;
      description?: string;
      position: Position;
      config: EmbeddingConfig;
      inputs: PodPort[];
      outputs: PodPort[];
      metadata?: Record<string, any>;
    }
  | {
      type: 'TOOL_POD';
      label: string;
      description?: string;
      position: Position;
      config: ToolConfig;
      inputs: PodPort[];
      outputs: PodPort[];
      metadata?: Record<string, any>;
    }
  | {
      type: 'TEXT_OUTPUT';
      label: string;
      description?: string;
      position: Position;
      config: OutputConfig;
      inputs: PodPort[];
      outputs: PodPort[];
      metadata?: Record<string, any>;
    }
  | {
      type: 'IMAGE_OUTPUT';
      label: string;
      description?: string;
      position: Position;
      config: OutputConfig;
      inputs: PodPort[];
      outputs: PodPort[];
      metadata?: Record<string, any>;
    }
  | {
      type: 'VIDEO_OUTPUT';
      label: string;
      description?: string;
      position: Position;
      config: OutputConfig;
      inputs: PodPort[];
      outputs: PodPort[];
      metadata?: Record<string, any>;
    }
  | {
      type: 'AUDIO_OUTPUT';
      label: string;
      description?: string;
      position: Position;
      config: OutputConfig;
      inputs: PodPort[];
      outputs: PodPort[];
      metadata?: Record<string, any>;
    }
  | {
      type: 'CONTEXT_MODULE';
      label: string;
      description?: string;
      position: Position;
      config: ContextModuleConfig;
      inputs: PodPort[];
      outputs: PodPort[];
      metadata?: Record<string, any>;
    }
  | {
      type: 'FLOW_CONTEXT_INPUT';
      label: string;
      description?: string;
      position: Position;
      config: FlowContextInputConfig;
      inputs: PodPort[];
      outputs: PodPort[];
      metadata?: Record<string, any>;
    };

// ==========================================
// CONTEXT MAPPINGS (PINNED EXECUTIONS)
// ==========================================

export type PodContextMapping = {
  sourcePodId: string;
  pinnedExecutionId: string | null;
};

// ==========================================
// DYNAMODB POD ITEM
// ==========================================

export type DynamoPodItem = {
  pk: string;
  sk: string;
  gsi1pk: string;
  gsi1sk: string;
  podId: string;
  flowId: string;
  workspaceId: string;
  content: PodContent;
  connectedPods: string[];
  contextPods: string[];
  contextMappings?: PodContextMapping[];
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  ttl?: number;
};

// ==========================================
// TYPE GUARDS (ALL POD TYPES)
// ==========================================

export type LLMPromptPodContent = Extract<PodContent, { type: 'LLM_PROMPT' }>;
export type TextInputPodContent = Extract<PodContent, { type: 'TEXT_INPUT' }>;
export type DocumentInputPodContent = Extract<PodContent, { type: 'DOCUMENT_INPUT' }>;
export type URLInputPodContent = Extract<PodContent, { type: 'URL_INPUT' }>;
export type ImageInputPodContent = Extract<PodContent, { type: 'IMAGE_INPUT' }>;
export type VideoInputPodContent = Extract<PodContent, { type: 'VIDEO_INPUT' }>;
export type AudioInputPodContent = Extract<PodContent, { type: 'AUDIO_INPUT' }>;
export type CodeExecutionPodContent = Extract<PodContent, { type: 'CODE_EXECUTION' }>;
export type EmbeddingPodContent = Extract<PodContent, { type: 'EMBEDDING_POD' }>;
export type ToolPodContent = Extract<PodContent, { type: 'TOOL_POD' }>;
export type TextOutputPodContent = Extract<PodContent, { type: 'TEXT_OUTPUT' }>;
export type ImageOutputPodContent = Extract<PodContent, { type: 'IMAGE_OUTPUT' }>;
export type VideoOutputPodContent = Extract<PodContent, { type: 'VIDEO_OUTPUT' }>;
export type AudioOutputPodContent = Extract<PodContent, { type: 'AUDIO_OUTPUT' }>;
export type ContextModulePodContent = Extract<PodContent, { type: 'CONTEXT_MODULE' }>;
export type FlowContextInputPodContent = Extract<PodContent, { type: 'FLOW_CONTEXT_INPUT' }>;
