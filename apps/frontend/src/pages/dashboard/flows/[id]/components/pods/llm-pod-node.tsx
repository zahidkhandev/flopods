import { memo, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Node, NodeProps } from 'reactflow';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import hljs from 'highlight.js';
import BasePodNode from './base-pod-node';
import {
  Sparkles,
  Settings2,
  MessageSquare,
  Loader2,
  Clock,
  Send,
  Download,
  GitBranch,
  Sliders,
  Copy,
  Check,
  ChevronUp,
  ArrowDown,
  FileText,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePodExecutions } from '../../hooks/use-executions';
import { useModels } from '../../context/models-context';
import { useCanvas } from '../../context/canvas-context';
import { cn } from '@/lib/utils';
import { useParams } from 'react-router-dom';
import { axiosInstance } from '@/lib/axios-instance';
import { useWorkspaces } from '@/hooks/use-workspaces';
import { toast } from '@/lib/toast-utils';
import { PodExecutionStatus, LLMProvider, LLMPodData, Message } from '../../types';
import { useStreamingExecution } from '../../hooks/use-streaming-execution';
import DOMPurify from 'dompurify';

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
      <pre className="border-border/50 !m-0 w-full overflow-x-auto rounded-lg border bg-zinc-100 !p-4 dark:bg-zinc-900">
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
}

