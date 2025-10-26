import { useCallback, useRef } from 'react';
import { useWorkspaces } from '@/hooks/use-workspaces';
import { getAuthTokens } from '@/utils/token-utils';

interface StreamingMessage {
  type: 'token' | 'start' | 'complete' | 'error' | 'metadata' | 'done';
  content?: string;
  token?: string;
  metadata?: {
    runtime?: number;
    tokens?: number;
    cost?: number;
  };
  error?: string;
  executionId?: string;
  finishReason?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

interface UseStreamingExecutionOptions {
  onToken?: (token: string) => void;
  onStart?: (executionId: string) => void;
  onComplete?: (result: { content: string; metadata: any; executionId: string }) => void;
  onError?: (error: string) => void;
}

export function useStreamingExecution(options: UseStreamingExecutionOptions = {}) {
  const { currentWorkspaceId } = useWorkspaces();
  const abortControllerRef = useRef<AbortController | null>(null);

  const executeStreaming = useCallback(
    async (params: {
      podId: string;
      messages: Array<{ role: string; content: string }>;
      provider: string;
      model: string;
      temperature?: number;
      maxTokens?: number;
    }) => {
      if (!currentWorkspaceId) {
        throw new Error('No workspace selected');
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      try {
        const tokens = getAuthTokens();

        if (!tokens?.accessToken) {
          throw new Error('Not authenticated - please log in again');
        }

        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
        const url = `${apiUrl}/workspaces/${currentWorkspaceId}/executions`;

        console.log('[Streaming] Executing to:', url);

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokens.accessToken}`,
          },
          body: JSON.stringify(params),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          let errorMessage = 'Execution failed';
          try {
            const error = await response.json();
            errorMessage = error.message || errorMessage;
          } catch {
            errorMessage = `Server error: ${response.status} ${response.statusText}`;
          }
          throw new Error(errorMessage);
        }

        if (!response.body) {
          throw new Error('No response body');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullContent = '';
        let executionId = '';
        let startTime = Date.now();

        // ✅ Initialize metadata with proper structure
        let metadata = {
          runtime: 0,
          tokens: 0,
          cost: 0,
          inputTokens: 0,
          outputTokens: 0,
        };

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);

              if (data === '[DONE]') {
                // ✅ Calculate runtime
                metadata.runtime = Date.now() - startTime;

                options.onComplete?.({
                  content: fullContent,
                  metadata,
                  executionId,
                });
                return { content: fullContent, metadata, executionId };
              }

              try {
                const parsed: StreamingMessage = JSON.parse(data);

                switch (parsed.type) {
                  case 'start':
                    executionId = parsed.executionId || '';
                    startTime = Date.now();
                    options.onStart?.(executionId);
                    break;

                  case 'token':
                    // ✅ Handle BOTH `token` and `content` fields
                    const tokenText = parsed.token || parsed.content || '';
                    if (tokenText) {
                      fullContent += tokenText;
                      options.onToken?.(tokenText);
                    }
                    break;

                  case 'done':
                    // ✅ Capture token usage from Gemini's done event
                    if (parsed.usage) {
                      metadata = {
                        runtime: Date.now() - startTime,
                        tokens: parsed.usage.totalTokens || 0,
                        cost: 0, // Will be calculated by backend
                        inputTokens: parsed.usage.promptTokens || 0,
                        outputTokens: parsed.usage.completionTokens || 0,
                      };
                      console.log('[Streaming] Usage captured:', metadata);
                    }
                    break;

                  case 'metadata':
                    // ✅ Override with backend metadata if provided
                    metadata = {
                      ...metadata,
                      ...parsed.metadata,
                    };
                    break;

                  case 'complete':
                    options.onComplete?.({
                      content: parsed.content || fullContent,
                      metadata: parsed.metadata || metadata,
                      executionId: parsed.executionId || executionId,
                    });
                    return {
                      content: parsed.content || fullContent,
                      metadata: parsed.metadata || metadata,
                      executionId: parsed.executionId || executionId,
                    };

                  case 'error':
                    throw new Error(parsed.error || 'Execution error');
                }
              } catch (parseError) {
                if (parseError instanceof Error && parseError.message !== 'Execution error') {
                  console.error('Failed to parse SSE data:', data, parseError);
                } else {
                  throw parseError;
                }
              }
            }
          }
        }

        return { content: fullContent, metadata, executionId };
      } catch (error: any) {
        if (error.name === 'AbortError') {
          options.onError?.('Execution cancelled');
          throw new Error('Execution cancelled');
        }
        options.onError?.(error.message);
        throw error;
      } finally {
        abortControllerRef.current = null;
      }
    },
    [currentWorkspaceId, options]
  );

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  return {
    executeStreaming,
    cancel,
  };
}
