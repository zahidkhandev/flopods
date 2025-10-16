import { IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { WorkspaceRole } from '@actopod/schema';

/**
 * DTO for updating existing member's role and permissions
 * Cannot modify workspace OWNER
 */
export class WorkspaceUpdateMemberDto {
  @ApiProperty({
    description: 'Updated role',
    enum: WorkspaceRole,
    required: false,
  })
  @IsEnum(WorkspaceRole)
  @IsOptional()
  role?: WorkspaceRole;

  @ApiProperty({
    description: 'Can create canvas',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  canCreateCanvas?: boolean;

  @ApiProperty({
    description: 'Can delete canvas',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  canDeleteCanvas?: boolean;

  @ApiProperty({
    description: 'Can invite members',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  canInviteMembers?: boolean;

  @ApiProperty({
    description: 'Can manage members',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  canManageMembers?: boolean;

  @ApiProperty({
    description: 'Can manage API keys',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  canManageApiKeys?: boolean;
}
