import { IsString, IsEmail, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FlowAccessLevel } from '@actopod/schema';

export class AddCollaboratorDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ enum: FlowAccessLevel, default: FlowAccessLevel.EDITOR })
  @IsOptional()
  @IsEnum(FlowAccessLevel)
  accessLevel?: FlowAccessLevel;

  @ApiPropertyOptional({ example: 'Can view and edit this workflow' })
  @IsOptional()
  @IsString()
  message?: string;
}
