import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEdgeDto {
  @ApiProperty()
  @IsString()
  flowId!: string;

  @ApiProperty()
  @IsString()
  sourcePodId!: string;

  @ApiProperty()
  @IsString()
  targetPodId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceHandle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetHandle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  animated?: boolean;
}
