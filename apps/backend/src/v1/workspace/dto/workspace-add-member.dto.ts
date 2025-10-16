import { IsEmail, IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { WorkspaceRole } from '@actopod/schema';

/**
 * DTO for adding a new member to workspace
 * Requires canManageMembers permission
 */
export class WorkspaceAddMemberDto {
  @ApiProperty({
    description: 'Email of the user to add',
    example: 'member@example.com',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'Role to assign',
    enum: WorkspaceRole,
    default: WorkspaceRole.MEMBER,
    required: false,
  })
  @IsEnum(WorkspaceRole)
  @IsOptional()
  role?: WorkspaceRole = WorkspaceRole.MEMBER;

  @ApiProperty({
    description: 'Can create canvas',
    default: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  canCreateCanvas?: boolean = true;

  @ApiProperty({
    description: 'Can delete canvas',
    default: false,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  canDeleteCanvas?: boolean = false;

  @ApiProperty({
    description: 'Can invite members (requires PAID plan)',
    default: false,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  canInviteMembers?: boolean = false;

  @ApiProperty({
    description: 'Can manage members',
    default: false,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  canManageMembers?: boolean = false;

  @ApiProperty({
    description: 'Can manage API keys',
    default: false,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  canManageApiKeys?: boolean = false;
}
