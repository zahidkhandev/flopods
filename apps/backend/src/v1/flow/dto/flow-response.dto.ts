import { Expose, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FlowVisibility, FlowAccessLevel, FlowActivityAction } from '@actopod/schema';

/**
 * Flow Response DTO
 * Represents a complete flow with metadata
 */
export class FlowResponseDto {
  @ApiProperty({
    description: 'Unique flow identifier',
    example: 'flow_clx123abc456',
  })
  @Expose()
  id!: string;

  @ApiProperty({
    description: 'Workspace ID this flow belongs to',
    example: 'ws_clx789def012',
  })
  @Expose()
  workspaceId!: string;

  @ApiPropertyOptional({
    description: 'Space ID (folder) this flow is organized under',
    example: 'space_clx345ghi678',
    nullable: true,
  })
  @Expose()
  spaceId!: string | null;

  @ApiProperty({
    description: 'Flow name',
    example: 'Customer Support Automation',
    maxLength: 255,
  })
  @Expose()
  name!: string;

  @ApiPropertyOptional({
    description: 'Flow description',
    example: 'Automates customer support responses using GPT-4',
    maxLength: 500,
    nullable: true,
  })
  @Expose()
  description!: string | null;

  @ApiProperty({
    description: 'Flow visibility level',
    enum: FlowVisibility,
    example: FlowVisibility.PRIVATE,
    default: FlowVisibility.PRIVATE,
  })
  @Expose()
  visibility!: FlowVisibility;

  @ApiProperty({
    description: 'User ID of the flow creator',
    example: 'user_clx901jkl234',
  })
  @Expose()
  createdBy!: string;

  @ApiProperty({
    description: 'Flow creation timestamp',
    example: '2025-10-25T00:00:00.000Z',
    type: Date,
  })
  @Expose()
  createdAt!: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2025-10-25T00:30:00.000Z',
    type: Date,
  })
  @Expose()
  updatedAt!: Date;

  @ApiProperty({
    description: 'Number of pods (nodes) in this flow',
    example: 15,
    minimum: 0,
  })
  @Expose()
  podCount!: number;

  @ApiProperty({
    description: 'Number of collaborators with access to this flow',
    example: 3,
    minimum: 0,
  })
  @Expose()
  collaboratorCount!: number;

  @ApiPropertyOptional({
    description: 'S3 key for flow thumbnail image',
    example: 'thumbnails/flow_clx123abc456.png',
    nullable: true,
  })
  @Expose()
  thumbnailS3Key!: string | null;

  @ApiPropertyOptional({
    description: 'Timestamp when thumbnail was last generated',
    example: '2025-10-25T00:15:00.000Z',
    type: Date,
    nullable: true,
  })
  @Expose()
  thumbnailGeneratedAt!: Date | null;
}

/**
 * Pagination Metadata DTO
 */
export class FlowPaginationDto {
  @ApiProperty({
    description: 'Total number of items across all pages',
    example: 47,
    minimum: 0,
  })
  @Expose()
  totalItems!: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 3,
    minimum: 0,
  })
  @Expose()
  totalPages!: number;

  @ApiProperty({
    description: 'Current page number (1-indexed)',
    example: 1,
    minimum: 1,
  })
  @Expose()
  currentPage!: number;

  @ApiProperty({
    description: 'Number of items on current page',
    example: 20,
    minimum: 0,
  })
  @Expose()
  pageSize!: number;
}

/**
 * Paginated Flow Response DTO
 */
export class FlowPaginatedResponseDto {
  @ApiProperty({
    description: 'Array of flow objects',
    type: [FlowResponseDto],
    isArray: true,
  })
  @Expose()
  @Type(() => FlowResponseDto)
  data!: FlowResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: FlowPaginationDto,
  })
  @Expose()
  @Type(() => FlowPaginationDto)
  pagination!: FlowPaginationDto;
}

/**
 * User Info DTO (Embedded in Collaborator Response)
 */
export class UserInfoDto {
  @ApiProperty({
    description: 'User ID',
    example: 'user_clx901jkl234',
  })
  id!: string;

  @ApiPropertyOptional({
    description: 'User display name',
    example: 'John Doe',
    nullable: true,
  })
  name!: string | null;

  @ApiProperty({
    description: 'User email address',
    example: 'john.doe@example.com',
  })
  email!: string;

  @ApiPropertyOptional({
    description: 'User profile image URL',
    example: 'https://example.com/avatar.jpg',
    nullable: true,
  })
  image!: string | null;
}

