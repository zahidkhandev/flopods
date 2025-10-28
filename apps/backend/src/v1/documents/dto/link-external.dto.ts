/**
 * Link External Document DTO
 */

import { IsNotEmpty, IsString, IsUrl, IsEnum, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentSourceType } from '@actopod/schema';

export class LinkExternalDocumentDto {
  @ApiProperty({
    description: 'External URL (YouTube, Google Drive, etc.)',
    example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  })
  @IsNotEmpty()
  @IsString()
  @IsUrl()
  @MaxLength(2048)
  externalUrl!: string;

  @ApiProperty({
    description: 'Source type',
    enum: DocumentSourceType,
    example: DocumentSourceType.YOUTUBE,
  })
  @IsNotEmpty()
  @IsEnum(DocumentSourceType)
  sourceType!: DocumentSourceType;

  @ApiPropertyOptional({
    description: 'Custom document name (optional, auto-generated if not provided)',
    example: 'ML Tutorial Video',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    description: 'Folder ID to organize document',
    example: 'folder_123',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  folderId?: string;
}
