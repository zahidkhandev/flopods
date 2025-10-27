import { ApiProperty } from '@nestjs/swagger';
import { LLMProvider } from '@actopod/schema';
import { Expose } from 'class-transformer';

export class ModelPricingDto {
  @Expose()
  @ApiProperty({ example: 'gpt-4o' })
  modelId!: string;

  @Expose()
  @ApiProperty({ example: 'gpt-4o-2024-05-13' })
  modelName!: string;

  @Expose()
  @ApiProperty({ enum: LLMProvider })
  provider!: LLMProvider;

  @Expose()
  @ApiProperty({ example: '2.50' })
  inputTokenCost!: string;

  @Expose()
  @ApiProperty({ example: '10.00' })
  outputTokenCost!: string;

  @Expose()
  @ApiProperty({ example: '0.00', nullable: true })
  reasoningTokenCost!: string | null;

  @Expose()
  @ApiProperty({ example: 128000 })
  contextWindow!: number;

  @Expose()
  @ApiProperty({ example: true })
  supportsVision!: boolean;

  @Expose()
  @ApiProperty({ example: true })
  supportsFunctionCalling!: boolean;

  @Expose()
  @ApiProperty({ example: false })
  supportsStreaming!: boolean;

  @Expose()
  @ApiProperty({ example: true })
  isActive!: boolean;

  @Expose()
  @ApiProperty({ example: '2024-05-13T00:00:00.000Z' })
  effectiveFrom!: Date;
}

export class ModelsByProviderDto {
  @Expose()
  @ApiProperty({ enum: LLMProvider })
  provider!: LLMProvider;

  @Expose()
  @ApiProperty({ type: [ModelPricingDto] })
  models!: ModelPricingDto[];

  @Expose()
  @ApiProperty({ example: 15 })
  count!: number;
}
