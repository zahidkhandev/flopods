import path from 'path';
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

import { PrismaClient, LLMProvider, ModelCategory, Prisma } from '@flopods/schema';

const prisma = new PrismaClient({
  log: ['error'],
});

/**
 * Model Pricing Data - November 2025 (PRODUCTION READY)
 * ONLY LATEST & VALID MODELS - All deprecated removed
 * Based on official pricing from:
 * - OpenAI: https://openai.com/api/pricing/
 * - Anthropic: https://www.anthropic.com/pricing/claude
 * - Google: https://ai.google.dev/gemini-api/docs/pricing
 */
export const MODEL_PRICING_DATA = [
  // ==========================================
  // OPENAI - LATEST ONLY (GPT-5 + O3)
  // ==========================================
  {
    provider: 'OPENAI' as LLMProvider,
    modelId: 'gpt-5',
    category: 'POWERHOUSE' as ModelCategory,
    displayName: 'GPT-5',
    description: 'Best model for coding and agentic tasks',
    inputTokenCost: new Prisma.Decimal('0.00000125'),
    outputTokenCost: new Prisma.Decimal('0.00001'),
    reasoningTokenCost: new Prisma.Decimal('0'),
    creditsPerMillionInputTokens: 12500,
    creditsPerMillionOutputTokens: 100000,
    creditsPerMillionReasoningTokens: 0,
    maxTokens: 400000,
    maxOutputTokens: 128000,
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
    description: 'Fast & affordable variant of GPT-5',
    inputTokenCost: new Prisma.Decimal('0.00000025'),
    outputTokenCost: new Prisma.Decimal('0.000002'),
    reasoningTokenCost: new Prisma.Decimal('0'),
    creditsPerMillionInputTokens: 2500,
    creditsPerMillionOutputTokens: 20000,
    creditsPerMillionReasoningTokens: 0,
    maxTokens: 400000,
    maxOutputTokens: 128000,
    supportsStreaming: true,
    supportsVision: true,
    supportsFunctions: true,
    supportsJsonMode: true,
    supportsSystemPrompt: true,
  },
  {
    provider: 'OPENAI' as LLMProvider,
    modelId: 'gpt-5-pro',
    category: 'POWERHOUSE' as ModelCategory,
    displayName: 'GPT-5 Pro',
    description: 'Smartest & most precise model',
    inputTokenCost: new Prisma.Decimal('0.000015'),
    outputTokenCost: new Prisma.Decimal('0.00012'),
    reasoningTokenCost: new Prisma.Decimal('0'),
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
  {
    provider: 'OPENAI' as LLMProvider,
    modelId: 'o3',
    category: 'REASONING' as ModelCategory,
    displayName: 'O3',
    description: 'Advanced reasoning model',
    inputTokenCost: new Prisma.Decimal('0.000015'),
    outputTokenCost: new Prisma.Decimal('0.00006'),
    reasoningTokenCost: new Prisma.Decimal('0.00006'),
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
    description: 'Enhanced reasoning with more compute',
    inputTokenCost: new Prisma.Decimal('0.00003'),
    outputTokenCost: new Prisma.Decimal('0.00012'),
    reasoningTokenCost: new Prisma.Decimal('0.00012'),
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

  // ==========================================
  // ANTHROPIC - LATEST ONLY (Claude 4.5)
  // ==========================================
  {
    provider: 'ANTHROPIC' as LLMProvider,
    modelId: 'claude-sonnet-4-5-20250929',
    category: 'POWERHOUSE' as ModelCategory,
    displayName: 'Claude Sonnet 4.5',
    description: 'Smartest for complex agents & coding',
    inputTokenCost: new Prisma.Decimal('0.000003'),
    outputTokenCost: new Prisma.Decimal('0.000015'),
    reasoningTokenCost: new Prisma.Decimal('0'),
    creditsPerMillionInputTokens: 30000,
    creditsPerMillionOutputTokens: 150000,
    creditsPerMillionReasoningTokens: 0,
    maxTokens: 1000000,
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
    description: 'Fastest with near-frontier intelligence',
    inputTokenCost: new Prisma.Decimal('0.0000008'),
    outputTokenCost: new Prisma.Decimal('0.000004'),
    reasoningTokenCost: new Prisma.Decimal('0'),
    creditsPerMillionInputTokens: 8000,
    creditsPerMillionOutputTokens: 40000,
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
    description: 'Exceptional for specialized reasoning',
    inputTokenCost: new Prisma.Decimal('0.000015'),
    outputTokenCost: new Prisma.Decimal('0.000075'),
    reasoningTokenCost: new Prisma.Decimal('0'),
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

  // ==========================================
  // GOOGLE GEMINI - LATEST ONLY (2.5 Series)
  // ==========================================
  {
    provider: 'GOOGLE_GEMINI' as LLMProvider,
    modelId: 'gemini-2.5-pro',
    category: 'POWERHOUSE' as ModelCategory,
    displayName: 'Gemini 2.5 Pro',
    description: 'State-of-the-art for complex reasoning',
    inputTokenCost: new Prisma.Decimal('0.00000125'),
    outputTokenCost: new Prisma.Decimal('0.00001'),
    reasoningTokenCost: new Prisma.Decimal('0'),
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
    description: 'Best price-performance multimodal',
    inputTokenCost: new Prisma.Decimal('0.00000015'),
    outputTokenCost: new Prisma.Decimal('0.0000006'),
    reasoningTokenCost: new Prisma.Decimal('0'),
    creditsPerMillionInputTokens: 1500,
    creditsPerMillionOutputTokens: 6000,
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
    modelId: 'gemini-2.5-flash-vision',
    category: 'SPECIALIST' as ModelCategory,
    displayName: 'Gemini 2.5 Flash Vision',
    description: 'Optimized for image analysis & OCR',
    inputTokenCost: new Prisma.Decimal('0.00000015'),
    outputTokenCost: new Prisma.Decimal('0.0000006'),
    reasoningTokenCost: new Prisma.Decimal('0'),
    creditsPerMillionInputTokens: 1500,
    creditsPerMillionOutputTokens: 6000,
    creditsPerMillionReasoningTokens: 0,
    maxTokens: 1000000,
    maxOutputTokens: 32768,
    supportsStreaming: false,
    supportsVision: true,
    supportsFunctions: false,
    supportsJsonMode: true,
    supportsSystemPrompt: true,
  },
  {
    provider: 'GOOGLE_GEMINI' as LLMProvider,
    modelId: 'gemini-2.5-flash-lite',
    category: 'WORKHORSE' as ModelCategory,
    displayName: 'Gemini 2.5 Flash-Lite',
    description: 'Ultra-fast & cost-efficient',
    inputTokenCost: new Prisma.Decimal('0.0000001'),
    outputTokenCost: new Prisma.Decimal('0.0000004'),
    reasoningTokenCost: new Prisma.Decimal('0'),
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

  // ==========================================
  // GOOGLE GEMINI - EMBEDDINGS
  // ==========================================
  {
    provider: 'GOOGLE_GEMINI' as LLMProvider,
    modelId: 'embedding-001',
    category: 'EMBEDDING' as ModelCategory,
    displayName: 'Gemini Embedding',
    description: 'Document & text embeddings - 768d',
    inputTokenCost: new Prisma.Decimal('0.00000015'),
    outputTokenCost: new Prisma.Decimal('0'),
    reasoningTokenCost: new Prisma.Decimal('0'),
    creditsPerMillionInputTokens: 1500,
    creditsPerMillionOutputTokens: 0,
    creditsPerMillionReasoningTokens: 0,
    maxTokens: 65536,
    maxOutputTokens: 768,
    supportsStreaming: false,
    supportsVision: false,
    supportsFunctions: false,
    supportsJsonMode: false,
    supportsSystemPrompt: false,
    providerConfig: JSON.stringify({
      dimensions: 768,
      model: 'embedding-001',
      batchSize: 10,
    }),
  },
];

/**
 * Seeds ONLY latest & valid models (deprecated removed)
 */
async function seedModelPricing() {
  console.log('🌱 Seeding LATEST model pricing (Nov 2025 - PRODUCTION)...\n');

  const effectiveFrom = new Date('2025-11-01');
  let count = 0;

  const batchSize = 3;
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

  console.log(`\n✅ Seeded ${MODEL_PRICING_DATA.length} LATEST models only`);
  console.log('\n📊 Active Models:');
  console.log('  🟠 OpenAI:    5 models (GPT-5 series + O3)');
  console.log('  🔴 Anthropic:  3 models (Claude 4.5 latest)');
  console.log('  🟡 Google:     5 models (Gemini 2.5 + embedding)');
  console.log('\n💰 All deprecated models removed');
  console.log('✅ Ready for production');
}

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

setTimeout(() => {
  console.error('\n⏱️  Seed timeout after 30s');
  process.exit(1);
}, 30000);