/**
 * Flow Collaborator Response DTO
 */
export class CollaboratorResponseDto {
  @ApiProperty({
    description: 'Collaborator record ID',
    example: 'collab_clx567mno890',
  })
  @Expose()
  id!: string;

  @ApiProperty({
    description: 'User ID of the collaborator',
    example: 'user_clx901jkl234',
  })
  @Expose()
  userId!: string;

  @ApiProperty({
    description: 'Flow ID this collaboration is for',
    example: 'flow_clx123abc456',
  })
  @Expose()
  flowId!: string;

  @ApiProperty({
    description: 'Access level assigned to collaborator',
    enum: FlowAccessLevel,
    example: FlowAccessLevel.EDITOR,
  })
  @Expose()
  accessLevel!: FlowAccessLevel;

  @ApiProperty({
    description: 'Can edit flow content (pods, edges)',
    example: true,
    default: true,
  })
  @Expose()
  canEdit!: boolean;

  @ApiProperty({
    description: 'Can execute pods (run LLM queries)',
    example: true,
    default: true,
  })
  @Expose()
  canExecute!: boolean;

  @ApiProperty({
    description: 'Can delete pods and edges',
    example: false,
    default: false,
  })
  @Expose()
  canDelete!: boolean;

  @ApiProperty({
    description: 'Can share flow with others',
    example: false,
    default: false,
  })
  @Expose()
  canShare!: boolean;

  @ApiProperty({
    description: 'Can invite new collaborators',
    example: false,
    default: false,
  })
  @Expose()
  canInvite!: boolean;

  @ApiProperty({
    description: 'Timestamp when collaborator was invited',
    example: '2025-10-24T12:00:00.000Z',
    type: Date,
  })
  @Expose()
  invitedAt!: Date;

  @ApiPropertyOptional({
    description: 'Timestamp of last view/access',
    example: '2025-10-24T18:30:00.000Z',
    type: Date,
    nullable: true,
  })
  @Expose()
  lastViewedAt!: Date | null;

  @ApiProperty({
    description: 'Collaborator user information',
    type: UserInfoDto,
  })
  @Expose()
  @Type(() => UserInfoDto)
  user!: UserInfoDto;
}

/**
 * User Info DTO (for Activity Log)
 */
export class ActivityUserInfoDto {
  @ApiProperty({
    description: 'User ID',
    example: 'user_clx901jkl234',
  })
  id!: string;

  @ApiPropertyOptional({
    description: 'User display name',
    example: 'John Doe',
    nullable: true,
  })
  name!: string | null;

  @ApiProperty({
    description: 'User email address',
    example: 'john.doe@example.com',
  })
  email!: string;
}

/**
 * Flow Activity Log Response DTO
 */
export class ActivityLogResponseDto {
  @ApiProperty({
    description: 'Activity log entry ID',
    example: 'activity_clx789pqr012',
  })
  @Expose()
  id!: string;

  @ApiProperty({
    description: 'Flow ID this activity belongs to',
    example: 'flow_clx123abc456',
  })
  @Expose()
  flowId!: string;

  @ApiPropertyOptional({
    description: 'User ID who performed the action',
    example: 'user_clx901jkl234',
    nullable: true,
  })
  @Expose()
  userId!: string | null;

  @ApiProperty({
    description: 'Type of action performed',
    enum: FlowActivityAction,
    example: FlowActivityAction.FLOW_UPDATED,
  })
  @Expose()
  action!: FlowActivityAction;

  @ApiPropertyOptional({
    description: 'Type of entity affected (pod, edge, collaborator, etc.)',
    example: 'pod',
    nullable: true,
  })
  @Expose()
  entityType!: string | null;

  @ApiPropertyOptional({
    description: 'ID of the affected entity',
    example: 'pod_clx456stu789',
    nullable: true,
  })
  @Expose()
  entityId!: string | null;

  @ApiPropertyOptional({
    description: 'JSON object containing change details',
    example: { name: 'Updated Flow Name', visibility: 'WORKSPACE' },
    nullable: true,
  })
  @Expose()
  changeData!: any;

  @ApiProperty({
    description: 'Timestamp when action was performed',
    example: '2025-10-24T15:45:00.000Z',
    type: Date,
  })
  @Expose()
  createdAt!: Date;

  @ApiPropertyOptional({
    description: 'User who performed the action (null for system actions)',
    type: ActivityUserInfoDto,
    nullable: true,
  })
  @Expose()
  @Type(() => ActivityUserInfoDto)
  user!: ActivityUserInfoDto | null;
}
