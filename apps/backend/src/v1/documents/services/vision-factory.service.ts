import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { LLMProvider } from '@flopods/schema';
import { V1GeminiVisionService } from './gemini-vision.service';
import { V1OpenAIVisionService } from './openai-vision.service';
import { V1ClaudeVisionService } from './claude-vision.service';

export interface IVisionProvider {
  analyzeImageVision(
    documentId: string,
    workspaceId: string,
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<any>;
}

@Injectable()
export class V1VisionFactoryService {
  private readonly logger = new Logger(V1VisionFactoryService.name);

  constructor(
    private readonly geminiVision: V1GeminiVisionService,
    private readonly openaiVision: V1OpenAIVisionService,
    private readonly claudeVision: V1ClaudeVisionService,
  ) {}

  getVisionProvider(provider: LLMProvider): IVisionProvider {
    this.logger.log(`[Vision Factory] Getting provider: ${provider}`);

    switch (provider) {
      case LLMProvider.GOOGLE_GEMINI:
        return this.geminiVision;

      case LLMProvider.OPENAI:
        return this.openaiVision;

      case LLMProvider.ANTHROPIC:
        return this.claudeVision;

      default:
        throw new BadRequestException(`Vision provider not supported: ${provider}`);
    }
  }

  getSupportedProviders(): LLMProvider[] {
    return [LLMProvider.GOOGLE_GEMINI, LLMProvider.OPENAI, LLMProvider.ANTHROPIC];
  }
}
