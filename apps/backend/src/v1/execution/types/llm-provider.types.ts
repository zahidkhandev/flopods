import { LLMProvider } from '@actopod/schema';

export type LLMMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; image_url?: any }>;
};

export type LLMRequest = {
  provider: LLMProvider;
  model: string;
  messages: LLMMessage[];
  apiKey: string;
  customEndpoint?: string;
  apiKeyId?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  responseFormat?: 'text' | 'json_object';
  thinkingBudget?: number;
};

export type LLMResponse = {
  id: string;
  model: string;
  provider: LLMProvider;
  content: string;
  finishReason: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    reasoningTokens?: number;
    cachedTokens?: number;
  };
  rawResponse: any;
  timestamp: Date;
};

export type ILLMProvider = {
  execute(request: LLMRequest): Promise<LLMResponse>;
  testApiKey(apiKey: string, customEndpoint?: string): Promise<boolean>;
  getAvailableModels(): Promise<string[]>;
};
