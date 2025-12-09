import path from 'path';
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

import { PrismaClient, LLMProvider, ModelCategory, Prisma } from '@flopods/schema';

const prisma = new PrismaClient({
  log: ['error'],
});

/**
 * Model Pricing Data - November 2025 (PRODUCTION READY)
 * Prices are PER 1M TOKENS, multiplied by 1M (Decimal USD).
 * Sources:
 * - OpenAI: https://openai.com/gpt-5/ and model docs for o3/o3-pro
 * - Anthropic: Haiku 4.5 ($1/$5), Sonnet 4.5 ($3/$15)
 * - Google Gemini: 2.5 Pro (≤200k tokens tier), Flash, Flash-Lite, Flash Vision, Embedding
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
    inputTokenCost: new Prisma.Decimal('1.25'),
    outputTokenCost: new Prisma.Decimal('10'),
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
    inputTokenCost: new Prisma.Decimal('0.25'),
    outputTokenCost: new Prisma.Decimal('2'),
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
    inputTokenCost: new Prisma.Decimal('15'),
    outputTokenCost: new Prisma.Decimal('120'),
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
    // OpenAI lists only input/output; “thinking” tokens are included in output.
    inputTokenCost: new Prisma.Decimal('2'),
    outputTokenCost: new Prisma.Decimal('8'),
    reasoningTokenCost: new Prisma.Decimal('0'),
    creditsPerMillionInputTokens: 20000,
    creditsPerMillionOutputTokens: 80000,
    creditsPerMillionReasoningTokens: 0,
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
    inputTokenCost: new Prisma.Decimal('20'),
    outputTokenCost: new Prisma.Decimal('80'),
    reasoningTokenCost: new Prisma.Decimal('0'),
    creditsPerMillionInputTokens: 200000,
    creditsPerMillionOutputTokens: 800000,
    creditsPerMillionReasoningTokens: 0,
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
    inputTokenCost: new Prisma.Decimal('3'),
    outputTokenCost: new Prisma.Decimal('15'),
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
    inputTokenCost: new Prisma.Decimal('1'),
    outputTokenCost: new Prisma.Decimal('5'),
    reasoningTokenCost: new Prisma.Decimal('0'),
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
    description: 'Exceptional for specialized reasoning',
    inputTokenCost: new Prisma.Decimal('15'),
    outputTokenCost: new Prisma.Decimal('75'),
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
    description: 'State-of-the-art for complex reasoning (priced at ≤200k prompt tier)',
    // NOTE: Google prices Pro differently for prompts >200k (1.25/7.50).
    inputTokenCost: new Prisma.Decimal('0.625'),
    outputTokenCost: new Prisma.Decimal('5'),
    reasoningTokenCost: new Prisma.Decimal('0'),
    creditsPerMillionInputTokens: 6250,
    creditsPerMillionOutputTokens: 50000,
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
    description: 'Hybrid reasoning; strong price-performance',
    inputTokenCost: new Prisma.Decimal('0.30'),
    outputTokenCost: new Prisma.Decimal('2.50'),
    reasoningTokenCost: new Prisma.Decimal('0'),
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
    modelId: 'gemini-2.5-flash-vision',
    category: 'SPECIALIST' as ModelCategory,
    displayName: 'Gemini 2.5 Flash Vision',
    description: 'Optimized for image analysis & OCR (same pricing as Flash)',
    inputTokenCost: new Prisma.Decimal('0.30'),
    outputTokenCost: new Prisma.Decimal('2.50'),
    reasoningTokenCost: new Prisma.Decimal('0'),
    creditsPerMillionInputTokens: 3000,
    creditsPerMillionOutputTokens: 25000,
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
    inputTokenCost: new Prisma.Decimal('0.10'),
    outputTokenCost: new Prisma.Decimal('0.40'),
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
    inputTokenCost: new Prisma.Decimal('0.15'),
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

  {
    provider: 'HUGGING_FACE' as LLMProvider,
    modelId: 'BAAI/bge-base-en-v1.5',
    category: 'EMBEDDING' as ModelCategory,
    displayName: 'BGE Base English v1.5',
    description: 'Hugging Face BGE embedding model with 768 dimension embeddings',
    inputTokenCost: new Prisma.Decimal('0.0008'), // $0.0008 per million tokens input, approximate market cost
    outputTokenCost: new Prisma.Decimal('0'),
    reasoningTokenCost: new Prisma.Decimal('0'),
    creditsPerMillionInputTokens: 80, // estimated credits per million input tokens
    creditsPerMillionOutputTokens: 0,
    creditsPerMillionReasoningTokens: 0,
    maxTokens: 512, // max input tokens per inference
    maxOutputTokens: 768, // embedding output vector dimensionality
    supportsStreaming: false,
    supportsVision: false,
    supportsFunctions: false,
    supportsJsonMode: false,
    supportsSystemPrompt: false,
    providerConfig: JSON.stringify({
      dimensions: 768,
      model: 'BAAI/bge-base-en-v1.5',
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
  console.log('  🔴 Anthropic: 3 models (Claude 4.5 latest)');
  console.log('  🟡 Google:    5 models (Gemini 2.5 + embedding)');
  console.log('\n💰 Pricing multiplied by 1M (per 1M tokens)');
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
