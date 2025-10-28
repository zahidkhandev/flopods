import { IsEnum, IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { FlowAccessLevel } from '@flopods/schema';

export class UpdateCollaboratorDto {
  @ApiPropertyOptional({ enum: FlowAccessLevel })
  @IsOptional()
  @IsEnum(FlowAccessLevel)
  accessLevel?: FlowAccessLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  canEdit?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  canExecute?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  canDelete?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  canShare?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  canInvite?: boolean;
}
