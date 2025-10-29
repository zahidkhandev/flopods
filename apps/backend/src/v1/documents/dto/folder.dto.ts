import {
  IsString,
  IsOptional,
  MaxLength,
  IsInt,
  Min,
  IsArray,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFolderDto {
  @ApiProperty({ example: 'Work Documents', description: 'Folder name' })
  @IsString()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ example: 'cuid123', description: 'Parent folder ID for nesting' })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({ example: 'folder', description: 'Icon name' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @ApiPropertyOptional({ example: '#FFD700', description: 'Folder color (hex)' })
  @IsOptional()
  @IsString()
  @MaxLength(7)
  color?: string;

  @ApiPropertyOptional({ example: 0, description: 'Sort order' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateFolderDto {
  @ApiPropertyOptional({ example: 'Renamed Folder', description: 'New folder name' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ example: 'cuid456', description: 'Move to new parent folder' })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({ example: 'briefcase', description: 'Update icon' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @ApiPropertyOptional({ example: '#FF6B6B', description: 'Update color' })
  @IsOptional()
  @IsString()
  @MaxLength(7)
  color?: string;

  @ApiPropertyOptional({ example: 5, description: 'Update sort order' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class MoveItemsDto {
  @ApiProperty({
    description: 'Array of document IDs to move',
    example: ['doc_123', 'doc_456', 'doc_789'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  documentIds!: string[];

  @ApiPropertyOptional({
    description: 'Destination folder ID (null or undefined for root)',
    example: 'folder_abc',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  destinationFolderId?: string | null;
}
