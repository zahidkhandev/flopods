import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import {
  Sparkles,
  Send,
  Loader2,
  ArrowDown,
  Check,
  Copy,
  Clock,
  MessageSquare,
  Settings2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/lib/toast-utils';
import { useWorkspaces } from '@/hooks/use-workspaces';
import { useStreamingExecution } from '@/pages/dashboard/flows/[id]/hooks/use-streaming-execution';
import { usePodExecutions } from '@/pages/dashboard/flows/[id]/hooks/use-executions';
import { axiosInstance } from '@/lib/axios-instance';
import { cn } from '@/lib/utils';
import DOMPurify from 'dompurify';
import axios from 'axios';

// Register Prisma language for syntax highlighting
hljs.registerLanguage('prisma', function () {
  return {
    name: 'Prisma',
    aliases: ['prisma'],
    keywords: {
      keyword:
        'model enum datasource generator type map relation fields references onDelete onUpdate default autoincrement now unique index',
      built_in: 'String Int Boolean DateTime Float Decimal Json Bytes BigInt',
      literal: 'true false null',
    },
    contains: [
      hljs.QUOTE_STRING_MODE,
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      {
        className: 'number',
        begin: '\\b\\d+',
      },
    ],
  };
});

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  executionId?: string;
  isStreaming?: boolean;
  isThinking?: boolean;
  metadata?: {
    runtime?: number;
    inputTokens?: number;
    outputTokens?: number;
    reasoningTokens?: number;
  };
};

interface Model {
  modelId: string;
  modelName: string;
  provider: string;
  inputTokenCost: string;
  outputTokenCost: string;
  contextWindow: number;
  supportsVision: boolean;
  supportsFunctionCalling: boolean;
  supportsStreaming: boolean;
}

interface ModelsByProvider {
  provider: string;
  models: Model[];
  count: number;
}

