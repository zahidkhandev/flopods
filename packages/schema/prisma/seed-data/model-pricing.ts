import path from 'path';
require('dotenv').config({ path: path.resolve(__dirname, '../../../../.env') });

import { PrismaClient, LLMProvider, ModelCategory, Prisma } from '@flopods/schema';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: ['error'],
});

/**
 * Model Pricing Data - January 2026 (PRODUCTION READY)
 * Updated with latest OpenAI GPT-5.2, Sora 2, GPT Image 1.5, and Anthropic Claude 4.5
 */
export const MODEL_PRICING_DATA = [
  // ==========================================
  // OPENAI - GPT-5.2 SERIES
  // ==========================================
  {
    provider: 'OPENAI' as LLMProvider,
    modelId: 'gpt-5.2',
    category: 'POWERHOUSE' as ModelCategory,
    displayName: 'GPT-5.2',
    description: 'Best model for coding and agentic tasks across industries',
    inputTokenCost: new Prisma.Decimal('1.75'),
    outputTokenCost: new Prisma.Decimal('14'),
    reasoningTokenCost: new Prisma.Decimal('0'),
    creditsPerMillionInputTokens: BigInt(17500),
    creditsPerMillionOutputTokens: BigInt(140000),
    creditsPerMillionReasoningTokens: BigInt(0),
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
    modelId: 'gpt-5.2-pro',
    category: 'POWERHOUSE' as ModelCategory,
    displayName: 'GPT-5.2 Pro',
    description: 'Smartest and most precise model',
    inputTokenCost: new Prisma.Decimal('21'),
    outputTokenCost: new Prisma.Decimal('168'),
    reasoningTokenCost: new Prisma.Decimal('0'),
    creditsPerMillionInputTokens: BigInt(210000),
    creditsPerMillionOutputTokens: BigInt(1680000),
    creditsPerMillionReasoningTokens: BigInt(0),
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
    modelId: 'gpt-5.1',
    category: 'POWERHOUSE' as ModelCategory,
    displayName: 'GPT-5.1',
    description: 'Intelligent reasoning model with configurable effort',
    inputTokenCost: new Prisma.Decimal('1.25'),
    outputTokenCost: new Prisma.Decimal('10'),
    reasoningTokenCost: new Prisma.Decimal('0'),
    creditsPerMillionInputTokens: BigInt(12500),
    creditsPerMillionOutputTokens: BigInt(100000),
    creditsPerMillionReasoningTokens: BigInt(0),
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
    description: 'Fast & cost-efficient version of GPT-5',
    inputTokenCost: new Prisma.Decimal('0.25'),
    outputTokenCost: new Prisma.Decimal('2'),
    reasoningTokenCost: new Prisma.Decimal('0'),
    creditsPerMillionInputTokens: BigInt(2500),
    creditsPerMillionOutputTokens: BigInt(20000),
    creditsPerMillionReasoningTokens: BigInt(0),
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
    modelId: 'gpt-5-nano',
    category: 'WORKHORSE' as ModelCategory,
    displayName: 'GPT-5 Nano',
    description: 'Fastest, most cost-efficient version of GPT-5',
    inputTokenCost: new Prisma.Decimal('0.10'),
    outputTokenCost: new Prisma.Decimal('0.40'),
    reasoningTokenCost: new Prisma.Decimal('0'),
    creditsPerMillionInputTokens: BigInt(1000),
    creditsPerMillionOutputTokens: BigInt(4000),
    creditsPerMillionReasoningTokens: BigInt(0),
    maxTokens: 400000,
    maxOutputTokens: 128000,
    supportsStreaming: true,
    supportsVision: true,
    supportsFunctions: true,
    supportsJsonMode: true,
    supportsSystemPrompt: true,
  },

  // ==========================================
  // OPENAI - O-SERIES (REASONING)
  // ==========================================
  {
    provider: 'OPENAI' as LLMProvider,
    modelId: 'o3',
    category: 'REASONING' as ModelCategory,
    displayName: 'O3',
    description: 'Advanced reasoning model',
    inputTokenCost: new Prisma.Decimal('2'),
    outputTokenCost: new Prisma.Decimal('8'),
    reasoningTokenCost: new Prisma.Decimal('0'),
    creditsPerMillionInputTokens: BigInt(20000),
    creditsPerMillionOutputTokens: BigInt(80000),
    creditsPerMillionReasoningTokens: BigInt(0),
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
    creditsPerMillionInputTokens: BigInt(200000),
    creditsPerMillionOutputTokens: BigInt(800000),
    creditsPerMillionReasoningTokens: BigInt(0),
    maxTokens: 200000,
    maxOutputTokens: 100000,
    supportsStreaming: true,
    supportsFunctions: false,
    supportsJsonMode: false,
    supportsSystemPrompt: true,
  },
  {
    provider: 'OPENAI' as LLMProvider,
    modelId: 'o3-deep-research',
    category: 'REASONING' as ModelCategory,
    displayName: 'O3 Deep Research',
    description: 'Most powerful deep research model',
    inputTokenCost: new Prisma.Decimal('10'),
    outputTokenCost: new Prisma.Decimal('40'),
    reasoningTokenCost: new Prisma.Decimal('0'),
    creditsPerMillionInputTokens: BigInt(100000),
    creditsPerMillionOutputTokens: BigInt(400000),
    creditsPerMillionReasoningTokens: BigInt(0),
    maxTokens: 200000,
    maxOutputTokens: 100000,
    supportsStreaming: true,
    supportsFunctions: false,
    supportsJsonMode: false,
    supportsSystemPrompt: true,
  },
  {
    provider: 'OPENAI' as LLMProvider,
    modelId: 'o4-mini-deep-research',
    category: 'REASONING' as ModelCategory,
    displayName: 'O4 Mini Deep Research',
    description: 'Faster, more affordable deep research',
    inputTokenCost: new Prisma.Decimal('5'),
    outputTokenCost: new Prisma.Decimal('20'),
    reasoningTokenCost: new Prisma.Decimal('0'),
    creditsPerMillionInputTokens: BigInt(50000),
    creditsPerMillionOutputTokens: BigInt(200000),
    creditsPerMillionReasoningTokens: BigInt(0),
    maxTokens: 200000,
    maxOutputTokens: 100000,
    supportsStreaming: true,
    supportsFunctions: false,
    supportsJsonMode: false,
    supportsSystemPrompt: true,
  },

  // ==========================================
  // OPENAI - GPT-4.1 SERIES
  // ==========================================
  {
    provider: 'OPENAI' as LLMProvider,
    modelId: 'gpt-4.1',
    category: 'POWERHOUSE' as ModelCategory,
    displayName: 'GPT-4.1',
    description: 'Smartest non-reasoning model',
    inputTokenCost: new Prisma.Decimal('2.50'),
    outputTokenCost: new Prisma.Decimal('10'),
    reasoningTokenCost: new Prisma.Decimal('0'),
    creditsPerMillionInputTokens: BigInt(25000),
    creditsPerMillionOutputTokens: BigInt(100000),
    creditsPerMillionReasoningTokens: BigInt(0),
    maxTokens: 128000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    supportsVision: true,
    supportsAudio: true,
    supportsFunctions: true,
    supportsJsonMode: true,
    supportsSystemPrompt: true,
  },

  // ==========================================
  // OPENAI - IMAGE GENERATION
  // ==========================================
  {
    provider: 'OPENAI' as LLMProvider,
    modelId: 'gpt-image-1.5',
    category: 'IMAGE_GEN' as ModelCategory,
    displayName: 'GPT Image 1.5',
    description: 'State-of-the-art image generation',
    inputTokenCost: new Prisma.Decimal('8'),
    outputTokenCost: new Prisma.Decimal('32'),
    reasoningTokenCost: new Prisma.Decimal('0'),
    creditsPerMillionInputTokens: BigInt(80000),
    creditsPerMillionOutputTokens: BigInt(320000),
    creditsPerMillionReasoningTokens: BigInt(0),
    maxTokens: 65536,
    maxOutputTokens: 4096,
    supportsStreaming: false,
    supportsVision: true,
    supportsFunctions: false,
    supportsJsonMode: false,
    supportsSystemPrompt: true,
    providerConfig: JSON.stringify({
      textInput: 5.0,
      imageOutput: 32.0,
      cachedInput: 2.0,
    }),
  },

  // ==========================================
  // OPENAI - VIDEO GENERATION
  // ==========================================
  {
    provider: 'OPENAI' as LLMProvider,
    modelId: 'sora-2',
    category: 'VIDEO_GEN' as ModelCategory,
    displayName: 'Sora 2',
    description: 'Flagship video generation with synced audio',
    inputTokenCost: new Prisma.Decimal('0'),
    outputTokenCost: new Prisma.Decimal('100000'),
    reasoningTokenCost: new Prisma.Decimal('0'),
    creditsPerMillionInputTokens: BigInt(0),
    creditsPerMillionOutputTokens: BigInt(1000000000),
    creditsPerMillionReasoningTokens: BigInt(0),
    maxTokens: 65536,
    maxOutputTokens: 1024,
    supportsStreaming: false,
    supportsVision: false,
    supportsAudio: true,
    supportsFunctions: false,
    supportsJsonMode: false,
    supportsSystemPrompt: false,
    providerConfig: JSON.stringify({
      pricePerSecond: 0.1,
      resolution: '720p',
    }),
  },
  {
    provider: 'OPENAI' as LLMProvider,
    modelId: 'sora-2-pro',
    category: 'VIDEO_GEN' as ModelCategory,
    displayName: 'Sora 2 Pro',
    description: 'Most advanced synced-audio video generation',
    inputTokenCost: new Prisma.Decimal('0'),
    outputTokenCost: new Prisma.Decimal('300000'),
    reasoningTokenCost: new Prisma.Decimal('0'),
    creditsPerMillionInputTokens: BigInt(0),
    creditsPerMillionOutputTokens: BigInt(3000000000),
    creditsPerMillionReasoningTokens: BigInt(0),
    maxTokens: 65536,
    maxOutputTokens: 1024,
    supportsStreaming: false,
    supportsVision: false,
    supportsAudio: true,
    supportsFunctions: false,
    supportsJsonMode: false,
    supportsSystemPrompt: false,
    providerConfig: JSON.stringify({
      pricePerSecond: 0.3,
      resolution: '720p',
      quality: 'pro',
    }),
  },

  // ==========================================
  // ANTHROPIC - CLAUDE 4.5 SERIES
  // ==========================================
  {
    provider: 'ANTHROPIC' as LLMProvider,
    modelId: 'claude-opus-4-5',
    category: 'POWERHOUSE' as ModelCategory,
    displayName: 'Claude Opus 4.5',
    description: 'Smartest Claude model',
    inputTokenCost: new Prisma.Decimal('5'),
    outputTokenCost: new Prisma.Decimal('25'),
    reasoningTokenCost: new Prisma.Decimal('0'),
    creditsPerMillionInputTokens: BigInt(50000),
    creditsPerMillionOutputTokens: BigInt(250000),
    creditsPerMillionReasoningTokens: BigInt(0),
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
    modelId: 'claude-opus-4-1',
    category: 'POWERHOUSE' as ModelCategory,
    displayName: 'Claude Opus 4.1',
    description: 'Exceptional for specialized reasoning',
    inputTokenCost: new Prisma.Decimal('15'),
    outputTokenCost: new Prisma.Decimal('75'),
    reasoningTokenCost: new Prisma.Decimal('0'),
    creditsPerMillionInputTokens: BigInt(150000),
    creditsPerMillionOutputTokens: BigInt(750000),
    creditsPerMillionReasoningTokens: BigInt(0),
    maxTokens: 200000,
    maxOutputTokens: 32000,
    supportsStreaming: true,
    supportsVision: true,
    supportsFunctions: true,
    supportsJsonMode: false,
    supportsSystemPrompt: true,
  },
  {
    provider: 'ANTHROPIC' as LLMProvider,
    modelId: 'claude-sonnet-4-5',
    category: 'POWERHOUSE' as ModelCategory,
    displayName: 'Claude Sonnet 4.5',
    description: 'Best for complex agents & coding',
    inputTokenCost: new Prisma.Decimal('3'),
    outputTokenCost: new Prisma.Decimal('15'),
    reasoningTokenCost: new Prisma.Decimal('0'),
    creditsPerMillionInputTokens: BigInt(30000),
    creditsPerMillionOutputTokens: BigInt(150000),
    creditsPerMillionReasoningTokens: BigInt(0),
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
    modelId: 'claude-haiku-4-5',
    category: 'WORKHORSE' as ModelCategory,
    displayName: 'Claude Haiku 4.5',
    description: 'Fastest with near-frontier intelligence',
    inputTokenCost: new Prisma.Decimal('1'),
    outputTokenCost: new Prisma.Decimal('5'),
    reasoningTokenCost: new Prisma.Decimal('0'),
    creditsPerMillionInputTokens: BigInt(10000),
    creditsPerMillionOutputTokens: BigInt(50000),
    creditsPerMillionReasoningTokens: BigInt(0),
    maxTokens: 200000,
    maxOutputTokens: 10000,
    supportsStreaming: true,
    supportsVision: true,
    supportsFunctions: true,
    supportsJsonMode: false,
    supportsSystemPrompt: true,
  },

  // ==========================================
  // GOOGLE GEMINI - 3 SERIES
  // ==========================================
  {
    provider: 'GOOGLE_GEMINI' as LLMProvider,
    modelId: 'gemini-3-pro-preview',
    category: 'POWERHOUSE' as ModelCategory,
    displayName: 'Gemini 3 Pro',
    description: 'Most intelligent multimodal model',
    inputTokenCost: new Prisma.Decimal('2'),
    outputTokenCost: new Prisma.Decimal('10'),
    reasoningTokenCost: new Prisma.Decimal('0'),
    creditsPerMillionInputTokens: BigInt(20000),
    creditsPerMillionOutputTokens: BigInt(100000),
    creditsPerMillionReasoningTokens: BigInt(0),
    maxTokens: 1048576,
    maxOutputTokens: 65536,
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
    modelId: 'gemini-3-flash-preview',
    category: 'WORKHORSE' as ModelCategory,
    displayName: 'Gemini 3 Flash',
    description: 'Balanced for speed & scale',
    inputTokenCost: new Prisma.Decimal('0.50'),
    outputTokenCost: new Prisma.Decimal('3'),
    reasoningTokenCost: new Prisma.Decimal('0'),
    creditsPerMillionInputTokens: BigInt(5000),
    creditsPerMillionOutputTokens: BigInt(30000),
    creditsPerMillionReasoningTokens: BigInt(0),
    maxTokens: 1048576,
    maxOutputTokens: 65536,
    supportsStreaming: true,
    supportsVision: true,
    supportsAudio: true,
    supportsVideo: true,
    supportsFunctions: true,
    supportsJsonMode: true,
    supportsSystemPrompt: true,
  },

  // ==========================================
  // GOOGLE GEMINI - 2.5 SERIES
  // ==========================================
  {
    provider: 'GOOGLE_GEMINI' as LLMProvider,
    modelId: 'gemini-2.5-pro',
    category: 'POWERHOUSE' as ModelCategory,
    displayName: 'Gemini 2.5 Pro',
    description: 'State-of-the-art thinking model',
    inputTokenCost: new Prisma.Decimal('0.625'),
    outputTokenCost: new Prisma.Decimal('5'),
    reasoningTokenCost: new Prisma.Decimal('0'),
    creditsPerMillionInputTokens: BigInt(6250),
    creditsPerMillionOutputTokens: BigInt(50000),
    creditsPerMillionReasoningTokens: BigInt(0),
    maxTokens: 1048576,
    maxOutputTokens: 65536,
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
    description: 'Best price-performance',
    inputTokenCost: new Prisma.Decimal('0.30'),
    outputTokenCost: new Prisma.Decimal('2.50'),
    reasoningTokenCost: new Prisma.Decimal('0'),
    creditsPerMillionInputTokens: BigInt(3000),
    creditsPerMillionOutputTokens: BigInt(25000),
    creditsPerMillionReasoningTokens: BigInt(0),
    maxTokens: 1048576,
    maxOutputTokens: 65536,
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
    description: 'Ultra-fast & cost-efficient',
    inputTokenCost: new Prisma.Decimal('0.10'),
    outputTokenCost: new Prisma.Decimal('0.40'),
    reasoningTokenCost: new Prisma.Decimal('0'),
    creditsPerMillionInputTokens: BigInt(1000),
    creditsPerMillionOutputTokens: BigInt(4000),
    creditsPerMillionReasoningTokens: BigInt(0),
    maxTokens: 1048576,
    maxOutputTokens: 65536,
    supportsStreaming: true,
    supportsVision: true,
    supportsFunctions: true,
    supportsJsonMode: true,
    supportsSystemPrompt: true,
  },

  // ==========================================
  // GOOGLE GEMINI - IMAGE GENERATION
  // ==========================================
  {
    provider: 'GOOGLE_GEMINI' as LLMProvider,
    modelId: 'gemini-2.5-flash-image',
    category: 'IMAGE_GEN' as ModelCategory,
    displayName: 'Gemini 2.5 Flash Image',
    description: 'Image generation & editing',
    inputTokenCost: new Prisma.Decimal('0.30'),
    outputTokenCost: new Prisma.Decimal('30'),
    reasoningTokenCost: new Prisma.Decimal('0'),
    creditsPerMillionInputTokens: BigInt(3000),
    creditsPerMillionOutputTokens: BigInt(300000),
    creditsPerMillionReasoningTokens: BigInt(0),
    maxTokens: 65536,
    maxOutputTokens: 32768,
    supportsStreaming: false,
    supportsVision: true,
    supportsFunctions: false,
    supportsJsonMode: true,
    supportsSystemPrompt: true,
    providerConfig: JSON.stringify({
      costPerImage: 0.039,
    }),
  },

  // ==========================================
  // GOOGLE GEMINI - VIDEO GENERATION
  // ==========================================
  {
    provider: 'GOOGLE_GEMINI' as LLMProvider,
    modelId: 'veo-3-fast',
    category: 'VIDEO_GEN' as ModelCategory,
    displayName: 'Veo 3 Fast',
    description: 'Fast video generation (8s clips)',
    inputTokenCost: new Prisma.Decimal('0'),
    outputTokenCost: new Prisma.Decimal('50000'),
    reasoningTokenCost: new Prisma.Decimal('0'),
    creditsPerMillionInputTokens: BigInt(0),
    creditsPerMillionOutputTokens: BigInt(500000000),
    creditsPerMillionReasoningTokens: BigInt(0),
    maxTokens: 65536,
    maxOutputTokens: 1024,
    supportsStreaming: false,
    supportsVision: false,
    supportsAudio: true,
    supportsFunctions: false,
    supportsJsonMode: false,
    supportsSystemPrompt: false,
    providerConfig: JSON.stringify({
      costPer8SecVideo: 0.4,
    }),
  },
  {
    provider: 'GOOGLE_GEMINI' as LLMProvider,
    modelId: 'veo-3-quality',
    category: 'VIDEO_GEN' as ModelCategory,
    displayName: 'Veo 3 Quality',
    description: 'High-quality video (8s clips)',
    inputTokenCost: new Prisma.Decimal('0'),
    outputTokenCost: new Prisma.Decimal('250000'),
    reasoningTokenCost: new Prisma.Decimal('0'),
    creditsPerMillionInputTokens: BigInt(0),
    creditsPerMillionOutputTokens: BigInt(2500000000),
    creditsPerMillionReasoningTokens: BigInt(0),
    maxTokens: 65536,
    maxOutputTokens: 1024,
    supportsStreaming: false,
    supportsVision: false,
    supportsAudio: true,
    supportsFunctions: false,
    supportsJsonMode: false,
    supportsSystemPrompt: false,
    providerConfig: JSON.stringify({
      costPer8SecVideo: 2.0,
    }),
  },

  // ==========================================
  // EMBEDDINGS
  // ==========================================
  {
    provider: 'GOOGLE_GEMINI' as LLMProvider,
    modelId: 'embedding-001',
    category: 'EMBEDDING' as ModelCategory,
    displayName: 'Gemini Embedding',
    description: 'Text embeddings - 768d',
    inputTokenCost: new Prisma.Decimal('0.15'),
    outputTokenCost: new Prisma.Decimal('0'),
    reasoningTokenCost: new Prisma.Decimal('0'),
    creditsPerMillionInputTokens: BigInt(1500),
    creditsPerMillionOutputTokens: BigInt(0),
    creditsPerMillionReasoningTokens: BigInt(0),
    maxTokens: 65536,
    maxOutputTokens: 768,
    supportsStreaming: false,
    supportsVision: false,
    supportsFunctions: false,
    supportsJsonMode: false,
    supportsSystemPrompt: false,
    providerConfig: JSON.stringify({
      dimensions: 768,
    }),
  },
  {
    provider: 'HUGGING_FACE' as LLMProvider,
    modelId: 'BAAI/bge-base-en-v1.5',
    category: 'EMBEDDING' as ModelCategory,
    displayName: 'BGE Base English v1.5',
    description: 'HuggingFace BGE - 768d',
    inputTokenCost: new Prisma.Decimal('0.0008'),
    outputTokenCost: new Prisma.Decimal('0'),
    reasoningTokenCost: new Prisma.Decimal('0'),
    creditsPerMillionInputTokens: BigInt(80),
    creditsPerMillionOutputTokens: BigInt(0),
    creditsPerMillionReasoningTokens: BigInt(0),
    maxTokens: 512,
    maxOutputTokens: 768,
    supportsStreaming: false,
    supportsVision: false,
    supportsFunctions: false,
    supportsJsonMode: false,
    supportsSystemPrompt: false,
    providerConfig: JSON.stringify({
      dimensions: 768,
    }),
  },
];

async function seedModelPricing() {
  console.log('🌱 Seeding LATEST model pricing (Jan 2026 - PRODUCTION)...\n');

  const effectiveFrom = new Date('2026-01-01');
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

  console.log(`\n✅ Seeded ${MODEL_PRICING_DATA.length} models`);
  console.log('\n📊 Active Models:');
  console.log('  🟠 OpenAI:      12 models (GPT-5.2, O3, Sora 2, GPT Image)');
  console.log('  🔴 Anthropic:   4 models (Claude 4.5 series)');
  console.log('  🟡 Google:      8 models (Gemini 2.5/3 + Veo)');
  console.log('  🔵 HuggingFace: 1 model');
  console.log('\n💰 Ready for production');
}

seedModelPricing()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
    console.log('\n✅ Seed completed');
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('\n❌ Seed failed:', error);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });

setTimeout(async () => {
  console.error('\n⏱️ Timeout');
  await prisma.$disconnect();
  await pool.end();
  process.exit(1);
}, 30000);
