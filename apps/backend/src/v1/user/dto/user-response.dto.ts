import { ApiProperty } from '@nestjs/swagger';

export class UserProfileDto {
  @ApiProperty({ example: 'usr_123abc' })
  userId!: string;

  @ApiProperty({ example: 'user@flopods.com' })
  email!: string;

  @ApiProperty({ example: 'Zahid' })
  name!: string;

  @ApiProperty({ example: 'https://cdn.flopods.com/u/avatar.png', nullable: true })
  image!: string | null;

  @ApiProperty({ example: '2025-01-15T10:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2025-01-20T10:00:00.000Z' })
  updatedAt!: string;
}

export class UserProfileResponseDto {
  @ApiProperty({ example: 200 })
  statusCode!: number;

  @ApiProperty({ example: 'User fetched successfully' })
  message!: string;

  @ApiProperty({ type: UserProfileDto })
  data!: UserProfileDto;

  @ApiProperty({ example: [] })
  errors!: string[];

  @ApiProperty({ example: '2025-01-20T10:00:00.000Z' })
  timestamp!: string;
}

export class VerificationStatusDto {
  @ApiProperty({ example: true })
  isVerified!: boolean;

  @ApiProperty({ example: 'user@flopods.com' })
  email!: string;
}

export class VerificationStatusResponseDto {
  @ApiProperty({ example: 200 })
  statusCode!: number;

  @ApiProperty({ example: 'Verification status fetched successfully' })
  message!: string;

  @ApiProperty({ type: VerificationStatusDto })
  data!: VerificationStatusDto;

  @ApiProperty({ example: [] })
  errors!: string[];

  @ApiProperty({ example: '2025-01-20T10:00:00.000Z' })
  timestamp!: string;
}
