import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { PodExecutionStatus, LLMProvider } from '@actopod/schema';

export class ExecutionUsageDto {
  @ApiProperty({ description: 'Prompt (input) tokens used', example: 150 })
  @Expose()
  promptTokens!: number;

  @ApiProperty({ description: 'Completion (output) tokens generated', example: 450 })
  @Expose()
  completionTokens!: number;

  @ApiProperty({ description: 'Total tokens used', example: 600 })
  @Expose()
  totalTokens!: number;

  @ApiProperty({
    description: 'Reasoning tokens (for o-series models)',
    required: false,
    example: 200,
  })
  @Expose()
  reasoningTokens?: number;

  @ApiProperty({ description: 'Cached input tokens (cost savings)', required: false, example: 100 })
  @Expose()
  cachedTokens?: number;
}

export class ExecutionCostDto {
  @ApiProperty({ description: 'Input cost in USD', example: 0.000375 })
  @Expose()
  inputCost!: number;

  @ApiProperty({ description: 'Output cost in USD', example: 0.0045 })
  @Expose()
  outputCost!: number;

  @ApiProperty({ description: 'Reasoning cost in USD', example: 0.0012 })
  @Expose()
  reasoningCost!: number;

  @ApiProperty({ description: 'Total cost in USD', example: 0.005975 })
  @Expose()
  totalCost!: number;
}

export class ExecutionResultDto {
  @ApiProperty({ description: 'Unique execution ID', example: 'exec_cm2abc123' })
  @Expose()
  executionId!: string;

  @ApiProperty({ description: 'Generated content from LLM', example: 'Quantum computing uses...' })
  @Expose()
  content!: string;

  @ApiProperty({ description: 'Token usage breakdown', type: ExecutionUsageDto })
  @Expose()
  usage!: ExecutionUsageDto;

  @ApiProperty({ description: 'Cost breakdown in USD', type: ExecutionCostDto })
  @Expose()
  cost!: ExecutionCostDto;
}

export class ExecutionHistoryItemDto {
  @ApiProperty({ description: 'Execution ID', example: 'exec_cm2abc123' })
  @Expose()
  id!: string;

  @ApiProperty({ description: 'Pod ID', example: 'pod_1234567890_abc123' })
  @Expose()
  podId!: string;

  @ApiProperty({ description: 'Execution status', enum: PodExecutionStatus, example: 'COMPLETED' })
  @Expose()
  status!: PodExecutionStatus;

  @ApiProperty({ description: 'LLM provider used', enum: LLMProvider, example: 'OPENAI' })
  @Expose()
  provider!: LLMProvider;

  @ApiProperty({ description: 'Model ID', example: 'gpt-4o' })
  @Expose()
  modelId!: string;

  @ApiProperty({ description: 'Model name returned by provider', example: 'gpt-4o-2024-05-13' })
  @Expose()
  modelName!: string | null;

  @ApiProperty({ description: 'Input tokens used', example: 150 })
  @Expose()
  inputTokens!: number;

  @ApiProperty({ description: 'Output tokens generated', example: 450 })
  @Expose()
  outputTokens!: number;

  @ApiProperty({ description: 'Reasoning tokens (o-series)', example: 0 })
  @Expose()
  reasoningTokens!: number;

  @ApiProperty({ description: 'Total cost in USD', example: '0.005975', required: false })
  @Expose()
  costInUsd!: string | null;

  @ApiProperty({ description: 'Execution start timestamp', example: '2025-10-24T18:00:00.000Z' })
  @Expose()
  startedAt!: Date;

  @ApiProperty({ description: 'Execution finish timestamp', example: '2025-10-24T18:00:05.000Z' })
  @Expose()
  finishedAt!: Date | null;

  @ApiProperty({ description: 'Runtime in milliseconds', example: 5432 })
  @Expose()
  runtimeInMs!: number | null;

  @ApiProperty({ description: 'Error message if failed', required: false })
  @Expose()
  errorMessage!: string | null;

  @ApiProperty({ description: 'Error code if failed', required: false })
  @Expose()
  errorCode!: string | null;
}

export class ExecutionDetailDto {
  @ApiProperty({ description: 'Execution ID', example: 'exec_cm2abc123' })
  @Expose()
  id!: string;

  @ApiProperty({ description: 'Pod details' })
  @Expose()
  pod!: {
    id: string;
    type: string;
    flowId: string;
  };

  @ApiProperty({ description: 'Execution status', enum: PodExecutionStatus })
  @Expose()
  status!: PodExecutionStatus;

  @ApiProperty({ description: 'LLM provider', enum: LLMProvider })
  @Expose()
  provider!: LLMProvider;

  @ApiProperty({ description: 'Model used' })
  @Expose()
  modelId!: string;

  @ApiProperty({ description: 'Token counts' })
  @Expose()
  inputTokens!: number;

  @Expose()
  outputTokens!: number;

  @Expose()
  reasoningTokens!: number;

  @ApiProperty({ description: 'Cost in USD' })
  @Expose()
  costInUsd!: string | null;

  @ApiProperty({ description: 'Timestamps' })
  @Expose()
  startedAt!: Date;

  @Expose()
  finishedAt!: Date | null;

  @Expose()
  runtimeInMs!: number | null;

  @ApiProperty({ description: 'Raw response from LLM provider' })
  @Expose()
  responseMetadata!: any;

  @ApiProperty({ description: 'Error info if failed' })
  @Expose()
  errorMessage!: string | null;

  @Expose()
  errorCode!: string | null;
}
