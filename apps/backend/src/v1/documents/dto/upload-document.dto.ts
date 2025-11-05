// /src/modules/v1/documents/dto/upload-document.dto.ts

import { IsOptional, IsString, MaxLength, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { LLMProvider } from '@flopods/schema';

export class UploadDocumentDto {
  @ApiPropertyOptional({
    description: 'Folder ID to upload document into',
    example: 'folder_123',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  folderId?: string;

  @ApiPropertyOptional({
    description: 'Vision provider for image analysis',
    enum: [LLMProvider.GOOGLE_GEMINI, LLMProvider.OPENAI, LLMProvider.ANTHROPIC],
    example: LLMProvider.GOOGLE_GEMINI,
    default: LLMProvider.GOOGLE_GEMINI,
  })
  @IsOptional()
  @IsEnum([LLMProvider.GOOGLE_GEMINI, LLMProvider.OPENAI, LLMProvider.ANTHROPIC])
  visionProvider?: LLMProvider = LLMProvider.GOOGLE_GEMINI;
}
