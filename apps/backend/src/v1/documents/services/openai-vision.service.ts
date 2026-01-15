// /src/modules/v1/documents/services/openai-vision.service.ts

import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LLMProvider,
  APIRequestType,
  VisionAnalysisStatus,
  VisionExtractionType,
  Prisma,
  Decimal,
} from '@flopods/schema';
import { PrismaService } from '../../../prisma/prisma.service';
import { S3Service } from '../../../common/aws/s3/s3.service';
import {
  calculateProfitData,
  calculateCreditsFromCharge,
  PROFIT_CONFIG,
} from '../../../common/config/profit.config';
import axios from 'axios';

interface VisionAnalysisResponse {
  ocrText?: string;
  ocrConfidence?: number;
  imageCaption?: string;
  imageSummary?: string;
  detectedObjects?: any[];
  sceneType?: string;
  sceneDescription?: string;
  activitiesDetected?: string[];
  qualityScore?: number;
  imageBlur?: boolean;
  imageNoise?: boolean;
  dominantColors?: string[];
  textDetected?: boolean;
  facesDetected?: number;
  textLines?: number;
  brightnessScore?: number;
  contrastScore?: number;
  [key: string]: any;
}

@Injectable()
export class V1OpenAIVisionService {
  private readonly logger = new Logger(V1OpenAIVisionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    private readonly configService: ConfigService,
  ) {}

  // Get OpenAI vision pricing from DB - NO HARDCODING
  private async getVisionPricing() {
    const pricing = await this.prisma.modelPricingTier.findFirst({
      where: {
        provider: LLMProvider.OPENAI,
        isActive: true,
        supportsVision: true,
      },
      orderBy: {
        effectiveFrom: 'desc',
      },
    });

    if (!pricing) {
      throw new NotFoundException('OpenAI vision pricing not found in database');
    }

    return pricing;
  }

