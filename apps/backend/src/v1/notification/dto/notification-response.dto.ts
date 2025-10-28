import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '@flopods/schema';
import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
export class NotificationResponseDto {
  @ApiProperty({
    description: 'Unique notification identifier',
    example: 'cm2abc123xyz',
  })
  @Expose()
  id!: string;

  @ApiProperty({
    description: 'User ID who owns this notification',
    example: 'cm1user456',
  })
  @Expose()
  userId!: string;

  @ApiProperty({
    description: 'Type of notification',
    enum: NotificationType,
    example: NotificationType.WORKSPACE_INVITATION,
  })
  @Expose()
  type!: NotificationType;

  @ApiProperty({
    description: 'Notification title',
    example: 'Workspace Invitation: Acme Corp',
  })
  @Expose()
  title!: string;

  @ApiProperty({
    description: 'Notification body/content',
    example: "You've been invited to join Acme Corp as MEMBER",
  })
  @Expose()
  body!: string;

  @ApiPropertyOptional({
    description: 'Type of related entity',
    example: 'workspace_invitation',
    nullable: true,
  })
  @Expose()
  entityType?: string | null;

  @ApiPropertyOptional({
    description: 'ID of related entity',
    example: 'cm2workspace789',
    nullable: true,
  })
  @Expose()
  entityId?: string | null;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { workspaceId: 'cm2ws123', role: 'MEMBER' },
    nullable: true,
  })
  @Expose()
  metadata?: Record<string, any> | null;

  @ApiProperty({
    description: 'Whether notification has been read',
    example: false,
  })
  @Expose()
  isRead!: boolean;

  @ApiPropertyOptional({
    description: 'Timestamp when notification was read',
    example: '2025-10-16T14:30:00.000Z',
    nullable: true,
  })
  @Expose()
  @Type(() => Date)
  readAt?: Date | null;

  @ApiPropertyOptional({
    description: 'URL to navigate when notification is clicked',
    example: '/workspace/invite/abc123token',
    nullable: true,
  })
  @Expose()
  actionUrl?: string | null;

  @ApiProperty({
    description: 'Notification creation timestamp',
    example: '2025-10-16T12:00:00.000Z',
  })
  @Expose()
  @Type(() => Date)
  createdAt!: Date;

  @ApiPropertyOptional({
    description: 'Notification expiration timestamp',
    example: '2025-10-23T12:00:00.000Z',
    nullable: true,
  })
  @Expose()
  @Type(() => Date)
  expiresAt?: Date | null;
}
