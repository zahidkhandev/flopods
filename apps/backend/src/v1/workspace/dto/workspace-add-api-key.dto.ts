// src/modules/workspace/dto/workspace-add-api-key.dto.ts

import { IsString, IsEnum, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { LLMProvider } from '@actopod/schema';

export class WorkspaceAddApiKeyDto {
  @ApiProperty({
    description: 'LLM provider',
    enum: LLMProvider,
    example: 'OPENAI',
  })
  @IsEnum(LLMProvider)
  provider!: LLMProvider;

  @ApiProperty({
    description: 'Display name for the key',
    example: 'My OpenAI Key',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  displayName!: string;

  @ApiProperty({
    description: 'The API key (will be encrypted)',
    example: 'sk-proj-abc123...',
  })
  @IsString()
  apiKey!: string;
}
