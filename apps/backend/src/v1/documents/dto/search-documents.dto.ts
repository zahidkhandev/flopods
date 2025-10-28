/**
 * Search Documents DTO
 */

import { IsNotEmpty, IsString, IsOptional, IsArray, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SearchDocumentsDto {
  @ApiProperty({
    description: 'Search query text',
    example: 'machine learning algorithms',
    minLength: 1,
  })
  @IsNotEmpty()
  @IsString()
  query!: string;

  @ApiPropertyOptional({
    description: 'Filter by specific document IDs',
    type: [String],
    example: ['doc_123', 'doc_456'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documentIds?: string[];

  @ApiPropertyOptional({
    description: 'Filter by folder ID',
    example: 'folder_789',
  })
  @IsOptional()
  @IsString()
  folderId?: string;

  @ApiPropertyOptional({
    description: 'Number of results to return',
    example: 5,
    minimum: 1,
    maximum: 20,
    default: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  topK?: number = 5;

  @ApiPropertyOptional({
    description: 'Minimum similarity score (0-1)',
    example: 0.7,
    minimum: 0,
    maximum: 1,
    default: 0.7,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(1)
  minSimilarity?: number = 0.7;
}
