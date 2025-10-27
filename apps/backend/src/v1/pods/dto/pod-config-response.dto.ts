import { Expose } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LLMProvider } from '@actopod/schema';

export class PodConfigResponseDto {
  @Expose()
  @ApiProperty({ enum: LLMProvider })
  provider!: LLMProvider;

  @Expose()
  @ApiProperty({ example: 'gpt-4o' })
  model!: string;

  @Expose()
  @ApiPropertyOptional()
  systemPrompt?: string;

  @Expose()
  @ApiProperty()
  temperature!: number;

  @Expose()
  @ApiProperty()
  maxTokens!: number;

  @Expose()
  @ApiPropertyOptional()
  thinkingBudget?: number;

  @Expose()
  @ApiPropertyOptional()
  topP?: number;

  @Expose()
  @ApiPropertyOptional()
  presencePenalty?: number;

  @Expose()
  @ApiPropertyOptional()
  frequencyPenalty?: number;

  @Expose()
  @ApiPropertyOptional()
  responseFormat?: 'text' | 'json' | 'json_object';

  @Expose()
  @ApiPropertyOptional()
  streamEnabled?: boolean;
}
