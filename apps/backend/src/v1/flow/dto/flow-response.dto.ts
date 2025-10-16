import { Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { FlowVisibility } from '@actopod/schema';

export class FlowResponseDto {
  @Expose()
  @ApiProperty()
  id!: string;

  @Expose()
  @ApiProperty()
  workspaceId!: string;

  @Expose()
  @ApiProperty()
  spaceId!: string | null;

  @Expose()
  @ApiProperty()
  name!: string;

  @Expose()
  @ApiProperty()
  description!: string | null;

  @Expose()
  @ApiProperty()
  version!: number;

  @Expose()
  @ApiProperty({ enum: FlowVisibility })
  visibility!: FlowVisibility;

  @Expose()
  @ApiProperty()
  createdBy!: string;

  @Expose()
  @ApiProperty()
  thumbnailS3Key!: string | null;

  @Expose()
  @ApiProperty()
  thumbnailGeneratedAt!: Date | null;

  @Expose()
  @ApiProperty()
  createdAt!: Date;

  @Expose()
  @ApiProperty()
  updatedAt!: Date;

  @Expose()
  @ApiProperty({ description: 'Number of pods in this flow' })
  podCount?: number;

  @Expose()
  @ApiProperty({ description: 'Number of collaborators' })
  collaboratorCount?: number;
}

export class FlowPaginationDto {
  @ApiProperty()
  totalItems!: number;

  @ApiProperty()
  totalPages!: number;

  @ApiProperty()
  currentPage!: number;

  @ApiProperty()
  pageSize!: number;
}

export class FlowPaginatedResponseDto {
  @ApiProperty({ type: [FlowResponseDto] })
  data!: FlowResponseDto[];

  @ApiProperty()
  pagination!: FlowPaginationDto;
}
