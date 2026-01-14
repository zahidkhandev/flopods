import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';
import {
  LLMProvider,
  APIRequestType,
  VisionAnalysisStatus,
  VisionExtractionType,
  Prisma,
} from '@flopods/schema';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../prisma/prisma.service';
import { S3Service } from '../../../common/aws/s3/s3.service';
import {
  calculateProfitData,
  calculateCreditsFromCharge,
  PROFIT_CONFIG,
} from '../../../common/config/profit.config';
import { V1ApiKeyService } from '../../workspace/services/api-key.service';

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
export class V1GeminiVisionService {
  private readonly logger = new Logger(V1GeminiVisionService.name);
  private readonly defaultBaseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  private readonly VISION_TIMEOUT = 60000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    private readonly configService: ConfigService,
    private readonly apiKeyService: V1ApiKeyService,
  ) {}

  // Get vision pricing from DB
  private async getVisionPricing() {
    const pricing = await this.prisma.modelPricingTier.findFirst({
      where: {
        provider: LLMProvider.GOOGLE_GEMINI,
        modelId: 'gemini-2.5-flash-vision',
        isActive: true,
      },
      orderBy: {
        effectiveFrom: 'desc',
      },
    });

    if (!pricing) {
      throw new NotFoundException('Vision pricing not found in database');
    }

    return pricing;
  }

  private async getApiKeyForWorkspace(workspaceId: string): Promise<string> {
    try {
      const workspaceKey = await this.apiKeyService.getActiveKey(
        workspaceId,
        LLMProvider.GOOGLE_GEMINI,
      );

      if (workspaceKey) {
        this.logger.debug(`[Vision] 🔑 Using workspace API key for: ${workspaceId}`);
        return workspaceKey;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`[Vision] ⚠️ Failed to get workspace key: ${errorMsg}`);
    }

    const platformKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!platformKey) {
      throw new BadRequestException(
        'No Gemini API key available. Configure GEMINI_API_KEY in .env',
      );
    }

    this.logger.debug(`[Vision] Using platform API key (fallback)`);
    return platformKey;
  }

  async analyzeImageVision(
    documentId: string,
    workspaceId: string,
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<any> {
    const startTime = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.logger.log(`[Vision] 🖼️ Starting analysis for: ${documentId}`);

    let inputTokens = 0;
    let outputTokens = 0;
    let totalTokens = 0;
    let actualCostUsd = new Decimal(0);
    let profitData: any = null;
    let creditsToCharge = 0;

    try {
      const apiKey = await this.getApiKeyForWorkspace(workspaceId);
      const pricing = await this.getVisionPricing();
      const modelId = pricing.modelId; // use DB model id consistently

      this.logger.debug(
        `[Vision] API Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 10)} (length: ${apiKey.length})`,
      );

      const base64Image = imageBuffer.toString('base64');

      const promptText = `Analyze this image comprehensively and provide:
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
}`;

      const url = `${this.defaultBaseUrl}/models/${modelId}:generateContent?key=${apiKey}`;

      this.logger.debug(`[Vision] 📡 Calling: ${url.substring(0, 80)}...`);

      const response = await axios.post(
        url,
        {
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: base64Image,
                  },
                },
                {
                  text: promptText,
                },
              ],
            },
          ],
        },
        {
          timeout: this.VISION_TIMEOUT,
          headers: { 'Content-Type': 'application/json' },
        },
      );

      const processingTimeMs = Date.now() - startTime;

      const responseText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
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

      const usageMetadata = response.data?.usageMetadata;
      totalTokens = usageMetadata?.totalTokenCount || 0;
      const promptTokens = usageMetadata?.promptTokenCount || 0;
      const candidatesTokens = usageMetadata?.candidatesTokenCount || 0;
      inputTokens = promptTokens;
      outputTokens = candidatesTokens;

      this.logger.debug(`[Vision] 📋 Usage metadata: ${JSON.stringify(usageMetadata)}`);
      this.logger.debug(
        `[Vision] 🔢 Parsed tokens - Input: ${inputTokens}, Output: ${outputTokens}, Total: ${totalTokens}`,
      );

      if (totalTokens === 0) {
        this.logger.warn(
          `[Vision] ⚠️ WARNING: Total tokens is 0! Response: ${JSON.stringify(response.data)}`,
        );
      }

      // Pricing from DB (Decimal-safe)
      const inputCostPerMillion = parseFloat(pricing.inputTokenCost.toString());
      const outputCostPerMillion = parseFloat(pricing.outputTokenCost.toString());

      const inputCost = (inputTokens / 1_000_000) * inputCostPerMillion;
      const outputCost = (outputTokens / 1_000_000) * outputCostPerMillion;
      const totalCostUsd = inputCost + outputCost;
      actualCostUsd = new Decimal(Number(totalCostUsd.toFixed(10)));

      this.logger.debug(
        `[Vision] 💵 Costs - Input: $${inputCost}, Output: $${outputCost}, Total: $${totalCostUsd}`,
      );

      profitData = calculateProfitData(totalCostUsd);
      creditsToCharge = calculateCreditsFromCharge(profitData.userChargeUsd);

      this.logger.debug(
        `[Vision] 💰 ${inputTokens}in/${outputTokens}out tokens | Cost: $${totalCostUsd.toFixed(10)} | Charge: $${profitData.userChargeUsd.toFixed(10)} | Profit: $${profitData.profitUsd.toFixed(10)} (${profitData.profitMarginPercentage.toFixed(2)}%) | ROI: ${profitData.roi.toFixed(0)}% | Multiplier: ${PROFIT_CONFIG.MARKUP_MULTIPLIER}x`,
      );

      const subscription = await this.prisma.subscription.findUnique({
        where: { workspaceId },
        select: { id: true, isByokMode: true },
      });

      if (!subscription) {
        throw new BadRequestException('No active subscription found for workspace');
      }

      const visionAnalysis = await this.prisma.documentVisionAnalysis.upsert({
        where: {
          documentId_provider: {
            documentId,
            provider: LLMProvider.GOOGLE_GEMINI,
          },
        },
        update: {
          modelId: modelId,
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
          updatedAt: new Date(),
        },
        create: {
          documentId,
          workspaceId,
          provider: LLMProvider.GOOGLE_GEMINI,
          modelId: modelId,
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
      );

      await this.logGeminiApiCall(
        workspaceId,
        documentId,
        subscription.id,
        inputTokens,
        outputTokens,
        totalTokens,
        actualCostUsd,
        creditsToCharge,
        Number(profitData.profitUsd),
        subscription.isByokMode,
        true,
      );

      this.logger.log(
        `[Vision] Completed: ${documentId} (${processingTimeMs}ms, ${totalTokens} tokens) | Profit: $${profitData.profitUsd.toFixed(6)} 💰`,
      );

      return visionAnalysis;
    } catch (error) {
      const axiosError = error as AxiosError;
      const errorMessage = axiosError.message || 'Unknown error';
      const errorRequestId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const processingTimeMs = Date.now() - startTime;

      this.logger.error(`[Vision] ❌ Failed: ${documentId} - ${errorMessage}`);

      if (axiosError.response) {
        this.logger.error(
          `[Vision] HTTP ${axiosError.response.status}: ${JSON.stringify(axiosError.response.data)}`,
        );
      }

      let subscription = null;
      try {
        subscription = await this.prisma.subscription.findUnique({
          where: { workspaceId },
          select: { id: true, isByokMode: true },
        });
      } catch (subError) {
        this.logger.error(`[Vision] Failed to fetch subscription: ${subError}`);
      }

      try {
        await this.prisma.documentVisionAnalysis.upsert({
          where: {
            documentId_provider: {
              documentId,
              provider: LLMProvider.GOOGLE_GEMINI,
            },
          },
          update: {
            status: VisionAnalysisStatus.ERROR,
            errorMessage,
            processingTimeMs,
            requestId: errorRequestId,
            estimatedCost: new Decimal(0),
            updatedAt: new Date(),
          },
          create: {
            documentId,
            workspaceId,
            provider: LLMProvider.GOOGLE_GEMINI,
            modelId: 'gemini-2.5-flash',
            status: VisionAnalysisStatus.ERROR,
            errorMessage,
            processingTimeMs,
            requestId: errorRequestId,
            estimatedCost: new Decimal(0),
          },
        });
      } catch (dbError) {
        this.logger.warn(`[Vision] Failed to save error record: ${dbError}`);
      }

      if (subscription) {
        try {
          await this.logGeminiApiCall(
            workspaceId,
            documentId,
            subscription.id,
            0,
            0,
            0,
            new Decimal(0),
            0,
            0,
            subscription.isByokMode,
            false,
            errorMessage,
          );
        } catch (logError) {
          this.logger.warn(`[Vision] Failed to log error: ${logError}`);
        }
      }

      throw new BadRequestException(`Vision analysis failed: ${errorMessage}`);
    }
  }

  private async createVisionSnapshot(
    documentId: string,
    workspaceId: string,
    extractionType: VisionExtractionType,
    extractedData: string,
    confidence: number,
  ): Promise<void> {
    await this.prisma.visionExtractionSnapshot.create({
      data: {
        documentId,
        workspaceId,
        provider: LLMProvider.GOOGLE_GEMINI,
        modelId: 'gemini-2.5-flash',
        extractionType,
        extractedData,
        confidence,
        version: 1,
        extractedAt: new Date(),
        summary: extractedData.substring(0, 500),
      },
    });
  }

  private async logGeminiApiCall(
    workspaceId: string,
    documentId: string | null,
    subscriptionId: string,
    inputTokens: number,
    outputTokens: number,
    totalTokens: number,
    estimatedCost: Decimal,
    creditsCharged: number,
    profitUsd: number,
    isByokMode: boolean,
    success: boolean,
    errorMessage?: string,
  ): Promise<void> {
    const profitMargin =
      profitUsd > 0 && Number(estimatedCost) > 0
        ? ((profitUsd / (Number(estimatedCost) * PROFIT_CONFIG.MARKUP_MULTIPLIER)) * 100).toFixed(2)
        : '0';

    await this.prisma.documentAPILog.create({
      data: {
        workspaceId,
        documentId: documentId || undefined,
        provider: LLMProvider.GOOGLE_GEMINI,
        modelId: 'gemini-2.5-flash',
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
          profitMargin,
          multiplier: PROFIT_CONFIG.MARKUP_MULTIPLIER,
          byokMode: isByokMode,
        },
        processedAt: new Date(),
      },
    });

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
        provider: LLMProvider.GOOGLE_GEMINI,
        modelId: 'gemini-2.5-flash',
        modelName: 'Gemini Vision',
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
