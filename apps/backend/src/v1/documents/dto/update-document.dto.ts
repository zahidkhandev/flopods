/**
 * Update Document DTO
 */

import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateDocumentDto {
  @ApiPropertyOptional({
    description: 'Document name',
    example: 'Updated Document Name',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    description: 'Move to folder ID (null to move to root)',
    example: 'folder_456',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  folderId?: string | null;
}
