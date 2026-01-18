// dto/create-pod.dto.ts

import {
  IsString,
  IsEnum,
  IsObject,
  ValidateNested,
  IsOptional,
  IsNumber,
  IsArray,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PodType, LLMProvider } from '@flopods/schema';

export class PositionDto {
  @ApiProperty()
  @IsNumber()
  x!: number;

  @ApiProperty()
  @IsNumber()
  y!: number;
}

export class LLMConfigDto {
  @ApiProperty({ enum: LLMProvider })
  @IsEnum(LLMProvider)
  provider!: LLMProvider;

  @ApiProperty({ example: 'gpt-4' })
  @IsString()
  model!: string;

  @ApiPropertyOptional({
    description: 'Custom system prompt. If not provided, uses default.',
    example: 'You are a helpful assistant specialized in data analysis.',
  })
  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @ApiPropertyOptional({
    example: 'Analyze the following data: {{input}}',
    description: 'User prompt template. Can be empty initially.',
  })
  @IsOptional()
  @IsString()
  userPrompt?: string;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 2,
    default: 0.7,
    description: 'Controls randomness. Lower = more focused, Higher = more creative',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @ApiPropertyOptional({
    minimum: 1,
    default: 4096,
    description: 'Maximum tokens in response',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxTokens?: number;

  @ApiPropertyOptional({
    description: 'Thinking budget for reasoning models (o1, o3)',
    example: 10000,
  })
  @IsOptional()
  @IsNumber()
  thinkingBudget?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 1, default: 1.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  topP?: number;

  @ApiPropertyOptional({ minimum: -2, maximum: 2, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(-2)
  @Max(2)
  presencePenalty?: number;

  @ApiPropertyOptional({ minimum: -2, maximum: 2, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(-2)
  @Max(2)
  frequencyPenalty?: number;

  @ApiPropertyOptional({ enum: ['text', 'json', 'json_object'], default: 'text' })
  @IsOptional()
  @IsString()
  responseFormat?: 'text' | 'json' | 'json_object';

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  streamEnabled?: boolean;

  @ApiPropertyOptional({
    description:
      'When enabled, upstream pods and semantic (RAG) context will be automatically injected into executions.',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  autoContext?: boolean;
}

export class CreatePodDto {
  @ApiProperty()
  @IsString()
  flowId!: string;

  @ApiProperty({ enum: PodType })
  @IsEnum(PodType)
  type!: PodType;

  @ApiProperty()
  @ValidateNested()
  @Type(() => PositionDto)
  position!: PositionDto;

  @ApiProperty()
  @IsString()
  label!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Pod configuration (type-specific)' })
  @IsObject()
  config!: any; // Will be LLMConfigDto for LLM pods

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  contextPods?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
