import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString, ArrayNotEmpty, ArrayMaxSize } from 'class-validator';

export class NotificationMarkReadDto {
  @ApiProperty({
    description: 'Array of notification IDs to mark as read',
    type: [String],
    example: ['cm2abc123', 'cm2def456'],
    minItems: 1,
    maxItems: 50,
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  notificationIds!: string[];
}
