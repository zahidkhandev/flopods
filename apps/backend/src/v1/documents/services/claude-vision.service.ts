// /src/modules/v1/documents/services/claude-vision.service.ts

import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LLMProvider,
  APIRequestType,
  VisionAnalysisStatus,
  VisionExtractionType,
  Prisma,
} from '@flopods/schema';
import { PrismaService } from '../../../prisma/prisma.service';
import { S3Service } from '../../../common/aws/s3/s3.service';
import {
  calculateProfitData,
  calculateCreditsFromCharge,
  PROFIT_CONFIG,
} from '../../../config/profit.config';
import { Decimal } from '@prisma/client/runtime/library';
import Anthropic from '@anthropic-ai/sdk';

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

// ✅ Valid media types for Claude
type ValidMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

const VALID_MEDIA_TYPES: Record<string, ValidMediaType> = {
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/png': 'image/png',
  'image/gif': 'image/gif',
  'image/webp': 'image/webp',
};

@Injectable()
export class V1ClaudeVisionService {
  private readonly logger = new Logger(V1ClaudeVisionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    private readonly configService: ConfigService,
  ) {}

  // ✅ Get Claude vision pricing from DB
  private async getVisionPricing() {
    const pricing = await this.prisma.modelPricingTier.findFirst({
      where: {
        provider: LLMProvider.ANTHROPIC,
        isActive: true,
        supportsVision: true,
      },
      orderBy: {
        effectiveFrom: 'desc',
      },
    });

    if (!pricing) {
      throw new NotFoundException('Claude vision pricing not found in database');
    }

    return pricing;
  }

  // ✅ Validate and normalize mime type
  private validateMediaType(mimeType: string): ValidMediaType {
    const normalized = VALID_MEDIA_TYPES[mimeType.toLowerCase()];
    if (!normalized) {
      throw new BadRequestException(
        `Unsupported image format: ${mimeType}. Supported: image/jpeg, image/png, image/gif, image/webp`,
      );
    }
    return normalized;
  }

  async analyzeImageVision(
    documentId: string,
    workspaceId: string,
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<any> {
    const startTime = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.logger.log(`[Claude Vision] 🖼️ Starting analysis for: ${documentId}`);

    let inputTokens = 0;
    let outputTokens = 0;
    let totalTokens = 0;
    let actualCostUsd = new Decimal(0);
    let profitData: any = null;
    let creditsToCharge = 0;

    try {
      const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
      if (!apiKey) {
        throw new BadRequestException('Anthropic API key not configured');
      }

      // ✅ Get pricing from DB
      const visionPricing = await this.getVisionPricing();
      const validMediaType = this.validateMediaType(mimeType);

      const client = new Anthropic({ apiKey });
      const base64Image = imageBuffer.toString('base64');

      // ✅ Use model from DB
      const response = await client.messages.create({
        model: visionPricing.modelId,
        max_tokens: visionPricing.maxOutputTokens || 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: validMediaType, // ✅ Type-safe media type
                  data: base64Image,
                },
              },
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
            ],
          },
        ],
      });

      const processingTimeMs = Date.now() - startTime;
      const responseText = response.content[0].type === 'text' ? response.content[0].text : '';

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

      inputTokens = response.usage?.input_tokens || 0;
      outputTokens = response.usage?.output_tokens || 0;
      totalTokens = inputTokens + outputTokens;

      // ✅ Calculate actual cost from DB pricing
      const inputCost = (inputTokens / 1_000_000) * Number(visionPricing.inputTokenCost);
      const outputCost = (outputTokens / 1_000_000) * Number(visionPricing.outputTokenCost);
      const totalCostUsd = inputCost + outputCost;
      actualCostUsd = new Decimal(totalCostUsd);

      // ✅ Calculate profit using global multiplier
      profitData = calculateProfitData(totalCostUsd);
      creditsToCharge = calculateCreditsFromCharge(profitData.userChargeUsd);

      this.logger.debug(
        `[Claude Vision] 💰 ${inputTokens}in/${outputTokens}out tokens | ` +
          `Cost: $${totalCostUsd.toFixed(6)} | Charge: $${profitData.userChargeUsd.toFixed(6)} | ` +
          `Profit: $${profitData.profitUsd.toFixed(6)} (${profitData.profitMarginPercentage.toFixed(2)}%)`,
      );

      // ✅ Get subscription for credit tracking
      const subscription = await this.prisma.subscription.findUnique({
        where: { workspaceId },
        select: { id: true, isByokMode: true },
      });

      if (!subscription) {
        throw new BadRequestException('No active subscription found');
      }

      // ✅ Use model from DB in DB record
      const visionAnalysis = await this.prisma.documentVisionAnalysis.create({
        data: {
          documentId,
          workspaceId,
          provider: LLMProvider.ANTHROPIC,
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
        `[Claude Vision] ✅ Completed: ${documentId} (${processingTimeMs}ms, ${totalTokens} tokens) | ` +
          `Profit: $${profitData.profitUsd.toFixed(6)} 💰`,
      );

      return visionAnalysis;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const processingTimeMs = Date.now() - startTime;

      this.logger.error(`[Claude Vision] ❌ Failed: ${documentId} - ${errorMessage}`);

      const visionPricing = await this.getVisionPricing().catch(() => null);

      await this.prisma.documentVisionAnalysis.create({
        data: {
          documentId,
          workspaceId,
          provider: LLMProvider.ANTHROPIC,
          modelId: visionPricing?.modelId || 'claude-sonnet-4-5-20250929',
          status: VisionAnalysisStatus.ERROR,
          errorMessage,
          processingTimeMs,
          requestId,
          estimatedCost: new Decimal(0),
        },
      });

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

      throw new BadRequestException(`Claude vision analysis failed: ${errorMessage}`);
    }
  }

  private async createVisionSnapshot(
    documentId: string,
    workspaceId: string,
    extractionType: VisionExtractionType,
    extractedData: string,
    confidence: number,
    modelId: string, // ✅ From DB
  ): Promise<void> {
    await this.prisma.visionExtractionSnapshot.create({
      data: {
        documentId,
        workspaceId,
        provider: LLMProvider.ANTHROPIC,
        modelId, // ✅ Use DB model
        extractionType,
        extractedData,
        confidence,
        version: 1,
        extractedAt: new Date(),
        summary: extractedData.substring(0, 500),
      },
    });
  }

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
    modelId: string, // ✅ From DB
    modelName: string, // ✅ From DB
    errorMessage?: string,
  ): Promise<void> {
    await this.prisma.documentAPILog.create({
      data: {
        workspaceId,
        documentId: documentId || undefined,
        provider: LLMProvider.ANTHROPIC,
        modelId, // ✅ Use DB model
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
          multiplier: PROFIT_CONFIG.MARKUP_MULTIPLIER,
          byokMode: isByokMode,
        },
        processedAt: new Date(),
      },
    });

    await this.prisma.creditUsageLog.create({
      data: {
        subscriptionId,
        workspaceId,
        canvasId: 'system-vision',
        podId: 'system-vision',
        executionId: `vision_${documentId}_${Date.now()}`,
        creditsUsed: creditsCharged,
        balanceBefore: 0,
        balanceAfter: 0,
        provider: LLMProvider.ANTHROPIC,
        modelId, // ✅ Use DB model
        modelName, // ✅ Use DB display name
      },
    });
  }
}
