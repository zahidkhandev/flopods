import { IsOptional, IsEnum, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { FlowVisibility } from '@actopod/schema';

export class FlowQueryDto {
  @ApiPropertyOptional({ example: 1, minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({ example: 'My Flow' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: FlowVisibility })
  @IsOptional()
  @IsEnum(FlowVisibility)
  visibility?: FlowVisibility;

  @ApiPropertyOptional({ description: 'Space ID to filter by' })
  @IsOptional()
  @IsString()
  spaceId?: string;

  get skip(): number {
    return (this.page - 1) * this.limit;
  }
}