export default memo(function LLMPodNode({
  id: nodeId,
  data,
  selected,
  xPos,
  yPos,
}: NodeProps<LLMPodData>) {
  const { id: flowId } = useParams<{ id: string }>();
  const { currentWorkspaceId } = useWorkspaces();

  const { providers, getModelsForProvider, isLoading: modelsLoading } = useModels();
  const { updateNodeData, addNode, addEdge } = useCanvas();

  const [podName, setPodName] = useState(data.label);
  const [provider, setProvider] = useState<LLMProvider>(data.config.provider);
  const [model, setModel] = useState(data.config.model);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [temperature, setTemperature] = useState(data.config.temperature ?? 0.7);
  const [maxTokens, setMaxTokens] = useState<number | undefined>(undefined);

  const [userPrompt, setUserPrompt] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [selectedText, setSelectedText] = useState<string>('');
  const [selectionPosition, setSelectionPosition] = useState<{ x: number; y: number } | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const { data: executionHistory, refetch: refetchExecutions } = usePodExecutions(flowId!, nodeId);
  const availableModels = getModelsForProvider(provider);

  const { executeStreaming } = useStreamingExecution({
    onToken: (token) => {
      setStreamingContent((prev) => prev + token);
    },
    onStart: (_executionId) => {
      setStreamingContent('');
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
      setIsExecuting(false);

      refetchExecutions().then(() => {});
    },
    onError: (error) => {
      const errorMsg: Message = {
        role: 'assistant',
        content: `⚠️ ${error}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
      setStreamingContent('');
      setIsExecuting(false);
      toast.error('Execution failed');
    },
  });

  const displayMessages = useMemo(() => {
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
  }, [messages, streamingContent]);

  // Get the actual scrollable viewport inside ScrollArea
  const getScrollContainer = useCallback(() => {
    return chatContainerRef.current?.querySelector(
      '[data-radix-scroll-area-viewport]'
    ) as HTMLDivElement;
  }, []);

  // Load ALL execution history into continuous conversation
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

  // Auto-load ALL history on mount
  useEffect(() => {
    if (executionHistory && executionHistory.length > 0 && messages.length === 0) {
      loadAllExecutionHistory();
    }
  }, [executionHistory, messages.length, loadAllExecutionHistory]);

  // Auto-scroll to bottom + detect manual scroll (FIXED for ScrollArea)
  useEffect(() => {
    const viewport = getScrollContainer();
    if (!viewport) return;

    // Force scroll to bottom
    const scrollToBottom = () => {
      viewport.scrollTop = viewport.scrollHeight;
    };

    // Small delay to ensure DOM is ready
    setTimeout(scrollToBottom, 50);

    // Detect if user scrolled up
    const handleScroll = () => {
      const isAtBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 100;
      setShowScrollButton(!isAtBottom);
    };

    viewport.addEventListener('scroll', handleScroll);
    return () => viewport.removeEventListener('scroll', handleScroll);
  }, [displayMessages, getScrollContainer]);

  useEffect(() => {
    const handleSelection = () => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();

      if (
        text &&
        text.length > 0 &&
        chatContainerRef.current?.contains(selection?.anchorNode || null)
      ) {
        const range = selection?.getRangeAt(0);
        if (range) {
          const rect = range.getBoundingClientRect();
          setSelectionPosition({
            x: rect.left + window.scrollX + rect.width / 2,
            y: rect.top + window.scrollY - 10,
          });
        }
        setSelectedText(text);
      } else {
        setSelectedText('');
        setSelectionPosition(null);
      }
    };

    document.addEventListener('selectionchange', handleSelection);
    return () => document.removeEventListener('selectionchange', handleSelection);
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

  const handleNameChange = useCallback(
    (newName: string) => {
      setPodName(newName);
      updateNodeData(nodeId, { label: newName });
    },
    [nodeId, updateNodeData]
  );

  const handleProviderChange = useCallback(
    (newProvider: string) => {
      const providerEnum = newProvider as LLMProvider;
      setProvider(providerEnum);
      const models = getModelsForProvider(providerEnum);
      const newModel = models[0]?.modelId || '';
      setModel(newModel);
      updateNodeData(nodeId, {
        config: { ...data.config, provider: providerEnum, model: newModel },
      });
    },
    [nodeId, data.config, updateNodeData, getModelsForProvider]
  );

  const handleModelChange = useCallback(
    (newModel: string) => {
      setModel(newModel);
      updateNodeData(nodeId, {
        config: { ...data.config, model: newModel },
      });
    },
    [nodeId, data.config, updateNodeData]
  );

  const handleTemperatureChange = useCallback(
    (newTemp: number) => {
      setTemperature(newTemp);
      updateNodeData(nodeId, {
        config: { ...data.config, temperature: newTemp },
      });
    },
    [nodeId, data.config, updateNodeData]
  );

  const handleExecute = useCallback(
    async (e?: React.MouseEvent | React.KeyboardEvent) => {
      e?.stopPropagation();
      e?.preventDefault();

      if (!userPrompt.trim() || isExecuting) return;

      const newUserMessage: Message = {
        role: 'user',
        content: userPrompt,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, newUserMessage]);
      setUserPrompt('');
      setIsExecuting(true);
      setStreamingContent('');

      if (textareaRef.current) {
        textareaRef.current.style.height = '90px';
        textareaRef.current.focus({ preventScroll: true });
      }

      try {
        const params: any = {
          podId: nodeId,
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
        console.error('Execution error:', error);
      }
    },
    [userPrompt, nodeId, provider, model, temperature, maxTokens, isExecuting, executeStreaming]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleExecute(e);
      }
    },
    [handleExecute]
  );

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
      const newNodePosition = { x: xPos + 550, y: yPos };

      try {
        const newNodeData: Partial<Node> = {
          type: 'SOURCE', // CHANGED from 'SourceInput' to 'SOURCE' to match nodeTypes
          position: newNodePosition,
          data: {
            label: 'Source', // Changed from 'Response Source' to just 'Source'
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
            source: nodeId,
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
    [xPos, yPos, nodeId, addNode, addEdge]
  );

  const handleBranchOut = useCallback(async () => {
    if (!selectedText) return;

    const newNodePosition = { x: xPos + 550, y: yPos };

    const newConfig = {
      provider,
      model,
      temperature,
      maxTokens: undefined,
      systemPrompt: '',
    };

    try {
      const newNodeData: Partial<Node> = {
        type: 'LLM',
        position: newNodePosition,
        data: {
          label: `Query: ${selectedText.substring(0, 20)}...`,
          config: newConfig,
          executionStatus: PodExecutionStatus.IDLE,
          backendType: 'LLM_PROMPT',
        },
      };

      const newNodeId = await addNode(newNodeData);

      if (newNodeId) {
        await addEdge({
          source: nodeId,
          target: newNodeId,
          type: 'animated',
        });
      }

      toast.success('Branched out to new LLM pod');
    } catch (error) {
      console.error('Failed to branch:', error);
      toast.error('Failed to create branch');
    } finally {
      setSelectedText('');
      setSelectionPosition(null);
      window.getSelection()?.removeAllRanges();
    }
  }, [selectedText, xPos, yPos, provider, model, temperature, nodeId, addNode, addEdge]);

  const handleBranchPod = useCallback(async () => {
    const newNodePosition = { x: xPos + 550, y: yPos };

    const newConfig = {
      provider,
      model,
      temperature,
      maxTokens: undefined,
      systemPrompt: data.config.systemPrompt || '',
    };

    try {
      const newNodeData: Partial<Node> = {
        type: 'LLM',
        position: newNodePosition,
        data: {
          label: `${podName} (Branch)`,
          config: newConfig,
          executionStatus: PodExecutionStatus.IDLE,
          backendType: 'LLM_PROMPT',
        },
      };

      const newNodeId = await addNode(newNodeData);

      if (newNodeId) {
        await addEdge({
          source: nodeId,
          target: newNodeId,
          type: 'animated',
        });
      }

      toast.success('Branched to new LLM pod');
    } catch (error) {
      console.error('Failed to branch pod:', error);
      toast.error('Failed to create branch');
    }
  }, [
    xPos,
    yPos,
    podName,
    provider,
    model,
    temperature,
    data.config.systemPrompt,
    nodeId,
    addNode,
    addEdge,
  ]);

  const customHeader = (
    <div className="flex items-center gap-2">
      <Sparkles className="h-4 w-4" />
      <Input
        value={podName}
        onChange={(e) => handleNameChange(e.target.value)}
        className="nodrag border-none bg-transparent p-0 text-sm font-semibold focus-visible:ring-0"
        placeholder="Pod name..."
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="nodrag ml-auto h-6 w-6 p-0">
            <Settings2 className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="nodrag">
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleBranchPod}>
            <GitBranch className="mr-2 h-4 w-4" />
            Branch Pod
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <>
      {selectedText && selectionPosition && (
        <div
          className="pointer-events-none absolute z-[9999]"
          style={{
            left: `${selectionPosition.x}px`,
            top: `${selectionPosition.y}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <Button
            size="sm"
            className="bg-primary text-primary-foreground animate-in fade-in zoom-in-95 hover:bg-primary/90 pointer-events-auto h-7 gap-1.5 text-xs shadow-xl duration-150"
            onClick={handleBranchOut}
          >
            <GitBranch className="h-3 w-3" />
            Branch Out
          </Button>
        </div>
      )}

      <BasePodNode
        title={customHeader}
        icon={<Sparkles className="h-5 w-5" />}
        status={data.executionStatus}
        variant="process"
        selected={selected}
      >
        <div className="border-border/50 -mx-4 -mb-4 flex min-w-0 flex-col border-t">
          <div className="relative" ref={chatContainerRef}>
            <ScrollArea className="nodrag nowheel h-[500px] px-4 pt-4">
              {isLoadingHistory ? (
                <div className="flex h-full items-center justify-center">
                  <div className="text-muted-foreground flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p className="text-sm">Loading conversation history...</p>
                  </div>
                </div>
              ) : displayMessages.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <div className="text-muted-foreground flex flex-col items-center gap-3 text-center">
                    <MessageSquare className="h-10 w-10 opacity-30" />
                    <p className="text-sm">Start a conversation</p>
                  </div>
                </div>
              ) : (
                <div className="min-w-0 space-y-6 pb-4">
                  {displayMessages.map((message, index) => (
                    <div
                      key={index}
                      className={cn(
                        'group flex min-w-0 flex-col gap-2',
                        message.role === 'user' ? 'items-end' : 'items-start'
                      )}
                    >
                      <div
                        className={cn(
                          'max-w-[92%] min-w-0 overflow-hidden rounded-2xl px-5 py-4 shadow-sm',
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : message.content.includes('⚠️')
                              ? 'border-destructive/30 bg-destructive/5 border'
                              : 'border-border/50 bg-card border',
                          message.isStreaming && 'animate-pulse'
                        )}
                      >
                        <div
                          className="prose prose-sm dark:prose-invert max-w-full min-w-0 select-text [&_code]:max-w-full [&_pre]:max-w-full [&>*]:max-w-full"
                          style={{
                            fontSize: '15px',
                            lineHeight: '1.8',
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
                                    lineHeight: '1.8',
                                    wordBreak: 'break-word',
                                    overflowWrap: 'anywhere',
                                  }}
                                >
                                  {children}
                                </p>
                              ),
                              ul: ({ children }) => (
                                <ul className="my-4 max-w-full space-y-2 pl-6">{children}</ul>
                              ),
                              ol: ({ children }) => (
                                <ol className="my-4 max-w-full space-y-2 pl-6">{children}</ol>
                              ),
                              li: ({ children }) => (
                                <li className="max-w-full pl-1" style={{ lineHeight: '1.8' }}>
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

                        {message.role === 'assistant' &&
                          (message.metadata || !message.content.includes('⚠️')) &&
                          !message.isStreaming && (
                            <div className="border-border/30 text-muted-foreground mt-3 flex items-center justify-between gap-3 border-t pt-2 text-xs">
                              {/* LEFT SIDE: Token stats */}
                              <div className="flex items-center gap-3">
                                {message.metadata?.runtime && (
                                  <div className="flex items-center gap-1.5">
                                    <Clock className="h-3.5 w-3.5" />
                                    {(message.metadata.runtime / 1000).toFixed(2)}s
                                  </div>
                                )}
                                {message.metadata?.inputTokens !== undefined && (
                                  <div className="flex items-center gap-1.5">
                                    <MessageSquare className="h-3.5 w-3.5" />
                                    <span className="text-green-600 dark:text-green-400">
                                      {message.metadata.inputTokens} in
                                    </span>
                                  </div>
                                )}
                                {message.metadata?.outputTokens !== undefined && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-blue-600 dark:text-blue-400">
                                      {message.metadata.outputTokens} out
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* RIGHT SIDE: Always visible action icons */}
                              {!message.content.includes('⚠️') && (
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
                                    onClick={() => handleDownloadMarkdown(message.content, index)}
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
                                    <FileText className="h-3 w-3" />
                                    <ArrowRight className="h-2.5 w-2.5" />
                                  </Button>
                                </div>
                              )}
                            </div>
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
            </ScrollArea>

            {/* Scroll to bottom button */}
            {showScrollButton && (
              <Button
                onClick={scrollToBottom}
                size="sm"
                className="nodrag bg-primary absolute right-[50%] bottom-2 z-50 h-10 w-10 rounded-full border-2 p-0 text-white shadow-xl transition-all hover:scale-110"
                title="Scroll to bottom"
              >
                <ArrowDown className="h-5 w-5" />
              </Button>
            )}
          </div>

          <div className="nodrag bg-background/50 flex flex-col gap-3 p-4">
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
                onKeyDown={handleKeyDown}
                placeholder="Ask anything... (⌘+Enter)"
                className="max-h-[200px] min-h-[90px] resize-none overflow-y-auto text-sm"
                disabled={isExecuting}
                style={{ height: '90px' }}
              />
            </div>

            <div className="flex items-center gap-2">
              <Select
                value={provider}
                onValueChange={handleProviderChange}
                disabled={modelsLoading}
              >
                <SelectTrigger className="h-7 w-[100px] text-[10px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((p) => (
                    <SelectItem key={p} value={p}>
                      {getProviderDisplayName(p as LLMProvider)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={model} onValueChange={handleModelChange} disabled={modelsLoading}>
                <SelectTrigger className="h-7 flex-1 text-[10px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
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
                className="h-7 w-7 p-0"
                onClick={() => setShowAdvanced(!showAdvanced)}
                title="Advanced Settings"
              >
                {showAdvanced ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <Sliders className="h-3.5 w-3.5" />
                )}
              </Button>

              <Button
                size="sm"
                onClick={() => handleExecute()}
                disabled={!userPrompt.trim() || isExecuting}
                className="h-7 gap-1.5 text-xs"
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
                    onChange={(e) => handleTemperatureChange(parseFloat(e.target.value))}
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
      </BasePodNode>
    </>
  );
});
