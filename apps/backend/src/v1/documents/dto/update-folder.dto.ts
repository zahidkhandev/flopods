/**
 * Update Folder DTO
 */

import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateFolderDto {
  @ApiPropertyOptional({
    description: 'Folder name',
    example: 'Renamed Folder',
    minLength: 1,
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    description: 'Folder icon (emoji or icon name)',
    example: '📁',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @ApiPropertyOptional({
    description: 'Folder color (hex)',
    example: '#3B82F6',
    maxLength: 7,
  })
  @IsOptional()
  @IsString()
  @MaxLength(7)
  color?: string;

  @ApiPropertyOptional({
    description: 'Move to parent folder ID (null for root)',
    example: 'folder_parent_789',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  parentId?: string | null;
}
