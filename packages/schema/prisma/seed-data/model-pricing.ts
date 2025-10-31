import path from 'path';
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

import { PrismaClient, LLMProvider, ModelCategory } from '@flopods/schema';

const prisma = new PrismaClient({
  log: ['error'],
});

/**
 * Model Pricing Data - October 2025
 * Based on official pricing from:
 * - OpenAI: https://openai.com/api/pricing/
 * - Anthropic: https://docs.anthropic.com/
 * - Google: https://ai.google.dev/gemini-api/docs/pricing
 *
 * Credit multiplier: 10,000x (e.g., $1.25 per 1M tokens = 12,500 credits)
 * Updated maxOutputTokens based on official documentation
 */
export const MODEL_PRICING_DATA = [
  // ==========================================
  // OPENAI - GPT-5 SERIES (FLAGSHIP)
  // ==========================================
  {
    provider: 'OPENAI' as LLMProvider,
    modelId: 'gpt-5',
    category: 'POWERHOUSE' as ModelCategory,
    displayName: 'GPT-5',
    description: 'Best model for coding and agentic tasks across industries',
    inputTokenCost: 0.00000125,
    outputTokenCost: 0.00001,
    reasoningTokenCost: 0,
    creditsPerMillionInputTokens: 12500,
    creditsPerMillionOutputTokens: 100000,
    creditsPerMillionReasoningTokens: 0,
    maxTokens: 256000,
    maxOutputTokens: 32768,
    supportsStreaming: true,
    supportsVision: true,
    supportsAudio: true,
    supportsFunctions: true,
    supportsJsonMode: true,
    supportsSystemPrompt: true,
  },
  {
    provider: 'OPENAI' as LLMProvider,
    modelId: 'gpt-5-mini',
    category: 'WORKHORSE' as ModelCategory,
    displayName: 'GPT-5 Mini',
    description: 'Faster, cheaper version of GPT-5 for well-defined tasks',
    inputTokenCost: 0.00000025,
    outputTokenCost: 0.000002,
    reasoningTokenCost: 0,
    creditsPerMillionInputTokens: 2500,
    creditsPerMillionOutputTokens: 20000,
    creditsPerMillionReasoningTokens: 0,
    maxTokens: 256000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    supportsVision: true,
    supportsFunctions: true,
    supportsJsonMode: true,
    supportsSystemPrompt: true,
  },
  {
    provider: 'OPENAI' as LLMProvider,
    modelId: 'gpt-5-nano',
    category: 'WORKHORSE' as ModelCategory,
    displayName: 'GPT-5 Nano',
    description: 'Fastest, cheapest version of GPT-5 for summarization and classification',
    inputTokenCost: 0.00000005,
    outputTokenCost: 0.0000004,
    reasoningTokenCost: 0,
    creditsPerMillionInputTokens: 500,
    creditsPerMillionOutputTokens: 4000,
    creditsPerMillionReasoningTokens: 0,
    maxTokens: 128000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsFunctions: true,
    supportsJsonMode: true,
    supportsSystemPrompt: true,
  },
  {
    provider: 'OPENAI' as LLMProvider,
    modelId: 'gpt-5-pro',
    category: 'POWERHOUSE' as ModelCategory,
    displayName: 'GPT-5 Pro',
    description: 'Smartest and most precise model',
    inputTokenCost: 0.000015,
    outputTokenCost: 0.00012,
    reasoningTokenCost: 0,
    creditsPerMillionInputTokens: 150000,
    creditsPerMillionOutputTokens: 1200000,
    creditsPerMillionReasoningTokens: 0,
    maxTokens: 256000,
    maxOutputTokens: 64000,
    supportsStreaming: true,
    supportsVision: true,
    supportsAudio: true,
    supportsFunctions: true,
    supportsJsonMode: true,
    supportsSystemPrompt: true,
  },

  // === GPT-4.1 SERIES ===
  {
    provider: 'OPENAI' as LLMProvider,
    modelId: 'gpt-4.1',
    category: 'POWERHOUSE' as ModelCategory,
    displayName: 'GPT-4.1',
    description: 'Smartest non-reasoning model',
    inputTokenCost: 0.000003,
    outputTokenCost: 0.000012,
    reasoningTokenCost: 0,
    creditsPerMillionInputTokens: 30000,
    creditsPerMillionOutputTokens: 120000,
    creditsPerMillionReasoningTokens: 0,
    maxTokens: 128000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    supportsVision: true,
    supportsFunctions: true,
    supportsJsonMode: true,
    supportsSystemPrompt: true,
  },
  {
    provider: 'OPENAI' as LLMProvider,
    modelId: 'gpt-4.1-mini',
    category: 'WORKHORSE' as ModelCategory,
    displayName: 'GPT-4.1 Mini',
    description: 'Smaller, faster version of GPT-4.1',
    inputTokenCost: 0.0000008,
    outputTokenCost: 0.0000032,
    reasoningTokenCost: 0,
    creditsPerMillionInputTokens: 8000,
    creditsPerMillionOutputTokens: 32000,
    creditsPerMillionReasoningTokens: 0,
    maxTokens: 128000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    supportsVision: true,
    supportsFunctions: true,
    supportsJsonMode: true,
    supportsSystemPrompt: true,
  },
  {
    provider: 'OPENAI' as LLMProvider,
    modelId: 'gpt-4.1-nano',
    category: 'WORKHORSE' as ModelCategory,
    displayName: 'GPT-4.1 Nano',
    description: 'Fastest, most cost-efficient version of GPT-4.1',
    inputTokenCost: 0.0000002,
    outputTokenCost: 0.0000008,
    reasoningTokenCost: 0,
    creditsPerMillionInputTokens: 2000,
    creditsPerMillionOutputTokens: 8000,
    creditsPerMillionReasoningTokens: 0,
    maxTokens: 128000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsFunctions: true,
    supportsJsonMode: true,
    supportsSystemPrompt: true,
  },

  // === O-SERIES REASONING MODELS ===
  {
    provider: 'OPENAI' as LLMProvider,
    modelId: 'o3',
    category: 'REASONING' as ModelCategory,
    displayName: 'O3',
    description: 'Reasoning model for complex tasks',
    inputTokenCost: 0.000015,
    outputTokenCost: 0.00006,
    reasoningTokenCost: 0.00006,
    creditsPerMillionInputTokens: 150000,
    creditsPerMillionOutputTokens: 600000,
    creditsPerMillionReasoningTokens: 600000,
    maxTokens: 200000,
    maxOutputTokens: 100000,
    supportsStreaming: true,
    supportsFunctions: false,
    supportsJsonMode: false,
    supportsSystemPrompt: true,
  },
  {
    provider: 'OPENAI' as LLMProvider,
    modelId: 'o3-pro',
    category: 'REASONING' as ModelCategory,
    displayName: 'O3 Pro',
    description: 'More compute for better reasoning',
    inputTokenCost: 0.00003,
    outputTokenCost: 0.00012,
    reasoningTokenCost: 0.00012,
    creditsPerMillionInputTokens: 300000,
    creditsPerMillionOutputTokens: 1200000,
    creditsPerMillionReasoningTokens: 1200000,
    maxTokens: 200000,
    maxOutputTokens: 100000,
    supportsStreaming: true,
    supportsFunctions: false,
    supportsJsonMode: false,
    supportsSystemPrompt: true,
  },
  {
    provider: 'OPENAI' as LLMProvider,
    modelId: 'o4-mini',
    category: 'REASONING' as ModelCategory,
    displayName: 'O4 Mini',
    description: 'Fast, cost-efficient reasoning model',
    inputTokenCost: 0.000004,
    outputTokenCost: 0.000016,
    reasoningTokenCost: 0.000016,
    creditsPerMillionInputTokens: 40000,
    creditsPerMillionOutputTokens: 160000,
    creditsPerMillionReasoningTokens: 160000,
    maxTokens: 128000,
    maxOutputTokens: 65536,
    supportsStreaming: true,
    supportsFunctions: false,
    supportsJsonMode: false,
    supportsSystemPrompt: false,
  },

  // === GPT-4O SERIES (Previous Gen) ===
  {
    provider: 'OPENAI' as LLMProvider,
    modelId: 'gpt-4o',
    category: 'POWERHOUSE' as ModelCategory,
    displayName: 'GPT-4o',
    description: 'Fast, intelligent, flexible GPT model',
    inputTokenCost: 0.0000025,
    outputTokenCost: 0.00001,
    reasoningTokenCost: 0,
    creditsPerMillionInputTokens: 25000,
    creditsPerMillionOutputTokens: 100000,
    creditsPerMillionReasoningTokens: 0,
    maxTokens: 128000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    supportsVision: true,
    supportsAudio: true,
    supportsFunctions: true,
    supportsJsonMode: true,
    supportsSystemPrompt: true,
  },
  {
    provider: 'OPENAI' as LLMProvider,
    modelId: 'gpt-4o-mini',
    category: 'WORKHORSE' as ModelCategory,
    displayName: 'GPT-4o Mini',
    description: 'Fast, affordable small model',
    inputTokenCost: 0.00000015,
    outputTokenCost: 0.0000006,
    reasoningTokenCost: 0,
    creditsPerMillionInputTokens: 1500,
    creditsPerMillionOutputTokens: 6000,
    creditsPerMillionReasoningTokens: 0,
    maxTokens: 128000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    supportsVision: true,
    supportsFunctions: true,
    supportsJsonMode: true,
    supportsSystemPrompt: true,
  },

  // ==========================================
  // ANTHROPIC - CLAUDE 4.5 SERIES
  // ==========================================
  {
    provider: 'ANTHROPIC' as LLMProvider,
    modelId: 'claude-sonnet-4-5-20250929',
    category: 'POWERHOUSE' as ModelCategory,
    displayName: 'Claude Sonnet 4.5',
    description: 'Smartest model for complex agents and coding',
    inputTokenCost: 0.000003,
    outputTokenCost: 0.000015,
    reasoningTokenCost: 0,
    creditsPerMillionInputTokens: 30000,
    creditsPerMillionOutputTokens: 150000,
    creditsPerMillionReasoningTokens: 0,
    maxTokens: 200000,
    maxOutputTokens: 64000,
    supportsStreaming: true,
    supportsVision: true,
    supportsFunctions: true,
    supportsJsonMode: false,
    supportsSystemPrompt: true,
  },
  {
    provider: 'ANTHROPIC' as LLMProvider,
    modelId: 'claude-haiku-4-5-20250929',
    category: 'WORKHORSE' as ModelCategory,
    displayName: 'Claude Haiku 4.5',
    description: 'Fastest model with near-frontier intelligence',
    inputTokenCost: 0.000001,
    outputTokenCost: 0.000005,
    reasoningTokenCost: 0,
    creditsPerMillionInputTokens: 10000,
    creditsPerMillionOutputTokens: 50000,
    creditsPerMillionReasoningTokens: 0,
    maxTokens: 200000,
    maxOutputTokens: 10000,
    supportsStreaming: true,
    supportsVision: true,
    supportsFunctions: true,
    supportsJsonMode: false,
    supportsSystemPrompt: true,
  },
  {
    provider: 'ANTHROPIC' as LLMProvider,
    modelId: 'claude-opus-4-1-20250808',
    category: 'POWERHOUSE' as ModelCategory,
    displayName: 'Claude Opus 4.1',
    description: 'Exceptional model for specialized reasoning',
    inputTokenCost: 0.000015,
    outputTokenCost: 0.000075,
    reasoningTokenCost: 0,
    creditsPerMillionInputTokens: 150000,
    creditsPerMillionOutputTokens: 750000,
    creditsPerMillionReasoningTokens: 0,
    maxTokens: 200000,
    maxOutputTokens: 32000,
    supportsStreaming: true,
    supportsVision: true,
    supportsFunctions: true,
    supportsJsonMode: false,
    supportsSystemPrompt: true,
  },

  // === CLAUDE 3.5 SERIES (Previous Gen) ===
  {
    provider: 'ANTHROPIC' as LLMProvider,
    modelId: 'claude-3-5-sonnet-20241022',
    category: 'POWERHOUSE' as ModelCategory,
    displayName: 'Claude 3.5 Sonnet',
    description: 'Balance of intelligence and speed',
    inputTokenCost: 0.000003,
    outputTokenCost: 0.000015,
    reasoningTokenCost: 0,
    creditsPerMillionInputTokens: 30000,
    creditsPerMillionOutputTokens: 150000,
    creditsPerMillionReasoningTokens: 0,
    maxTokens: 200000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: true,
    supportsFunctions: true,
    supportsJsonMode: false,
    supportsSystemPrompt: true,
  },
  {
    provider: 'ANTHROPIC' as LLMProvider,
    modelId: 'claude-3-5-haiku-20241022',
    category: 'WORKHORSE' as ModelCategory,
    displayName: 'Claude 3.5 Haiku',
    description: 'Fastest model for everyday tasks',
    inputTokenCost: 0.0000008,
    outputTokenCost: 0.000004,
    reasoningTokenCost: 0,
    creditsPerMillionInputTokens: 8000,
    creditsPerMillionOutputTokens: 40000,
    creditsPerMillionReasoningTokens: 0,
    maxTokens: 200000,
    maxOutputTokens: 10000,
    supportsStreaming: true,
    supportsVision: true,
    supportsFunctions: false,
    supportsJsonMode: false,
    supportsSystemPrompt: true,
  },

  // ==========================================
  // GOOGLE GEMINI - 2.5 SERIES (LATEST)
  // ==========================================
  {
    provider: 'GOOGLE_GEMINI' as LLMProvider,
    modelId: 'gemini-2.5-pro',
    category: 'POWERHOUSE' as ModelCategory,
    displayName: 'Gemini 2.5 Pro',
    description: 'State-of-the-art thinking model for complex reasoning',
    inputTokenCost: 0.00000125,
    outputTokenCost: 0.00001,
    reasoningTokenCost: 0,
    creditsPerMillionInputTokens: 12500,
    creditsPerMillionOutputTokens: 100000,
    creditsPerMillionReasoningTokens: 0,
    maxTokens: 2000000,
    maxOutputTokens: 65535,
    supportsStreaming: true,
    supportsVision: true,
    supportsAudio: true,
    supportsVideo: true,
    supportsFunctions: true,
    supportsJsonMode: true,
    supportsSystemPrompt: true,
  },
  {
    provider: 'GOOGLE_GEMINI' as LLMProvider,
    modelId: 'gemini-2.5-flash',
    category: 'WORKHORSE' as ModelCategory,
    displayName: 'Gemini 2.5 Flash',
    description: 'Best price-performance with thinking capabilities',
    inputTokenCost: 0.0000003,
    outputTokenCost: 0.0000025,
    reasoningTokenCost: 0,
    creditsPerMillionInputTokens: 3000,
    creditsPerMillionOutputTokens: 25000,
    creditsPerMillionReasoningTokens: 0,
    maxTokens: 1000000,
    maxOutputTokens: 65535,
    supportsStreaming: true,
    supportsVision: true,
    supportsAudio: true,
    supportsFunctions: true,
    supportsJsonMode: true,
    supportsSystemPrompt: true,
  },
  {
    provider: 'GOOGLE_GEMINI' as LLMProvider,
    modelId: 'gemini-2.5-flash-lite',
    category: 'WORKHORSE' as ModelCategory,
    displayName: 'Gemini 2.5 Flash-Lite',
    description: 'Ultra fast, optimized for cost-efficiency',
    inputTokenCost: 0.0000001,
    outputTokenCost: 0.0000004,
    reasoningTokenCost: 0,
    creditsPerMillionInputTokens: 1000,
    creditsPerMillionOutputTokens: 4000,
    creditsPerMillionReasoningTokens: 0,
    maxTokens: 1000000,
    maxOutputTokens: 65535,
    supportsStreaming: true,
    supportsVision: true,
    supportsFunctions: true,
    supportsJsonMode: true,
    supportsSystemPrompt: true,
  },

  // === GEMINI 2.0 SERIES (Previous Gen) ===
  {
    provider: 'GOOGLE_GEMINI' as LLMProvider,
    modelId: 'gemini-2.0-flash',
    category: 'WORKHORSE' as ModelCategory,
    displayName: 'Gemini 2.0 Flash',
    description: 'Balanced multimodal model with 1M context',
    inputTokenCost: 0.0000001,
    outputTokenCost: 0.0000004,
    reasoningTokenCost: 0,
    creditsPerMillionInputTokens: 1000,
    creditsPerMillionOutputTokens: 4000,
    creditsPerMillionReasoningTokens: 0,
    maxTokens: 1000000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: true,
    supportsFunctions: true,
    supportsJsonMode: true,
    supportsSystemPrompt: true,
  },
  {
    provider: 'GOOGLE_GEMINI' as LLMProvider,
    modelId: 'gemini-1.5-pro',
    category: 'POWERHOUSE' as ModelCategory,
    displayName: 'Gemini 1.5 Pro',
    description: 'Long context window (Legacy)',
    inputTokenCost: 0.00000125,
    outputTokenCost: 0.000005,
    reasoningTokenCost: 0,
    creditsPerMillionInputTokens: 12500,
    creditsPerMillionOutputTokens: 50000,
    creditsPerMillionReasoningTokens: 0,
    maxTokens: 2000000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsVision: true,
    supportsAudio: true,
    supportsVideo: true,
    supportsFunctions: true,
    supportsJsonMode: true,
    supportsSystemPrompt: true,
  },
];

