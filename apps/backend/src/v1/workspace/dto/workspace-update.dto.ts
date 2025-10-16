import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for updating workspace details
 * Currently only name is updatable
 */
export class WorkspaceUpdateDto {
  @ApiProperty({
    description: 'Updated workspace name',
    example: 'Updated Team Name',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;
}
