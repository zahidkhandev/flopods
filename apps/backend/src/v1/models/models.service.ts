import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LLMProvider } from '@flopods/schema';
import { plainToInstance } from 'class-transformer';
import { ModelPricingDto, ModelsByProviderDto } from './dto/model-response.dto';
import { ProviderInfoDto } from './dto/provider-response.dto';

@Injectable()
export class V1ModelsService {
  private readonly logger = new Logger(V1ModelsService.name);

  // Provider display names and capabilities
  private readonly PROVIDER_INFO: Record<
    LLMProvider,
    { displayName: string; capabilities: string[] }
  > = {
    [LLMProvider.OPENAI]: {
      displayName: 'OpenAI',
      capabilities: ['text', 'vision', 'function-calling', 'reasoning', 'streaming'],
    },
    [LLMProvider.ANTHROPIC]: {
      displayName: 'Anthropic',
      capabilities: ['text', 'vision', 'function-calling', 'streaming'],
    },
    [LLMProvider.GOOGLE_GEMINI]: {
      displayName: 'Google AI',
      capabilities: ['text', 'vision', 'function-calling', 'streaming'],
    },
    [LLMProvider.PERPLEXITY]: {
      displayName: 'Perplexity',
      capabilities: ['text', 'search', 'real-time'],
    },
    [LLMProvider.MISTRAL]: {
      displayName: 'Mistral AI',
      capabilities: ['text', 'function-calling'],
    },
    [LLMProvider.COHERE]: {
      displayName: 'Cohere',
      capabilities: ['text', 'embedding', 'reranking'],
    },
    [LLMProvider.GROQ]: {
      displayName: 'Groq',
      capabilities: ['text', 'ultra-fast'],
    },
    [LLMProvider.XAI]: {
      displayName: 'xAI',
      capabilities: ['text', 'function-calling'],
    },
    [LLMProvider.DEEPSEEK]: {
      displayName: 'DeepSeek',
      capabilities: ['text', 'reasoning', 'cost-effective'],
    },
    [LLMProvider.HUGGING_FACE]: {
      displayName: 'Hugging Face',
      capabilities: ['text', 'embedding', 'models', 'custom'],
    },
    [LLMProvider.CUSTOM]: {
      displayName: 'Custom',
      capabilities: ['text'],
    },
  };

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all available providers with model counts
   */
  async getAllProviders(): Promise<ProviderInfoDto[]> {
    const modelCounts = await this.prisma.modelPricingTier.groupBy({
      by: ['provider'],
      where: { isActive: true },
      _count: { modelId: true },
    });

    const providers = Object.values(LLMProvider).map((provider) => {
      const count = modelCounts.find((mc) => mc.provider === provider)?._count.modelId || 0;
      const info = this.PROVIDER_INFO[provider];

      return plainToInstance(ProviderInfoDto, {
        provider,
        displayName: info.displayName,
        modelCount: count,
        isAvailable: count > 0,
        capabilities: info.capabilities,
      });
    });

    return providers.filter((p) => p.isAvailable);
  }

  /**
   * Get all active models (latest pricing for each model)
   */
  async getAllModels(): Promise<ModelPricingDto[]> {
    const models = await this.prisma.modelPricingTier.findMany({
      where: { isActive: true },
      orderBy: [{ provider: 'asc' }, { modelId: 'asc' }],
      distinct: ['provider', 'modelId'],
    });

    return models.map((model) =>
      plainToInstance(ModelPricingDto, {
        modelId: model.modelId,
        modelName: model.displayName, // FIXED: Use displayName
        provider: model.provider,
        inputTokenCost: model.inputTokenCost.toString(),
        outputTokenCost: model.outputTokenCost.toString(),
        reasoningTokenCost: model.reasoningTokenCost?.toString() || null,
        contextWindow: model.maxTokens || 0, // FIXED: Use maxTokens
        supportsVision: model.supportsVision,
        supportsFunctionCalling: model.supportsFunctions, // FIXED: Use supportsFunctions
        supportsStreaming: model.supportsStreaming,
        isActive: model.isActive,
        effectiveFrom: model.effectiveFrom,
      }),
    );
  }

  /**
   * Get models by specific provider
   */
  async getModelsByProvider(provider: LLMProvider): Promise<ModelsByProviderDto> {
    const models = await this.prisma.modelPricingTier.findMany({
      where: {
        provider,
        isActive: true,
      },
      orderBy: { modelId: 'asc' },
      distinct: ['modelId'],
    });

    const modelDtos = models.map((model) =>
      plainToInstance(ModelPricingDto, {
        modelId: model.modelId,
        modelName: model.displayName, // FIXED
        provider: model.provider,
        inputTokenCost: model.inputTokenCost.toString(),
        outputTokenCost: model.outputTokenCost.toString(),
        reasoningTokenCost: model.reasoningTokenCost?.toString() || null,
        contextWindow: model.maxTokens || 0, // FIXED
        supportsVision: model.supportsVision,
        supportsFunctionCalling: model.supportsFunctions, // FIXED
        supportsStreaming: model.supportsStreaming,
        isActive: model.isActive,
        effectiveFrom: model.effectiveFrom,
      }),
    );

    return plainToInstance(ModelsByProviderDto, {
      provider,
      models: modelDtos,
      count: modelDtos.length,
    });
  }

  /**
   * Get specific model details
   */
  async getModelById(provider: LLMProvider, modelId: string): Promise<ModelPricingDto | null> {
    const model = await this.prisma.modelPricingTier.findFirst({
      where: {
        provider,
        modelId,
        isActive: true,
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (!model) return null;

    return plainToInstance(ModelPricingDto, {
      modelId: model.modelId,
      modelName: model.displayName, // FIXED
      provider: model.provider,
      inputTokenCost: model.inputTokenCost.toString(),
      outputTokenCost: model.outputTokenCost.toString(),
      reasoningTokenCost: model.reasoningTokenCost?.toString() || null,
      contextWindow: model.maxTokens || 0, // FIXED
      supportsVision: model.supportsVision,
      supportsFunctionCalling: model.supportsFunctions, // FIXED
      supportsStreaming: model.supportsStreaming,
      isActive: model.isActive,
      effectiveFrom: model.effectiveFrom,
    });
  }

  /**
   * Get models grouped by provider
   */
  async getModelsGroupedByProvider(): Promise<ModelsByProviderDto[]> {
    const providers = await this.getAllProviders();

    const groupedModels = await Promise.all(
      providers.map((provider) => this.getModelsByProvider(provider.provider)),
    );

    return groupedModels;
  }
}
