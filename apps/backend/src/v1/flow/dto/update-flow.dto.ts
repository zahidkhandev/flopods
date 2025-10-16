import { IsString, IsOptional, IsEnum, MaxLength, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { FlowVisibility } from '@actopod/schema';

export class UpdateFlowDto {
  @ApiPropertyOptional({ example: 'My Updated Workflow' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ example: 'Updated description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Space ID' })
  @IsOptional()
  @IsString()
  spaceId?: string;

  @ApiPropertyOptional({ enum: FlowVisibility })
  @IsOptional()
  @IsEnum(FlowVisibility)
  visibility?: FlowVisibility;
}
