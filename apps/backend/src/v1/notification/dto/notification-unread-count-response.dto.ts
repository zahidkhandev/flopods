import { ApiProperty } from '@nestjs/swagger';

export class NotificationUnreadCountResponseDto {
  @ApiProperty({
    description: 'Number of unread notifications',
    example: 12,
  })
  count!: number;
}
