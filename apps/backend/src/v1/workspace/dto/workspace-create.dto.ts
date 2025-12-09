import { IsString, IsNotEmpty, MaxLength, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { WorkspaceType } from '@flopods/schema';

/**
 * DTO for creating a new workspace
 * Only TEAM workspaces can be created via API (PERSONAL auto-created on registration)
 */
export class WorkspaceCreateDto {
  @ApiProperty({
    description: 'Workspace name',
    example: 'My Team Workspace',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({
    description: 'Workspace type (PERSONAL workspaces are auto-created)',
    enum: WorkspaceType,
    default: WorkspaceType.PERSONAL,
    required: false,
  })
  @IsEnum(WorkspaceType)
  @IsOptional()
  type?: WorkspaceType = WorkspaceType.PERSONAL;
}