/**
 * Seeds the model pricing tiers into the database with batch processing
 * for optimal performance. Uses parallel upserts to speed up seeding.
 */
async function seedModelPricing() {
  console.log('🌱 Seeding model pricing (October 2025 - Official Pricing)...\n');

  const effectiveFrom = new Date('2025-10-01');
  let count = 0;

  // Batch insert for speed (5 models per batch)
  const batchSize = 5;
  for (let i = 0; i < MODEL_PRICING_DATA.length; i += batchSize) {
    const batch = MODEL_PRICING_DATA.slice(i, i + batchSize);

    await Promise.all(
      batch.map((model) =>
        prisma.modelPricingTier.upsert({
          where: {
            provider_modelId_effectiveFrom: {
              provider: model.provider,
              modelId: model.modelId,
              effectiveFrom,
            },
          },
          update: model,
          create: {
            ...model,
            effectiveFrom,
            isActive: true,
          },
        }),
      ),
    );

    count += batch.length;
    console.log(`  ✓ ${count}/${MODEL_PRICING_DATA.length} models seeded...`);
  }

  console.log(`\n✅ Seeded ${MODEL_PRICING_DATA.length} model pricing tiers`);
  console.log('\n📊 Summary:');
  console.log('  OpenAI:    11 models (GPT-5, GPT-4.1, O-series, GPT-4o)');
  console.log('  Anthropic:  5 models (Claude 4.5, 4.1, 3.5)');
  console.log('  Google:     5 models (Gemini 2.5, 2.0, 1.5)');
  console.log('\n💰 Based on official October 2025 pricing');
  console.log('📏 Updated maxOutputTokens per official documentation');
}

// Run the seed with timeout protection
seedModelPricing()
  .then(async () => {
    await prisma.$disconnect();
    console.log('\n✅ Seed completed successfully');
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('\n❌ Seed failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });

// Force exit after 30 seconds to prevent hanging
setTimeout(() => {
  console.error('\n⏱️  Seed timeout after 30s');
  process.exit(1);
}, 30000);