  async analyzeImageVision(
    documentId: string,
    workspaceId: string,
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<any> {
    const startTime = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.logger.log(`[OpenAI Vision] 🖼️ Starting analysis for: ${documentId}`);

    let inputTokens = 0;
    let outputTokens = 0;
    let totalTokens = 0;
    let actualCostUsd = new Decimal(0);
    let profitData: any = null;
    let creditsToCharge = 0;

    try {
      const apiKey = this.configService.get<string>('OPENAI_API_KEY');
      if (!apiKey) {
        throw new BadRequestException('OpenAI API key not configured');
      }

      // Get pricing from DB - NO HARDCODING
      const visionPricing = await this.getVisionPricing();

      const base64Image = imageBuffer.toString('base64');

      this.logger.debug(
        `[OpenAI Vision] Using model: ${visionPricing.modelId} | Max tokens: ${visionPricing.maxOutputTokens}`,
      );

      // Use model from DB
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: visionPricing.modelId,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Analyze this image comprehensively and provide:
1. OCR text extraction with confidence
2. Detailed image caption/description
3. List of detected objects with confidence scores
4. Scene type and description
5. Detected activities/actions
6. Image quality assessment (blur, noise, brightness)
7. Dominant colors
8. Face count if any
9. Text lines count

Respond in JSON format:
{
  "ocrText": "text or null",
  "ocrConfidence": 0.95,
  "imageCaption": "description",
  "imageSummary": "short summary",
  "detectedObjects": [{"label": "object", "confidence": 0.95}],
  "textDetected": true,
  "sceneType": "scene",
  "sceneDescription": "description",
  "activitiesDetected": ["activity1"],
  "qualityScore": 85,
  "imageBlur": false,
  "imageNoise": false,
  "dominantColors": ["#FF0000"],
  "facesDetected": 0,
  "textLines": 0,
  "brightnessScore": 85,
  "contrastScore": 80
}`,
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${base64Image}`,
                  },
                },
              ],
            },
          ],
          max_tokens: visionPricing.maxOutputTokens || 1024,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        },
      );

      const processingTimeMs = Date.now() - startTime;
      const responseText = response.data.choices[0].message.content;

      let analysisData: VisionAnalysisResponse = {};

      try {
        analysisData = JSON.parse(responseText);
      } catch {
        this.logger.warn(`Failed to parse JSON, using raw text`);
        analysisData = {
          ocrText: responseText,
          imageCaption: responseText,
          textDetected: responseText.length > 0,
        };
      }

      // Get token usage from OpenAI response
      inputTokens = response.data.usage?.prompt_tokens || 0;
      outputTokens = response.data.usage?.completion_tokens || 0;
      totalTokens = response.data.usage?.total_tokens || 0;

      // Calculate actual cost from DB pricing - NO HARDCODING
      const inputCost = (inputTokens / 1_000_000) * Number(visionPricing.inputTokenCost);
      const outputCost = (outputTokens / 1_000_000) * Number(visionPricing.outputTokenCost);
      const totalCostUsd = inputCost + outputCost;
      actualCostUsd = new Decimal(totalCostUsd);

      // Calculate profit using global multiplier
      profitData = calculateProfitData(totalCostUsd);
      creditsToCharge = calculateCreditsFromCharge(profitData.userChargeUsd);

      this.logger.debug(
        `[OpenAI Vision] 💰 ${inputTokens}in/${outputTokens}out tokens | ` +
          `Cost: $${totalCostUsd.toFixed(6)} | Charge: $${profitData.userChargeUsd.toFixed(6)} | ` +
          `Profit: $${profitData.profitUsd.toFixed(6)} (${profitData.profitMarginPercentage.toFixed(2)}%) | ` +
          `ROI: ${profitData.roi.toFixed(0)}% | Multiplier: ${PROFIT_CONFIG.MARKUP_MULTIPLIER}x`,
      );

      // Get subscription for credit tracking
      const subscription = await this.prisma.subscription.findUnique({
        where: { workspaceId },
        select: { id: true, isByokMode: true },
      });

      if (!subscription) {
        throw new BadRequestException('No active subscription found for workspace');
      }

      // Use model from DB in DB record
      const visionAnalysis = await this.prisma.documentVisionAnalysis.create({
        data: {
          documentId,
          workspaceId,
          provider: LLMProvider.OPENAI,
          modelId: visionPricing.modelId,
          modelVersion: 'latest',
          ocrText: analysisData.ocrText || null,
          ocrConfidence: analysisData.ocrConfidence || 0,
          imageCaption: analysisData.imageCaption || null,
          imageSummary: analysisData.imageSummary || null,
          detectedObjects: analysisData.detectedObjects
            ? analysisData.detectedObjects
            : Prisma.JsonNullValueInput.JsonNull,
          sceneType: analysisData.sceneType || null,
          sceneDescription: analysisData.sceneDescription || null,
          activitiesDetected: analysisData.activitiesDetected
            ? analysisData.activitiesDetected
            : Prisma.JsonNullValueInput.JsonNull,
          qualityScore: analysisData.qualityScore || null,
          imageBlur: analysisData.imageBlur || false,
          imageNoise: analysisData.imageNoise || false,
          dominantColors: analysisData.dominantColors
            ? analysisData.dominantColors
            : Prisma.JsonNullValueInput.JsonNull,
          textDetected: analysisData.textDetected || false,
          processingTimeMs,
          requestId,
          inputTokens,
          outputTokens,
          totalTokens,
          estimatedCost: actualCostUsd,
          status: VisionAnalysisStatus.COMPLETED,
          responseContent: responseText,
          rawResponse: analysisData,
        },
      });

      await this.createVisionSnapshot(
        documentId,
        workspaceId,
        VisionExtractionType.OCR_TEXT,
        analysisData.ocrText || '',
        analysisData.ocrConfidence || 0,
        visionPricing.modelId,
      );

      // Log with profit tracking
      await this.logApiCall(
        workspaceId,
        documentId,
        subscription.id,
        inputTokens,
        outputTokens,
        totalTokens,
        actualCostUsd,
        creditsToCharge,
        profitData.profitUsd,
        subscription.isByokMode,
        true,
        visionPricing.modelId,
        visionPricing.displayName,
      );

      this.logger.log(
        `[OpenAI Vision] Completed: ${documentId} (${processingTimeMs}ms, ${totalTokens} tokens) | ` +
          `Profit: $${profitData.profitUsd.toFixed(6)} 💰 (${subscription.isByokMode ? 'BYOK=0' : 'Platform'})`,
      );

      return visionAnalysis;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const processingTimeMs = Date.now() - startTime;

      this.logger.error(`[OpenAI Vision] ❌ Failed: ${documentId} - ${errorMessage}`);

      // Get pricing for error log
      const visionPricing = await this.getVisionPricing().catch(() => null);

      await this.prisma.documentVisionAnalysis.create({
        data: {
          documentId,
          workspaceId,
          provider: LLMProvider.OPENAI,
          modelId: visionPricing?.modelId || 'gpt-4o',
          status: VisionAnalysisStatus.ERROR,
          errorMessage,
          processingTimeMs,
          requestId,
          estimatedCost: new Decimal(0),
        },
      });

      // Log error with profit tracking
      const subscription = await this.prisma.subscription.findUnique({
        where: { workspaceId },
        select: { id: true, isByokMode: true },
      });

      if (subscription && visionPricing) {
        await this.logApiCall(
          workspaceId,
          documentId,
          subscription.id,
          0,
          0,
          0,
          new Decimal(0),
          0,
          new Decimal(0),
          subscription.isByokMode,
          false,
          visionPricing.modelId,
          visionPricing.displayName,
          errorMessage,
        );
      }

      throw new BadRequestException(`OpenAI vision analysis failed: ${errorMessage}`);
    }
  }

  private async createVisionSnapshot(
    documentId: string,
    workspaceId: string,
    extractionType: VisionExtractionType,
    extractedData: string,
    confidence: number,
    modelId: string, // From DB
  ): Promise<void> {
    await this.prisma.visionExtractionSnapshot.create({
      data: {
        documentId,
        workspaceId,
        provider: LLMProvider.OPENAI,
        modelId, // Use DB model
        extractionType,
        extractedData,
        confidence,
        version: 1,
        extractedAt: new Date(),
        summary: extractedData.substring(0, 500),
      },
    });
  }

  // Updated with profit tracking and DB models
  private async logApiCall(
    workspaceId: string,
    documentId: string | null,
    subscriptionId: string,
    inputTokens: number,
    outputTokens: number,
    totalTokens: number,
    estimatedCost: Decimal,
    creditsCharged: number,
    profitUsd: Decimal,
    isByokMode: boolean,
    success: boolean,
    modelId: string, // From DB
    modelName: string, // From DB
    errorMessage?: string,
  ): Promise<void> {
    await this.prisma.documentAPILog.create({
      data: {
        workspaceId,
        documentId: documentId || undefined,
        provider: LLMProvider.OPENAI,
        modelId, // Use DB model
        requestType: APIRequestType.IMAGE_ANALYSIS,
        inputTokens,
        outputTokens,
        totalTokens,
        statusCode: success ? 200 : 500,
        success,
        errorMessage: errorMessage || null,
        estimatedCost,
        actualCost: estimatedCost,
        metadata: {
          subscriptionId,
          creditsCharged,
          profitUsd: profitUsd.toString(),
          profitMargin: profitUsd.gt(0)
            ? (profitUsd.div(estimatedCost.mul(PROFIT_CONFIG.MARKUP_MULTIPLIER)) as any)
                .mul(100)
                .toString()
            : '0',
          multiplier: PROFIT_CONFIG.MARKUP_MULTIPLIER,
          byokMode: isByokMode,
        },
        processedAt: new Date(),
      },
    });

    // Track in CreditUsageLog too
    const dummyCanvasId = 'system-vision';
    const dummyPodId = 'system-vision';
    const dummyExecutionId = `vision_${documentId}_${Date.now()}`;

    await this.prisma.creditUsageLog.create({
      data: {
        subscriptionId,
        workspaceId,
        canvasId: dummyCanvasId,
        podId: dummyPodId,
        executionId: dummyExecutionId,
        creditsUsed: creditsCharged,
        balanceBefore: 0,
        balanceAfter: 0,
        provider: LLMProvider.OPENAI,
        modelId, // Use DB model
        modelName, // Use DB display name
      },
    });
  }

  async getAnalysisFor60Days(documentId: string): Promise<any[]> {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    return this.prisma.documentVisionAnalysis.findMany({
      where: {
        documentId,
        createdAt: { gte: sixtyDaysAgo },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getExtractionSnapshots(
    documentId: string,
    extractionType?: VisionExtractionType,
  ): Promise<any[]> {
    return this.prisma.visionExtractionSnapshot.findMany({
      where: {
        documentId,
        extractionType,
      },
      orderBy: { extractedAt: 'desc' },
    });
  }
}
