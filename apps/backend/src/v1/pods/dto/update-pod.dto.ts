// dto/update-pod.dto.ts

import { IsOptional, IsString, IsObject, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PositionDto, LLMConfigDto } from './create-pod.dto';

export class UpdatePodDto {
  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => PositionDto)
  position?: PositionDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description:
      'Partial config update. For LLM pods, can update individual fields like systemPrompt, temperature, etc.',
  })
  @IsOptional()
  @IsObject()
  config?: Partial<LLMConfigDto> | any;

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
