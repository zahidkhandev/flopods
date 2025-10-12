import { IsString, IsOptional, IsBoolean, IsObject, MaxLength, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AuthType } from '@actopod/schema';

/**
 * DTO for updating existing API key
 * All fields are optional (partial update)
 */
export class WorkspaceUpdateApiKeyDto {
  @ApiProperty({
    description: 'Updated display name',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  displayName?: string;

  @ApiProperty({
    description: 'Updated API key (will be re-encrypted)',
    required: false,
  })
  @IsString()
  @IsOptional()
  apiKey?: string;

  @ApiProperty({
    description: 'Updated endpoint',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  endpoint?: string;

  @ApiProperty({
    description: 'Updated auth type',
    enum: AuthType,
    required: false,
  })
  @IsEnum(AuthType)
  @IsOptional()
  authType?: AuthType;

  @ApiProperty({
    description: 'Updated provider config',
    required: false,
  })
  @IsObject()
  @IsOptional()
  providerConfig?: Record<string, any>;

  @ApiProperty({
    description: 'Active status',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
