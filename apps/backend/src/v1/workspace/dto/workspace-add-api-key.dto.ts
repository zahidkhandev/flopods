import { IsEnum, IsString, IsNotEmpty, IsOptional, IsObject, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { LLMProvider, AuthType } from '@actopod/schema';

/**
 * DTO for adding LLM provider API key to workspace
 * API keys are encrypted before storage
 */
export class WorkspaceAddApiKeyDto {
  @ApiProperty({
    description: 'LLM Provider',
    enum: LLMProvider,
    example: LLMProvider.OPENAI,
  })
  @IsEnum(LLMProvider)
  provider!: LLMProvider;

  @ApiProperty({
    description: 'Display name for the API key',
    example: 'OpenAI Production Key',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  displayName!: string;

  @ApiProperty({
    description: 'The actual API key (will be encrypted)',
    example: 'sk-proj-...',
  })
  @IsString()
  @IsNotEmpty()
  apiKey!: string;

  @ApiProperty({
    description: 'Custom endpoint (optional)',
    example: 'https://api.openai.com/v1',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  endpoint?: string;

  @ApiProperty({
    description: 'Authentication type',
    enum: AuthType,
    default: AuthType.BEARER_TOKEN,
    required: false,
  })
  @IsEnum(AuthType)
  @IsOptional()
  authType?: AuthType = AuthType.BEARER_TOKEN;

  @ApiProperty({
    description: 'Provider-specific configuration',
    required: false,
    example: { model: 'gpt-4', temperature: 0.7 },
  })
  @IsObject()
  @IsOptional()
  providerConfig?: Record<string, any>;
}
