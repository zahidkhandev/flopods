// src/modules/workspace/dto/workspace-update-api-key.dto.ts

import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class WorkspaceUpdateApiKeyDto {
  @ApiPropertyOptional({
    description: 'Display name',
    example: 'Updated Key Name',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @ApiPropertyOptional({
    description: 'New API key (for rotation)',
    example: 'sk-proj-xyz789...',
  })
  @IsOptional()
  @IsString()
  apiKey?: string;

  @ApiPropertyOptional({
    description: 'Active status',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
