/**
 * Move Items DTO
 */

import { IsNotEmpty, IsArray, IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MoveItemsDto {
  @ApiProperty({
    description: 'Document IDs to move',
    type: [String],
    example: ['doc_123', 'doc_456'],
  })
  @IsNotEmpty()
  @IsArray()
  @IsString({ each: true })
  documentIds!: string[];

  @ApiPropertyOptional({
    description: 'Destination folder ID (null for root)',
    example: 'folder_789',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  destinationFolderId?: string | null;
}
