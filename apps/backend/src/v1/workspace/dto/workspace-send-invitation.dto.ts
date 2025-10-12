import { IsEmail, IsEnum, IsOptional, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { WorkspaceRole } from '@actopod/schema';

/**
 * DTO for sending workspace invitation via email
 * Requires canInviteMembers permission
 */
export class WorkspaceSendInvitationDto {
  @ApiProperty({
    description: 'Email to send invitation',
    example: 'invite@example.com',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'Role for invited user',
    enum: WorkspaceRole,
    default: WorkspaceRole.MEMBER,
    required: false,
  })
  @IsEnum(WorkspaceRole)
  @IsOptional()
  role?: WorkspaceRole = WorkspaceRole.MEMBER;

  @ApiProperty({
    description: 'Custom permissions (optional override)',
    required: false,
    example: { canCreateCanvas: true, canDeleteCanvas: false },
  })
  @IsObject()
  @IsOptional()
  permissions?: Record<string, boolean>;
}
