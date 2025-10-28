import { IsString, IsOptional, IsEnum, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FlowVisibility } from '@flopods/schema';

export class CreateFlowDto {
  @ApiProperty({ example: 'My AI Workflow' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ example: 'A multi-LLM workflow for content generation' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Space ID where this flow belongs' })
  @IsOptional()
  @IsString()
  spaceId?: string;

  @ApiPropertyOptional({ enum: FlowVisibility, default: 'PRIVATE' })
  @IsOptional()
  @IsEnum(FlowVisibility)
  visibility?: FlowVisibility = FlowVisibility.PRIVATE;
}
