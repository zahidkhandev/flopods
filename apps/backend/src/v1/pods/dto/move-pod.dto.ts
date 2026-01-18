import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsString, IsOptional } from 'class-validator';

export class MovePodDto {
  @ApiProperty({
    description: 'Target flow ID to move this pod into',
    example: 'flow_abc123',
  })
  @IsString()
  targetFlowId!: string;

  @ApiPropertyOptional({
    description: 'If true, delete the source flow when it becomes empty after the move',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  deleteSourceFlow?: boolean = false;
}
