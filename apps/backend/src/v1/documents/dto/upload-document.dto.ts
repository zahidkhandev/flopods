/**
 * Upload Document DTO
 */

import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UploadDocumentDto {
  @ApiPropertyOptional({
    description: 'Folder ID to upload document into',
    example: 'folder_123',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  folderId?: string;
}
