import { useCallback, useRef, useEffect } from 'react';
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
    reasoningTokens?: number;
    inputTokens?: number;
    outputTokens?: number;
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

  // **CRITICAL FIX: Store callbacks in refs to avoid stale closures**
  const onTokenRef = useRef(options.onToken);
  const onStartRef = useRef(options.onStart);
  const onCompleteRef = useRef(options.onComplete);
  const onErrorRef = useRef(options.onError);

  // Update refs when callbacks change
  useEffect(() => {
    onTokenRef.current = options.onToken;
  }, [options.onToken]);

  useEffect(() => {
    onStartRef.current = options.onStart;
  }, [options.onStart]);

  useEffect(() => {
    onCompleteRef.current = options.onComplete;
  }, [options.onComplete]);

  useEffect(() => {
    onErrorRef.current = options.onError;
  }, [options.onError]);

  const executeStreaming = useCallback(
    async (params: {
      podId: string;
      messages: Array<{ role: string; content: string }>;
      provider: string;
      model: string;
      temperature?: number;
      maxTokens?: number;
      autoContext?: boolean;
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
        let completed = false;

        let metadata = {
          runtime: 0,
          tokens: 0,
          cost: 0,
          inputTokens: 0,
          outputTokens: 0,
          reasoningTokens: 0,
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
                metadata.runtime = Date.now() - startTime;

                completed = true;
                onCompleteRef.current?.({ content: fullContent, metadata, executionId });
                return { content: fullContent, metadata, executionId };
              }

              try {
                const parsed: StreamingMessage = JSON.parse(data);

                switch (parsed.type) {
                  case 'start':
                    executionId = parsed.executionId || '';
                    startTime = Date.now();
                    console.log('[STREAM] Start:', executionId);
                    onStartRef.current?.(executionId);
                    break;

                  case 'token': {
                    const tokenText = parsed.token || parsed.content || '';
                    if (tokenText) {
                      fullContent += tokenText;
                      console.log('[STREAM] Token:', tokenText);
                      // **USE REF TO CALL CURRENT CALLBACK**
                      onTokenRef.current?.(tokenText);
                    }
                    break;
                  }

                  case 'done':
                    if (parsed.usage) {
                      metadata = {
                        runtime: Date.now() - startTime,
                        tokens: parsed.usage.totalTokens || 0,
                        cost: 0,
                        inputTokens: parsed.usage.promptTokens || 0,
                        outputTokens: parsed.usage.completionTokens || 0,
                        reasoningTokens: metadata.reasoningTokens || 0,
                      };
                    }
                    console.log('[STREAM] Done with usage:', parsed.usage);
                    break;

                  case 'metadata':
                    metadata = {
                      ...metadata,
                      ...parsed.metadata,
                      reasoningTokens: parsed.metadata?.reasoningTokens ?? metadata.reasoningTokens,
                    };
                    break;

                  case 'complete':
                    console.log('[STREAM] Complete');
                    completed = true;
                    onCompleteRef.current?.({
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

        // Fallback: if the stream ended without emitting a formal completion event
        // ensure we still deliver the accumulated content so the UI doesn't drop it.
        if (!completed && fullContent) {
          metadata.runtime = Date.now() - startTime;
          onCompleteRef.current?.({ content: fullContent, metadata, executionId });
        }

        return { content: fullContent, metadata, executionId };
      } catch (error: any) {
        if (error.name === 'AbortError') {
          onErrorRef.current?.('Execution cancelled');
          throw new Error('Execution cancelled');
        }
        onErrorRef.current?.(error.message);
        throw error;
      } finally {
        abortControllerRef.current = null;
      }
    },
    [currentWorkspaceId]
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
