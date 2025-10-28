// File: apps/frontend/src/pages/dashboard/flows/[id]/components/panels/config-panel.tsx
import { memo, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Upload,
  Type,
  FileText,
  Link,
  Image,
  Video,
  Music,
  Youtube,
  Sparkles,
  MessageSquare,
  Loader2,
  Clock,
  Send,
  Sliders,
  Copy,
  Check,
  ChevronUp,
  Download,
  ArrowDown,
  FileText as FileTextIcon,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCanvas } from '../../../context/canvas-context';
import { useModels } from '../../../context/models-context';
import { useParams } from 'react-router-dom';
import { usePodExecutions } from '../../../hooks/use-executions';
import { axiosInstance } from '@/lib/axios-instance';
import { useWorkspaces } from '@/hooks/use-workspaces';
import { toast } from '@/lib/toast-utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import hljs from 'highlight.js';
import DOMPurify from 'dompurify';
import 'highlight.js/styles/github-dark.css';
import 'highlight.js/styles/github.css';
import { cn } from '@/lib/utils';
import { LLMProvider, PodExecutionStatus } from '../../../types';
import { useStreamingExecution } from '../../../hooks/use-streaming-execution';
import { Node } from 'reactflow';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  executionId?: string;
  metadata?: {
    runtime?: number;
    tokens?: number;
    cost?: number;
    inputTokens?: number;
    outputTokens?: number;
  };
  isStreaming?: boolean;
  isThinking?: boolean;
}

interface ConfigPanelProps {
  selectedPodId: string | null;
}

const getProviderDisplayName = (provider: LLMProvider): string => {
  const mapping: Record<LLMProvider, string> = {
    [LLMProvider.OPENAI]: 'OpenAI',
    [LLMProvider.ANTHROPIC]: 'Anthropic',
    [LLMProvider.GOOGLE_GEMINI]: 'Gemini',
    [LLMProvider.XAI]: 'xAI',
    [LLMProvider.PERPLEXITY]: 'Perplexity',
    [LLMProvider.MISTRAL]: 'Mistral',
    [LLMProvider.COHERE]: 'Cohere',
    [LLMProvider.GROQ]: 'Groq',
    [LLMProvider.DEEPSEEK]: 'DeepSeek',
    [LLMProvider.CUSTOM]: 'Custom',
  };
  return mapping[provider] || provider;
};

const sourceTypeIcons = {
  text: Type,
  document: FileText,
  url: Link,
  image: Image,
  video: Video,
  audio: Music,
  youtube: Youtube,
};

