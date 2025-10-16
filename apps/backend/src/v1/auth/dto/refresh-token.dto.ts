import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token to get new access token',
    required: true,
  })
  @IsString({ message: 'Refresh token must be a string' })
  @IsNotEmpty({ message: 'Refresh token is required' })
  refreshToken!: string;

  @ApiProperty({
    description: 'Device ID for session management',
    required: false,
  })
  @IsString({ message: 'Device ID must be a string' })
  @IsOptional()
  deviceId?: string;
}
