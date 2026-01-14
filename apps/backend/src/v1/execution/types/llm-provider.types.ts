import { LLMProvider } from '@flopods/schema';

export interface LLMRequest {
  provider: LLMProvider;
  model: string;
  messages: Array<{ role: string; content: string | any }>;
  apiKey: string;
  customEndpoint?: string;
  apiKeyId?: string;
  workspaceId?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  thinkingBudget?: number;
  responseFormat?: 'text' | 'json_object' | 'json';
  stream?: boolean;
}

export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  reasoningTokens?: number;
  cachedTokens?: number;
}

// PROFIT MARKUP STRUCT
export interface LLMProfit {
  actualCostUsd: number;
  userChargeUsd: number;
  profitUsd: number;
  profitMarginPercentage: number;
  roi: number;
  markupMultiplier: number; // How many times the actual cost
  creditsCharged: number;
}

export interface LLMResponse {
  id: string;
  model: string;
  provider: LLMProvider;
  content: string;
  finishReason: string;
  usage: LLMUsage;
  profit?: LLMProfit;
  rawResponse: any;
  timestamp: Date;
}

export type LLMStreamChunk =
  | { type: 'start'; executionId?: string }
  | { type: 'token'; content: string }
  | { type: 'done'; finishReason?: string; usage?: LLMUsage; profit?: LLMProfit }
  | { type: 'error'; error: string }
  | { type: 'metadata'; metadata?: Record<string, any> };

export interface ILLMProvider {
  execute(request: LLMRequest): Promise<LLMResponse>;
  executeStream?(request: LLMRequest): AsyncGenerator<LLMStreamChunk>;
  testApiKey(apiKey: string, customEndpoint?: string): Promise<boolean>;
  getAvailableModels(): Promise<string[]>;
}
