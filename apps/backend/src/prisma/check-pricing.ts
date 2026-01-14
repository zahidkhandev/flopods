import { PrismaClient, LLMProvider } from '@flopods/schema';

const prisma = new PrismaClient();

async function checkPricing() {
  console.log('🔍 Checking model pricing in database...\n');

  try {
    // Get ALL pricing
    const allPricing = await prisma.modelPricingTier.findMany({
      where: { isActive: true },
      select: {
        provider: true,
        modelId: true,
        displayName: true,
        inputTokenCost: true,
        outputTokenCost: true,
        reasoningTokenCost: true,
        effectiveFrom: true,
      },
      orderBy: [{ provider: 'asc' }, { modelId: 'asc' }],
    });

    console.log(`📊 Found ${allPricing.length} active models:\n`);

    if (allPricing.length === 0) {
      console.log('❌ NO MODELS FOUND IN DATABASE!');
      console.log('   → Run: npm run db:seed:pricing');
      return;
    }

    allPricing.forEach((model) => {
      console.log(`${model.provider} | ${model.modelId}`);
      console.log(`   Input:  $${model.inputTokenCost} per 1M tokens`);
      console.log(`   Output: $${model.outputTokenCost} per 1M tokens`);
      if (Number(model.reasoningTokenCost) > 0) {
        console.log(`   Reasoning: $${model.reasoningTokenCost} per 1M tokens`);
      }
      console.log(`   Effective: ${model.effectiveFrom}\n`);
    });

    // Check Gemini specifically
    const gemini = await prisma.modelPricingTier.findFirst({
      where: {
        provider: LLMProvider.GOOGLE_GEMINI,
        modelId: 'gemini-2.5-flash',
        isActive: true,
      },
    });

    if (!gemini) {
      console.log('❌ gemini-2.5-flash NOT FOUND!');
      return;
    }

    console.log('\ngemini-2.5-flash Details:');
    console.log(`   Input Cost: ${gemini.inputTokenCost}`);
    console.log(`   Output Cost: ${gemini.outputTokenCost}`);
    console.log(`   Type: ${typeof gemini.inputTokenCost}`);

    // Test calculation
    const inputCost = (2 / 1_000_000) * Number(gemini.inputTokenCost);
    const outputCost = (10 / 1_000_000) * Number(gemini.outputTokenCost);
    const total = inputCost + outputCost;

    console.log('\n💡 Test Calculation (2 input tokens, 10 output):');
    console.log(`   Input: 2 × ${Number(gemini.inputTokenCost) / 1_000_000} = $${inputCost}`);
    console.log(`   Output: 10 × ${Number(gemini.outputTokenCost) / 1_000_000} = $${outputCost}`);
    console.log(`   TOTAL: $${total}`);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPricing();