const CodeBlock = memo(function CodeBlock({
  language,
  children,
}: {
  language?: string;
  children: string;
}) {
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
      hljs.highlightElement(codeRef.current);
    }
  }, [children]);

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative my-4 w-full min-w-0">
      <div className="border-border/50 bg-background/90 absolute top-3 right-3 z-10 flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-xs opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
        <span className="text-muted-foreground font-mono">{language || 'code'}</span>
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={handleCopy}>
          {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
        </Button>
      </div>
      <pre className="border-border/50 !m-0 w-full overflow-x-auto rounded-xl border bg-zinc-100 !p-4 dark:bg-zinc-900">
        <code
          ref={codeRef}
          className={language ? `language-${language}` : ''}
          style={{
            fontSize: '13px',
            lineHeight: '1.6',
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
});

export default memo(function ConfigPanel({ selectedPodId }: ConfigPanelProps) {
  const { nodes, onNodesChange, updateNodeData, addNode, addEdge } = useCanvas();
  const { id: flowId } = useParams<{ id: string }>();
  const { currentWorkspaceId } = useWorkspaces();
  const { providers, getModelsForProvider, isLoading: modelsLoading } = useModels();

  const selectedNode = useMemo(() => {
    const node = nodes.find((n) => n.id === selectedPodId);
    // Only return node if it exists and we're not mid-execution
    return node;
  }, [nodes, selectedPodId]);

  const isOpen = !!selectedNode;
  const isLLMPod = selectedNode?.type === 'LLM';
  const isSourcePod = selectedNode?.type === 'SOURCE';

  const [provider, setProvider] = useState<LLMProvider>(
    selectedNode?.data?.config?.provider || LLMProvider.OPENAI
  );
  const [model, setModel] = useState(selectedNode?.data?.config?.model || 'gpt-4o');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [temperature, setTemperature] = useState(selectedNode?.data?.config?.temperature ?? 0.7);
  const [maxTokens, setMaxTokens] = useState<number | undefined>(undefined);

  const [userPrompt, setUserPrompt] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [debouncedStreamingContent, setDebouncedStreamingContent] = useState('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const [sourceType, setSourceType] = useState(selectedNode?.data?.config?.sourceType || 'text');
  const [sourceContent, setSourceContent] = useState(selectedNode?.data?.config?.content || '');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const streamDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const { data: executionHistory, refetch: refetchExecutions } = usePodExecutions(
    flowId!,
    selectedPodId
  );
  const availableModels = useMemo(
    () => getModelsForProvider(provider),
    [provider, getModelsForProvider]
  );

  // ✅ Debounce streaming updates to reduce renders
  useEffect(() => {
    if (streamingContent) {
      if (streamDebounceRef.current) {
        clearTimeout(streamDebounceRef.current);
      }
      streamDebounceRef.current = setTimeout(() => {
        setDebouncedStreamingContent(streamingContent);
      }, 50);
    } else {
      setDebouncedStreamingContent('');
    }

    return () => {
      if (streamDebounceRef.current) {
        clearTimeout(streamDebounceRef.current);
      }
    };
  }, [streamingContent]);

  const { executeStreaming } = useStreamingExecution({
    onToken: (token) => {
      setStreamingContent((prev) => prev + token);
    },
    onStart: (_executionId) => {
      setStreamingContent('');
      setDebouncedStreamingContent('');
    },
    onComplete: ({ content, metadata, executionId }) => {
      const assistantMessage: Message = {
        role: 'assistant',
        content,
        timestamp: new Date(),
        executionId,
        metadata: {
          runtime: metadata.runtime,
          tokens: metadata.tokens,
          cost: metadata.cost,
          inputTokens: metadata.inputTokens,
          outputTokens: metadata.outputTokens,
        },
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setStreamingContent('');
      setDebouncedStreamingContent('');
      setIsExecuting(false);
      refetchExecutions();
    },
    onError: (error) => {
      const errorMsg: Message = {
        role: 'assistant',
        content: `⚠️ ${error}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
      setStreamingContent('');
      setDebouncedStreamingContent('');
      setIsExecuting(false);
      toast.error('Execution failed');
    },
  });

  // ✅ Optimized displayMessages with thinking state
  const displayMessages = useMemo(() => {
    if (isExecuting && !debouncedStreamingContent) {
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

    if (debouncedStreamingContent) {
      return [
        ...messages,
        {
          role: 'assistant' as const,
          content: debouncedStreamingContent,
          timestamp: new Date(),
          isStreaming: true,
        },
      ];
    }
    return messages;
  }, [messages, debouncedStreamingContent, isExecuting]);

  const loadAllExecutionHistory = useCallback(async () => {
    if (!executionHistory || executionHistory.length === 0 || !currentWorkspaceId) return;

    setIsLoadingHistory(true);

    try {
      const allMessages: Message[] = [];

      for (const exec of [...executionHistory].reverse()) {
        try {
          const response = await axiosInstance.get(
            `/workspaces/${currentWorkspaceId}/executions/${exec.id}`
          );

          const execution = response.data.data || response.data;

          const assistantContent =
            execution.responseMetadata?.content ||
            execution.responseMetadata?.candidates?.[0]?.content?.parts?.[0]?.text ||
            'No response';

          const userInput = execution.requestMetadata?.userInput || '';

          if (userInput) {
            allMessages.push({
              role: 'user',
              content: userInput,
              timestamp: execution.startedAt ? new Date(execution.startedAt) : new Date(),
            });
          }

          if (assistantContent) {
            allMessages.push({
              role: 'assistant',
              content: assistantContent,
              timestamp: execution.finishedAt ? new Date(execution.finishedAt) : new Date(),
              executionId: exec.id,
              metadata: {
                runtime: execution.runtimeInMs,
                tokens: execution.inputTokens + execution.outputTokens,
                inputTokens: execution.inputTokens,
                outputTokens: execution.outputTokens,
              },
            });
          }
        } catch (error) {
          console.error(`Failed to load execution ${exec.id}`, error);
        }
      }

      setMessages(allMessages);
    } catch (error) {
      console.error('Failed to load conversation history', error);
      toast.error('Failed to load conversation history');
    } finally {
      setIsLoadingHistory(false);
    }
  }, [executionHistory, currentWorkspaceId]);

  useEffect(() => {
    if (executionHistory && executionHistory.length > 0 && messages.length === 0 && isLLMPod) {
      loadAllExecutionHistory();
    }
  }, [executionHistory, messages.length, isLLMPod, loadAllExecutionHistory]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollToBottom = () => {
      container.scrollTop = container.scrollHeight;
    };

    setTimeout(scrollToBottom, 50);

    const handleScroll = () => {
      const isAtBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      setShowScrollButton(!isAtBottom);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [displayMessages]);

  const scrollToBottom = useCallback(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, []);

  // ✅ NEW: Only reset when switching to a DIFFERENT pod
  const previousPodIdRef = useRef<string | null>(null);
  const isCurrentlyExecutingRef = useRef(false);

  useEffect(() => {
    isCurrentlyExecutingRef.current = isExecuting;
  }, [isExecuting]);

  useEffect(() => {
    if (selectedPodId && selectedPodId !== previousPodIdRef.current) {
      // ✅ New pod selected, reset everything
      previousPodIdRef.current = selectedPodId;

      if (selectedNode) {
        setProvider(selectedNode.data?.config?.provider || LLMProvider.OPENAI);
        setModel(selectedNode.data?.config?.model || 'gpt-4o');
        setTemperature(selectedNode.data?.config?.temperature ?? 0.7);
        setMaxTokens(undefined);
        setSourceType(selectedNode.data?.config?.sourceType || 'text');
        setSourceContent(selectedNode.data?.config?.content || '');
        setMessages([]);
        setStreamingContent('');
        setDebouncedStreamingContent('');
        setIsExecuting(false);
        setShowScrollButton(false);
      }
    } else if (!selectedPodId) {
      // Panel closed
      previousPodIdRef.current = null;
    }
  }, [selectedPodId, selectedNode]);

  const handleClose = useCallback(() => {
    if (selectedPodId) {
      onNodesChange([{ type: 'select', id: selectedPodId, selected: false }]);
    }
  }, [selectedPodId, onNodesChange]);

  const handleExecute = useCallback(async () => {
    if (!userPrompt.trim() || !currentWorkspaceId || !flowId || isExecuting || !selectedPodId)
      return;

    const newUserMessage: Message = {
      role: 'user',
      content: userPrompt,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setUserPrompt('');
    setIsExecuting(true);
    setStreamingContent('');
    setDebouncedStreamingContent('');

    if (textareaRef.current) {
      textareaRef.current.style.height = '100px';
    }

    try {
      const params: any = {
        podId: selectedPodId,
        messages: [{ role: 'user', content: newUserMessage.content }],
        provider,
        model,
        temperature,
      };

      if (maxTokens !== undefined && maxTokens > 0) {
        params.maxTokens = maxTokens;
      }

      await executeStreaming(params);
    } catch (error: any) {
      console.error('[ConfigPanel] Execution error:', error);
    }
  }, [
    userPrompt,
    flowId,
    selectedPodId,
    provider,
    model,
    temperature,
    maxTokens,
    currentWorkspaceId,
    isExecuting,
    executeStreaming,
  ]);

  const handleCopyResponse = useCallback((content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Copied to clipboard');
  }, []);

  const handleDownloadMarkdown = useCallback((content: string, index: number) => {
    const markdown = `# Response ${index + 1}\n\n${content}\n`;
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `response-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Downloaded as Markdown');
  }, []);

  const handleCreateSource = useCallback(
    async (content: string) => {
      if (!selectedNode) return;

      const newNodePosition = { x: selectedNode.position.x + 550, y: selectedNode.position.y };

      try {
        const newNodeData: Partial<Node> = {
          type: 'SOURCE',
          position: newNodePosition,
          data: {
            label: 'Source',
            config: {
              sourceType: 'text',
              content: content,
            },
            executionStatus: PodExecutionStatus.IDLE,
            backendType: 'TEXT_INPUT',
          },
        };

        const newNodeId = await addNode(newNodeData);

        if (newNodeId) {
          await addEdge({
            source: selectedPodId!,
            target: newNodeId,
            type: 'default',
          });
        }

        toast.success('Source node created');
      } catch (error) {
        console.error('Failed to create source:', error);
        toast.error('Failed to create source node');
      }
    },
    [selectedNode, selectedPodId, addNode, addEdge]
  );

  const handleSourceTypeChange = useCallback(
    (value: any) => {
      setSourceType(value);
      if (selectedPodId) {
        updateNodeData(selectedPodId, {
          config: { ...selectedNode?.data?.config, sourceType: value },
        });
      }
    },
    [selectedPodId, selectedNode, updateNodeData]
  );

  const handleSourceContentChange = useCallback(
    (content: string) => {
      setSourceContent(content);
      if (selectedPodId) {
        updateNodeData(selectedPodId, {
          config: { ...selectedNode?.data?.config, content },
        });
      }
    },
    [selectedPodId, selectedNode, updateNodeData]
  );

  const SourceIcon = sourceTypeIcons[sourceType as keyof typeof sourceTypeIcons];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40"
            onClick={handleClose}
          />

          <motion.div
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="border-border/50 bg-background fixed top-0 right-0 z-50 flex h-screen w-[700px] flex-col overflow-hidden border-l shadow-2xl"
          >
            {/* Header */}
            <div className="border-border/50 bg-background/95 flex shrink-0 items-center justify-between border-b p-5 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                {isLLMPod && <Sparkles className="text-primary h-5 w-5" />}
                {isSourcePod && <Upload className="h-5 w-5 text-blue-500" />}
                <h2 className="text-lg font-semibold">{selectedNode.data.label}</h2>
              </div>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* LLM Pod Content */}
            {isLLMPod && (
              <div className="bg-background flex min-h-0 flex-1 flex-col">
                <div
                  ref={scrollContainerRef}
                  className="bg-background relative min-h-0 flex-1 overflow-y-auto"
                >
                  <div className="p-6">
                    {isLoadingHistory ? (
                      <div className="flex h-full items-center justify-center">
                        <div className="text-muted-foreground flex flex-col items-center gap-3">
                          <Loader2 className="h-8 w-8 animate-spin" />
                          <p className="text-sm">Loading conversation history...</p>
                        </div>
                      </div>
                    ) : displayMessages.length === 0 ? (
                      <div className="flex h-[400px] items-center justify-center">
                        <div className="text-muted-foreground flex flex-col items-center gap-3 text-center">
                          <MessageSquare className="h-14 w-14 opacity-30" />
                          <p className="text-base">Start a conversation</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {displayMessages.map((message, index) => (
                          <div
                            key={`${message.executionId || 'msg'}-${index}`}
                            className={cn(
                              'group flex flex-col gap-2',
                              message.role === 'user' ? 'items-end' : 'items-start'
                            )}
                          >
                            <div
                              className={cn(
                                'max-w-[95%] min-w-0 overflow-hidden rounded-2xl px-5 py-4 break-words shadow-sm',
                                message.role === 'user'
                                  ? 'bg-primary text-primary-foreground'
                                  : message.content.includes('⚠️')
                                    ? 'border-destructive/30 bg-destructive/5 border'
                                    : 'border-border/50 bg-card border'
                              )}
                            >
                              {message.isThinking ? (
                                <div className="text-muted-foreground flex items-center gap-2 py-2">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  <span className="text-sm">Thinking...</span>
                                </div>
                              ) : (
                                <>
                                  <div
                                    className="prose prose-sm dark:prose-invert max-w-none overflow-hidden select-text"
                                    style={{
                                      fontSize: '15px',
                                      lineHeight: '1.7',
                                      wordBreak: 'break-word',
                                      overflowWrap: 'anywhere',
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
                                              className="inline-block max-w-full rounded bg-zinc-200 px-2 py-0.5 font-mono text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                                              style={{
                                                fontSize: '13px',
                                                wordBreak: 'break-all',
                                                overflowWrap: 'anywhere',
                                              }}
                                              {...props}
                                            >
                                              {children}
                                            </code>
                                          );
                                        },
                                        p: ({ children }) => (
                                          <p
                                            className="mb-4 max-w-full break-words last:mb-0"
                                            style={{
                                              lineHeight: '1.7',
                                              wordBreak: 'break-word',
                                              overflowWrap: 'anywhere',
                                            }}
                                          >
                                            {children}
                                          </p>
                                        ),
                                        ul: ({ children }) => (
                                          <ul className="my-4 max-w-full space-y-2 pl-6">
                                            {children}
                                          </ul>
                                        ),
                                        ol: ({ children }) => (
                                          <ol className="my-4 max-w-full space-y-2 pl-6">
                                            {children}
                                          </ol>
                                        ),
                                        li: ({ children }) => (
                                          <li
                                            className="max-w-full pl-1"
                                            style={{ lineHeight: '1.7' }}
                                          >
                                            {children}
                                          </li>
                                        ),
                                      }}
                                    >
                                      {message.content}
                                    </ReactMarkdown>
                                  </div>

                                  {message.isStreaming && (
                                    <div className="text-muted-foreground mt-3 flex items-center gap-2 text-xs">
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      <span>Streaming...</span>
                                    </div>
                                  )}

                                  {/* ✅ Stats + Actions in one line */}
                                  {message.role === 'assistant' &&
                                    !message.content.includes('⚠️') &&
                                    !message.isStreaming &&
                                    !message.isThinking && (
                                      <div className="border-border/30 text-muted-foreground mt-3 flex items-center justify-between gap-3 border-t pt-2 text-xs">
                                        {/* ✅ LEFT SIDE: Token stats (only show if metadata exists) */}
                                        {message.metadata && (
                                          <div className="flex items-center gap-3">
                                            {message.metadata.runtime && (
                                              <div className="flex items-center gap-1">
                                                <Clock className="h-3.5 w-3.5" />
                                                {(message.metadata.runtime / 1000).toFixed(2)}s
                                              </div>
                                            )}
                                            {message.metadata.inputTokens !== undefined && (
                                              <div className="flex items-center gap-1">
                                                <MessageSquare className="h-3.5 w-3.5" />
                                                <span className="text-green-600 dark:text-green-400">
                                                  {message.metadata.inputTokens} in
                                                </span>
                                              </div>
                                            )}
                                            {message.metadata.outputTokens !== undefined && (
                                              <div className="flex items-center gap-1">
                                                <span className="text-blue-600 dark:text-blue-400">
                                                  {message.metadata.outputTokens} out
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        )}

                                        {/* ✅ RIGHT SIDE: Actions (always visible) */}
                                        <div className="flex items-center gap-1">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0"
                                            onClick={() => handleCopyResponse(message.content)}
                                            title="Copy response"
                                          >
                                            <Copy className="h-3 w-3" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0"
                                            onClick={() =>
                                              handleDownloadMarkdown(message.content, index)
                                            }
                                            title="Download as Markdown"
                                          >
                                            <Download className="h-3 w-3" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 gap-1 px-1.5 text-[10px]"
                                            onClick={() => handleCreateSource(message.content)}
                                            title="Create source node"
                                          >
                                            <FileTextIcon className="h-3 w-3" />
                                            <ArrowRight className="h-2.5 w-2.5" />
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                </>
                              )}
                            </div>

                            <span className="text-muted-foreground text-xs">
                              {message.timestamp.toLocaleTimeString()}
                            </span>
                          </div>
                        ))}

                        <div ref={chatEndRef} />
                      </div>
                    )}
                  </div>

                  {/* Scroll to bottom button */}
                  {showScrollButton && (
                    <Button
                      onClick={scrollToBottom}
                      size="sm"
                      className="nodrag bg-primary absolute right-4 bottom-4 z-50 h-10 w-10 rounded-full p-0 text-white shadow-xl transition-all hover:scale-110"
                      title="Scroll to bottom"
                    >
                      <ArrowDown className="h-5 w-5" />
                    </Button>
                  )}
                </div>

                {/* Input area */}
                <div className="border-border/50 bg-background shrink-0 space-y-3 border-t p-4">
                  <div className="relative">
                    <Textarea
                      ref={textareaRef}
                      value={userPrompt}
                      onChange={(e) => {
                        setUserPrompt(e.target.value);
                        if (textareaRef.current) {
                          textareaRef.current.style.height = 'auto';
                          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                          e.preventDefault();
                          handleExecute();
                        }
                        // Ctrl/Cmd+Enter adds newline (default behavior, don't prevent)
                      }}
                      placeholder="Ask anything... (Enter to send, Ctrl+Enter for newline)"
                      className="nodrag max-h-[200px] min-h-[100px] resize-none overflow-y-auto text-base"
                      disabled={isExecuting}
                      style={{ height: '100px' }}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Select
                      value={provider}
                      onValueChange={(v) => setProvider(v as LLMProvider)}
                      disabled={modelsLoading}
                    >
                      <SelectTrigger className="nodrag h-8 w-[110px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="nodrag">
                        {providers.map((p) => (
                          <SelectItem key={p} value={p}>
                            {getProviderDisplayName(p as LLMProvider)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={model} onValueChange={setModel} disabled={modelsLoading}>
                      <SelectTrigger className="nodrag h-8 flex-1 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="nodrag">
                        {availableModels.map((m) => (
                          <SelectItem key={m.modelId} value={m.modelId}>
                            {m.modelName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="nodrag h-8 w-8 p-0"
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      title="Advanced Settings"
                    >
                      {showAdvanced ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <Sliders className="h-4 w-4" />
                      )}
                    </Button>

                    <Button
                      size="sm"
                      onClick={handleExecute}
                      disabled={!userPrompt.trim() || isExecuting}
                      className="h-8 gap-1.5 text-xs"
                    >
                      {isExecuting ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="h-3.5 w-3.5" />
                          Send
                        </>
                      )}
                    </Button>
                  </div>

                  {showAdvanced && (
                    <div className="border-border/50 bg-muted/30 animate-in fade-in slide-in-from-top-2 space-y-3 rounded-lg border p-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Temperature</Label>
                          <span className="text-xs font-medium">{temperature.toFixed(1)}</span>
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
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Max Output Tokens (optional)</Label>
                        <Input
                          type="number"
                          value={maxTokens || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setMaxTokens(val ? parseInt(val) : undefined);
                          }}
                          placeholder="No limit (recommended)"
                          className="h-7 text-xs"
                        />
                        <p className="text-muted-foreground text-[10px]">
                          Leave empty for unlimited output
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Source Pod Content */}
            {isSourcePod && (
              <div className="bg-background flex min-h-0 flex-1 flex-col">
                <div className="shrink-0 p-4 pb-0">
                  <Select value={sourceType} onValueChange={handleSourceTypeChange}>
                    <SelectTrigger className="nodrag w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="nodrag">
                      <SelectItem value="text">
                        <div className="flex items-center gap-2">
                          <Type className="h-4 w-4" />
                          Text
                        </div>
                      </SelectItem>
                      <SelectItem value="document">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Document
                        </div>
                      </SelectItem>
                      <SelectItem value="url">
                        <div className="flex items-center gap-2">
                          <Link className="h-4 w-4" />
                          URL
                        </div>
                      </SelectItem>
                      <SelectItem value="youtube">
                        <div className="flex items-center gap-2">
                          <Youtube className="h-4 w-4" />
                          YouTube
                        </div>
                      </SelectItem>
                      <SelectItem value="image">
                        <div className="flex items-center gap-2">
                          <Image className="h-4 w-4" />
                          Image
                        </div>
                      </SelectItem>
                      <SelectItem value="video">
                        <div className="flex items-center gap-2">
                          <Video className="h-4 w-4" />
                          Video
                        </div>
                      </SelectItem>
                      <SelectItem value="audio">
                        <div className="flex items-center gap-2">
                          <Music className="h-4 w-4" />
                          Audio
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-4">
                  {sourceType === 'text' && (
                    <Textarea
                      placeholder="Enter your text here..."
                      className="nodrag min-h-[400px] resize-none"
                      value={sourceContent}
                      onChange={(e) => handleSourceContentChange(e.target.value)}
                    />
                  )}

                  {['document', 'image', 'video', 'audio'].includes(sourceType) && (
                    <div className="border-border/50 bg-muted/30 flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center">
                      <SourceIcon className="text-muted-foreground mb-3 h-12 w-12" />
                      <p className="text-muted-foreground mb-3 text-sm">No {sourceType} uploaded</p>
                      <Button size="sm" variant="outline" className="text-xs">
                        Upload {sourceType.charAt(0).toUpperCase() + sourceType.slice(1)}
                      </Button>
                    </div>
                  )}

                  {['url', 'youtube'].includes(sourceType) && (
                    <Input
                      type="url"
                      placeholder={`Enter ${sourceType === 'youtube' ? 'YouTube' : ''} URL...`}
                      className="nodrag"
                      value={sourceContent}
                      onChange={(e) => handleSourceContentChange(e.target.value)}
                    />
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});