const deduplicateMessages = (messages: ChatMessage[]): ChatMessage[] => {
  const seen = new Set<string>();
  return messages.filter((msg) => {
    const key = msg.executionId
      ? `${msg.executionId}-${msg.role}`
      : `${msg.role}-${msg.content}-${msg.timestamp.getTime()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// Only show these providers
const ALLOWED_PROVIDERS = ['GOOGLE', 'ANTHROPIC', 'OPENAI'];

const getProviderDisplayName = (provider: string) => {
  const map: Record<string, string> = {
    GOOGLE: 'Google',
    ANTHROPIC: 'Anthropic',
    OPENAI: 'OpenAI',
  };
  return map[provider] || provider;
};

function CodeBlock({ language, children }: { language?: string; children: string }) {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (codeRef.current) {
      codeRef.current.removeAttribute('data-highlighted');
      const sanitized = DOMPurify.sanitize(children, {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: [],
      });
      codeRef.current.textContent = sanitized;

      try {
        hljs.highlightElement(codeRef.current);
      } catch (error) {
        console.warn('Syntax highlighting failed:', error);
      }
    }
  }, [children]);

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative my-3 w-full min-w-0">
      <div className="border-border/50 bg-background/90 absolute top-2 right-2 z-10 flex items-center gap-1 rounded border px-2 py-1 text-xs opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
        <span className="text-muted-foreground font-mono text-[10px]">{language || 'code'}</span>
        <Button variant="ghost" size="sm" className="h-4 w-4 p-0" onClick={handleCopy}>
          {copied ? (
            <Check className="h-2.5 w-2.5 text-green-500" />
          ) : (
            <Copy className="h-2.5 w-2.5" />
          )}
        </Button>
      </div>
      <pre className="border-border/50 m-0! w-full overflow-x-auto rounded-lg border bg-zinc-950 p-3! dark:bg-zinc-950">
        <code
          ref={codeRef}
          className={language ? `language-${language}` : ''}
          style={{
            fontSize: '12px',
            lineHeight: '1.5',
            display: 'block',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            overflowWrap: 'anywhere',
            maxWidth: '100%',
          }}
        />
      </pre>
    </div>
  );
}

export default function ChatPage() {
  const { id: podId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { currentWorkspaceId } = useWorkspaces();

  const flowIdFromQuery = searchParams.get('flowId');
  const flowIdFromState = (location.state as { flowId?: string } | null)?.flowId;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [prompt, setPrompt] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [autoContext, setAutoContext] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [flowId, setFlowId] = useState<string | null>(flowIdFromQuery || flowIdFromState || null);
  const [isResolvingPod, setIsResolvingPod] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const [availableModels, setAvailableModels] = useState<ModelsByProvider[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState<number | undefined>(undefined);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const loadedExecutionIds = useRef<Set<string>>(new Set());
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch available models
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await axiosInstance.get('/models/grouped');
        const allModels = response.data.data || response.data;

        // Filter to only allowed providers
        const filtered = allModels.filter((group: ModelsByProvider) =>
          ALLOWED_PROVIDERS.includes(group.provider)
        );

        setAvailableModels(filtered);

        // Set default model (first Google model if available)
        if (filtered.length > 0 && filtered[0].models.length > 0) {
          setSelectedModel(filtered[0].models[0].modelId);
        }
      } catch (error) {
        console.error('Failed to fetch models:', error);
      }
    };

    fetchModels();
  }, []);

  useEffect(() => {
    if (flowIdFromQuery && flowIdFromQuery !== flowId) {
      setFlowId(flowIdFromQuery);
    } else if (flowIdFromState && flowIdFromState !== flowId) {
      setFlowId(flowIdFromState);
    }
  }, [flowIdFromQuery, flowIdFromState, flowId]);

  // Fixed: Use correct endpoint structure with proper error handling
  useEffect(() => {
    if (!podId || !currentWorkspaceId || !flowId) return;

    const fetchPodData = async () => {
      setIsResolvingPod(true);
      try {
        const response = await axiosInstance.get(
          `/workspaces/${currentWorkspaceId}/flows/${flowId}/canvas/pods/${podId}`
        );
        const podData = response.data.data || response.data;

        if (podData.content?.config) {
          const config = podData.content.config;
          if (config.model) setSelectedModel(config.model);
          if (config.temperature !== undefined) setTemperature(config.temperature);
          if (config.maxTokens) setMaxTokens(config.maxTokens);
        }
      } catch (error) {
        console.error('Failed to fetch pod data:', error);
        if (axios.isAxiosError(error) && error.response?.status !== 404) {
          toast.error('Failed to load chat configuration');
        }
      } finally {
        setIsResolvingPod(false);
      }
    };

    fetchPodData();
  }, [podId, currentWorkspaceId, flowId]);

  const { data: executionHistory, refetch: refetchExecutions } = usePodExecutions(
    flowId || '',
    podId || ''
  );

  useEffect(() => {
    if (historyLoaded || !executionHistory || !currentWorkspaceId) {
      return;
    }

    if (executionHistory.length === 0) {
      const timer = setTimeout(() => setHistoryLoaded(true), 0);
      return () => clearTimeout(timer);
    }

    const loadChatHistory = async () => {
      const newMessages: ChatMessage[] = [];

      const completedExecutions = executionHistory.filter((exec) => exec.status === 'COMPLETED');

      for (const exec of [...completedExecutions].reverse()) {
        if (loadedExecutionIds.current.has(exec.id)) continue;

        try {
          const response = await axiosInstance.get(
            `/workspaces/${currentWorkspaceId}/executions/${exec.id}`
          );
          const execution = response.data.data || response.data;

          const userInput =
            execution.requestMetadata?.userInput ||
            execution.requestMetadata?.messages?.[0]?.content ||
            '';

          const assistantContent =
            execution.responseMetadata?.content ||
            execution.responseMetadata?.candidates?.[0]?.content?.parts?.[0]?.text ||
            'No response';

          if (userInput) {
            newMessages.push({
              role: 'user',
              content: userInput,
              timestamp: execution.startedAt ? new Date(execution.startedAt) : new Date(),
              executionId: exec.id,
            });
          }

          if (assistantContent) {
            newMessages.push({
              role: 'assistant',
              content: assistantContent,
              timestamp: execution.finishedAt ? new Date(execution.finishedAt) : new Date(),
              executionId: exec.id,
              metadata: {
                runtime: execution.runtimeInMs,
                inputTokens: execution.inputTokens,
                outputTokens: execution.outputTokens,
                reasoningTokens: execution.reasoningTokens,
              },
            });
          }

          loadedExecutionIds.current.add(exec.id);
        } catch (error) {
          console.error(`Failed to load execution ${exec.id}:`, error);
        }
      }

      if (newMessages.length > 0) {
        setMessages((prev) => {
          const combined = deduplicateMessages([...prev, ...newMessages]);
          return combined.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        });
      }

      setHistoryLoaded(true);
    };

    loadChatHistory();
  }, [executionHistory, currentWorkspaceId, historyLoaded]);

  const { executeStreaming } = useStreamingExecution({
    onToken: (token) => setStreamingContent((prev) => prev + token),
    onStart: (executionId) => {
      setStreamingContent('');
      setIsExecuting(true);
      if (executionId) {
        loadedExecutionIds.current.add(executionId);
      }
    },
    onComplete: ({ content, metadata, executionId }) => {
      setMessages((prev) => {
        const withoutThinking = prev.filter((m) => !m.isThinking);
        return deduplicateMessages([
          ...withoutThinking,
          {
            role: 'assistant',
            content,
            timestamp: new Date(),
            executionId,
            metadata: {
              runtime: metadata?.runtime,
              inputTokens: metadata?.inputTokens,
              outputTokens: metadata?.outputTokens,
              reasoningTokens: metadata?.reasoningTokens,
            },
          },
        ]);
      });
      setStreamingContent('');
      setIsExecuting(false);

      setTimeout(() => refetchExecutions(), 1000);
    },
    onError: (err) => {
      toast.error(err);
      setStreamingContent('');
      setIsExecuting(false);
      setMessages((prev) => prev.filter((m) => !m.isThinking));
    },
  });

  const getScrollContainer = useCallback(() => {
    return chatContainerRef.current?.querySelector(
      '[data-radix-scroll-area-viewport]'
    ) as HTMLDivElement;
  }, []);

  const scrollToBottom = useCallback(() => {
    const viewport = getScrollContainer();
    if (viewport) {
      viewport.scrollTo({
        top: viewport.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [getScrollContainer]);

  const displayMessages = useMemo(() => {
    if (isExecuting && !streamingContent) {
      return [
        ...messages,
        {
          role: 'assistant' as const,
          content: '',
          timestamp: new Date(),
          isThinking: true,
        },
      ];
    }
    if (streamingContent) {
      return [
        ...messages,
        {
          role: 'assistant' as const,
          content: streamingContent,
          timestamp: new Date(),
          isStreaming: true,
        },
      ];
    }
    return messages;
  }, [isExecuting, streamingContent, messages]);

  useEffect(() => {
    const viewport = getScrollContainer();
    if (!viewport) return;

    const shouldScroll =
      streamingContent || displayMessages[displayMessages.length - 1]?.role === 'user';

    if (shouldScroll) {
      requestAnimationFrame(() => {
        viewport.scrollTop = viewport.scrollHeight;
      });
    }
  }, [streamingContent, displayMessages, getScrollContainer]);

  useEffect(() => {
    if (historyLoaded && messages.length > 0) {
      setTimeout(scrollToBottom, 100);
    }
  }, [historyLoaded, messages.length, scrollToBottom]);

  useEffect(() => {
    const viewport = getScrollContainer();
    if (!viewport) return;

    let rafId: number | null = null;

    const handleScroll = () => {
      if (rafId) cancelAnimationFrame(rafId);

      rafId = requestAnimationFrame(() => {
        const atBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 100;
        setShowScrollButton(!atBottom);
      });
    };

    viewport.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      viewport.removeEventListener('scroll', handleScroll);
    };
  }, [getScrollContainer]);

  // Optimized textarea resize handler with debouncing
  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setPrompt(value);

    // Debounce the resize calculation
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }

    resizeTimeoutRef.current = setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        const newHeight = Math.min(textareaRef.current.scrollHeight, 180);
        textareaRef.current.style.height = `${newHeight}px`;
      }
    }, 0);
  }, []);

  const handleSend = useCallback(
    async (e?: React.MouseEvent | React.KeyboardEvent) => {
      e?.preventDefault();
      if (!podId || !currentWorkspaceId) {
        toast.error('Select a workspace before chatting.');
        return;
      }
      if (!flowId) {
        toast.error('Missing flow context for this chat.');
        return;
      }
      if (!prompt.trim() || isExecuting) return;

      const userMsg: ChatMessage = { role: 'user', content: prompt.trim(), timestamp: new Date() };
      setMessages((prev) => deduplicateMessages([...prev, userMsg]));
      setPrompt('');
      setIsExecuting(true);
      setStreamingContent('');

      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }

      try {
        const params: any = {
          podId,
          messages: [{ role: 'user', content: userMsg.content }],
          model: selectedModel,
          temperature,
          autoContext,
        };
        if (maxTokens && maxTokens > 0) params.maxTokens = maxTokens;
        await executeStreaming(params);
      } catch (err: any) {
        toast.error(err?.message || 'Failed to send');
        setIsExecuting(false);
      }
    },
    [
      podId,
      currentWorkspaceId,
      flowId,
      prompt,
      isExecuting,
      executeStreaming,
      selectedModel,
      temperature,
      autoContext,
      maxTokens,
    ]
  );

  const isLoadingHistory = (!historyLoaded && executionHistory !== undefined) || isResolvingPod;

  if (!podId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground text-sm">No chat selected.</p>
        <Button onClick={() => navigate('/dashboard')} size="sm">
          Go to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-background absolute inset-0 flex flex-col">
      <div className="relative flex-1 overflow-hidden" ref={chatContainerRef}>
        <ScrollArea className="h-full">
          <div className="mx-auto max-w-3xl px-4 pt-6">
            {isLoadingHistory ? (
              <div className="flex h-full items-center justify-center py-20">
                <div className="text-muted-foreground flex flex-col items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <p className="text-xs">Loading history...</p>
                </div>
              </div>
            ) : displayMessages.length === 0 ? (
              <div className="flex h-full items-center justify-center py-20">
                <div className="text-muted-foreground flex flex-col items-center gap-3 text-center">
                  <MessageSquare className="h-12 w-12 opacity-20" />
                  <div>
                    <p className="text-sm font-medium">Start a conversation</p>
                    <p className="text-xs opacity-60">Ask anything to get started</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="min-w-0 space-y-6 pb-4">
                {displayMessages.map((message, index) => (
                  <div
                    key={`${message.executionId || message.timestamp.toISOString()}-${index}`}
                    className={cn(
                      'group flex min-w-0 flex-col gap-2',
                      message.role === 'user' ? 'items-end' : 'items-start'
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[90%] min-w-0 overflow-hidden rounded-2xl px-4 py-3',
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'border-border/40 bg-card/50 border shadow-sm backdrop-blur-sm'
                      )}
                    >
                      {message.isThinking ? (
                        <div className="text-muted-foreground flex items-center gap-2">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span className="text-xs">Thinking...</span>
                        </div>
                      ) : (
                        <>
                          <div
                            className="prose prose-sm dark:prose-invert max-w-full min-w-0 select-text"
                            style={{
                              fontSize: '14px',
                              lineHeight: '1.7',
                            }}
                          >
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                code({ inline, className, children, ...props }: any) {
                                  const match = /language-(\w+)/.exec(className || '');
                                  const codeString = String(children).replace(/\n$/, '');
                                  return !inline && match ? (
                                    <CodeBlock language={match[1]}>{codeString}</CodeBlock>
                                  ) : (
                                    <code
                                      className="bg-muted inline-block rounded px-1.5 py-0.5 font-mono text-[13px]"
                                      {...props}
                                    >
                                      {children}
                                    </code>
                                  );
                                },
                                p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                                ul: ({ children }) => (
                                  <ul className="my-3 space-y-1.5 pl-5">{children}</ul>
                                ),
                                ol: ({ children }) => (
                                  <ol className="my-3 space-y-1.5 pl-5">{children}</ol>
                                ),
                              }}
                            >
                              {message.content}
                            </ReactMarkdown>
                          </div>

                          {message.isStreaming && (
                            <div className="text-muted-foreground mt-2 flex items-center gap-1.5 text-[10px]">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span>Streaming...</span>
                            </div>
                          )}

                          {message.role === 'assistant' &&
                            message.metadata &&
                            !message.isStreaming &&
                            !message.isThinking && (
                              <div className="text-muted-foreground border-border/30 mt-3 flex flex-wrap items-center gap-3 border-t pt-2 text-[10px]">
                                {message.metadata?.runtime && (
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {(message.metadata.runtime / 1000).toFixed(2)}s
                                  </div>
                                )}
                                {message.metadata?.inputTokens !== undefined && (
                                  <span className="text-emerald-600 dark:text-emerald-400">
                                    ↓ {message.metadata.inputTokens}
                                  </span>
                                )}
                                {message.metadata?.outputTokens !== undefined && (
                                  <span className="text-blue-600 dark:text-blue-400">
                                    ↑ {message.metadata.outputTokens}
                                  </span>
                                )}
                                {message.metadata?.reasoningTokens !== undefined && (
                                  <div className="flex items-center gap-1">
                                    <Sparkles className="h-3 w-3" />
                                    <span className="text-amber-600 dark:text-amber-400">
                                      {message.metadata.reasoningTokens}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                        </>
                      )}
                    </div>
                    <span className="text-muted-foreground px-1 text-[10px]">
                      {message.timestamp.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        {showScrollButton && (
          <Button
            onClick={scrollToBottom}
            size="sm"
            className="absolute right-6 bottom-6 z-50 h-9 w-9 rounded-full shadow-lg"
            title="Scroll to bottom"
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="border-border/50 bg-background/95 border-t backdrop-blur-sm">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <div className="bg-muted/30 border-border/60 focus-within:border-primary/50 focus-within:ring-primary/20 relative flex items-center gap-2.5 rounded-2xl border p-2.5 shadow-sm transition-all focus-within:ring-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'h-9 w-9 shrink-0 rounded-xl p-0 transition-colors',
                      autoContext ? 'bg-primary/15 text-primary hover:bg-primary/25' : ''
                    )}
                    onClick={() => setAutoContext(!autoContext)}
                  >
                    <Sparkles className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {autoContext ? 'Auto-context: ON' : 'Auto-context: OFF'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Textarea
              ref={textareaRef}
              value={prompt}
              onChange={handleTextareaChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
              placeholder="Ask anything..."
              className="placeholder:text-muted-foreground/60 max-h-45 min-h-9 flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm leading-relaxed focus-visible:ring-0 focus-visible:ring-offset-0"
              disabled={isExecuting}
              rows={1}
            />

            <div className="flex shrink-0 items-center gap-1.5">
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="bg-background/60 hover:bg-background h-9 w-36 rounded-xl border-0 text-xs shadow-sm">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map((providerGroup) => (
                    <div key={providerGroup.provider}>
                      <div className="text-muted-foreground px-2 py-1.5 text-[10px] font-semibold tracking-wider uppercase">
                        {getProviderDisplayName(providerGroup.provider)}
                      </div>
                      {providerGroup.models.map((model) => (
                        <SelectItem
                          key={model.modelId}
                          value={model.modelId}
                          className="pl-4 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span>{model.modelName}</span>
                            {model.supportsVision && (
                              <span className="text-muted-foreground text-[9px]">👁️</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hover:bg-background h-9 w-9 rounded-xl p-0"
                  >
                    <Settings2 className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72" align="end">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium">Temperature</Label>
                        <span className="text-muted-foreground text-xs">
                          {temperature.toFixed(1)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        value={temperature}
                        onChange={(e) => setTemperature(parseFloat(e.target.value))}
                        className="accent-primary w-full cursor-pointer"
                      />
                      <p className="text-muted-foreground text-[10px]">
                        Controls randomness. Lower is more focused.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Max Output Tokens</Label>
                      <Input
                        type="number"
                        value={maxTokens || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setMaxTokens(val ? parseInt(val, 10) : undefined);
                        }}
                        placeholder="Unlimited"
                        className="h-8 text-xs"
                      />
                      <p className="text-muted-foreground text-[10px]">Leave empty for no limit</p>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              <Button
                size="sm"
                onClick={() => handleSend()}
                disabled={!prompt.trim() || isExecuting || !selectedModel}
                className="h-9 w-9 rounded-xl p-0"
              >
                {isExecuting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground/70 mt-2 text-center text-[10px]">
            Press Enter to send • Shift + Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}
