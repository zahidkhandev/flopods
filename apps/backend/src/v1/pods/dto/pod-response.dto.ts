import { Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { PodType, PodExecutionStatus } from '@flopods/schema';

export class PodResponseDto {
  @Expose()
  @ApiProperty()
  id!: string;

  @Expose()
  @ApiProperty()
  flowId!: string;

  @Expose()
  @ApiProperty({ enum: PodType })
  type!: PodType;

  @Expose()
  @ApiProperty()
  position!: any;

  @Expose()
  @ApiProperty({ enum: PodExecutionStatus })
  executionStatus!: PodExecutionStatus;

  @Expose()
  @ApiProperty()
  createdAt!: Date;

  @Expose()
  @ApiProperty()
  updatedAt!: Date;

  @Expose()
  @ApiProperty({ description: 'Pod content from DynamoDB' })
  content?: any;

  @Expose()
  @ApiProperty({ description: 'Context pods attached' })
  contextPods?: string[];

  @Expose()
  @ApiProperty({ description: 'Lock information' })
  lockedBy?: string | null;

  @Expose()
  @ApiProperty()
  lockedAt?: Date | null;
}

export class EdgeResponseDto {
  @Expose()
  @ApiProperty()
  id!: string;

  @Expose()
  @ApiProperty()
  flowId!: string;

  @Expose()
  @ApiProperty()
  sourcePodId!: string;

  @Expose()
  @ApiProperty()
  targetPodId!: string;

  @Expose()
  @ApiProperty()
  sourceHandle!: string | null;

  @Expose()
  @ApiProperty()
  targetHandle!: string | null;

  @Expose()
  @ApiProperty()
  animated!: boolean;

  @Expose()
  @ApiProperty()
  createdAt!: Date;
}

export class FlowCanvasResponseDto {
  @ApiProperty({ type: [PodResponseDto] })
  pods!: PodResponseDto[];

  @ApiProperty({ type: [EdgeResponseDto] })
  edges!: EdgeResponseDto[];
}

export class MovePodResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty()
  movedPodId!: string;

  @ApiProperty()
  fromFlowId!: string;

  @ApiProperty()
  toFlowId!: string;

  @ApiProperty({ required: false, nullable: true })
  autoLinkedTo?: string | null;

  @ApiProperty({ required: false })
  sourceFlowDeleted?: boolean;
}
