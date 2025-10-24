// types/pod-content.types.ts

import { PodType, LLMProvider } from '@actopod/schema';

export type Position = {
  x: number;
  y: number;
};

export type Size = {
  width: number;
  height: number;
};

export type Handle = {
  id: string;
  label: string;
  type: 'source' | 'target';
  dataType: 'string' | 'number' | 'boolean' | 'document' | 'image' | 'any';
  position?: 'top' | 'right' | 'bottom' | 'left';
};

// FIX: Match the exact type from llm-provider.types.ts
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
  responseFormat?: 'text' | 'json_object'; // FIXED: Removed 'json'
  streamEnabled?: boolean;
};

export type BasePodContent = {
  type: PodType;
  label: string;
  description?: string;
  position: Position;
  size?: Size;
  style?: {
    backgroundColor?: string;
    borderColor?: string;
    fontSize?: number;
    textColor?: string;
  };
  inputs?: Handle[];
  outputs?: Handle[];
  metadata?: Record<string, any>;
};

export type TextInputPodContent = BasePodContent & {
  type: typeof PodType.TEXT_INPUT;
  config: {
    text: string;
    placeholder?: string;
    multiline?: boolean;
    maxLength?: number;
  };
};

export type LLMPromptPodContent = BasePodContent & {
  type: typeof PodType.LLM_PROMPT;
  config: LLMConfig;
};

export type DocumentInputPodContent = BasePodContent & {
  type: typeof PodType.DOCUMENT_INPUT;
  config: {
    documentId: string;
    extractionType: 'full' | 'embedding' | 'chunk';
    chunkSize?: number;
    chunkOverlap?: number;
  };
};

export type URLInputPodContent = BasePodContent & {
  type: typeof PodType.URL_INPUT;
  config: {
    url: string;
    extractionType: 'text' | 'html' | 'markdown';
    followRedirects?: boolean;
  };
};

export type CodeExecutionPodContent = BasePodContent & {
  type: typeof PodType.CODE_EXECUTION;
  config: {
    language: 'javascript' | 'python' | 'typescript';
    code: string;
    timeout?: number;
    allowedPackages?: string[];
  };
};

export type PodContent =
  | TextInputPodContent
  | LLMPromptPodContent
  | DocumentInputPodContent
  | URLInputPodContent
  | CodeExecutionPodContent;

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
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lockedBy?: string;
  lockedAt?: string;
};
