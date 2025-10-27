// dto/execute-pod.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsArray,
  IsOptional,
  IsNumber,
  ValidateNested,
  IsIn,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LLMProvider } from '@actopod/schema';

export class LLMMessageDto {
  @ApiProperty({
    description: 'Role of the message sender',
    enum: ['system', 'user', 'assistant'],
    example: 'user',
  })
  @IsIn(['system', 'user', 'assistant'])
  role!: 'system' | 'user' | 'assistant';

  @ApiProperty({
    description: 'Content of the message',
    example: 'Explain quantum computing in simple terms',
  })
  @IsString()
  content!: string;
}

export class ExecutePodDto {
  @ApiProperty({
    description: 'ID of the pod to execute',
    example: 'pod_1234567890_abc123',
  })
  @IsString()
  podId!: string;

  @ApiProperty({
    description: 'Messages to send to the LLM',
    type: [LLMMessageDto],
    example: [{ role: 'user', content: 'Hello!' }],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LLMMessageDto)
  messages!: LLMMessageDto[];

  // Runtime overrides (all optional)
  @ApiPropertyOptional({
    description: 'Override pod provider',
    enum: LLMProvider,
    example: LLMProvider.OPENAI,
  })
  @IsOptional()
  @IsEnum(LLMProvider)
  provider?: LLMProvider;

  @ApiPropertyOptional({
    description: 'Override pod model',
    example: 'gpt-4o',
  })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({
    description: 'Override system prompt (overrides pod configuration)',
    example: 'You are an expert in quantum physics',
  })
  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @ApiPropertyOptional({
    description: 'Override sampling temperature (0-2)',
    minimum: 0,
    maximum: 2,
    example: 0.7,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @ApiPropertyOptional({
    description: 'Override maximum tokens to generate',
    minimum: 1,
    maximum: 128000000,
    example: 2048,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(128000000)
  maxTokens?: number;

  @ApiPropertyOptional({
    description: 'Override top-p nucleus sampling (0-1)',
    minimum: 0,
    maximum: 1,
    example: 0.9,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  topP?: number;

  @ApiPropertyOptional({
    description: 'Override presence penalty (-2 to 2)',
    minimum: -2,
    maximum: 2,
    example: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(-2)
  @Max(2)
  presencePenalty?: number;

  @ApiPropertyOptional({
    description: 'Override frequency penalty (-2 to 2)',
    minimum: -2,
    maximum: 2,
    example: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(-2)
  @Max(2)
  frequencyPenalty?: number;

  @ApiPropertyOptional({
    description: 'Override thinking budget for reasoning models',
    minimum: 1000,
    maximum: 128000000,
    example: 10000,
  })
  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(128000000)
  thinkingBudget?: number;

  @ApiPropertyOptional({
    description: 'Override response format',
    enum: ['text', 'json_object', 'json'],
    example: 'text',
  })
  @IsOptional()
  @IsIn(['text', 'json_object', 'json'])
  responseFormat?: 'text' | 'json_object' | 'json';
}
