/**
 * Create Folder DTO
 */

import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFolderDto {
  @ApiProperty({
    description: 'Folder name',
    example: 'Project Documents',
    minLength: 1,
    maxLength: 255,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({
    description: 'Parent folder ID for nested folders',
    example: 'folder_parent_123',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  parentId?: string;
}
