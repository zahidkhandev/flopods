import { ApiProperty } from '@nestjs/swagger';

export class NotificationCountResponseDto {
  @ApiProperty({
    description: 'Number of notifications affected',
    example: 5,
  })
  count!: number;

  @ApiProperty({
    description: 'Success message',
    example: 'Successfully marked 5 notifications as read',
  })
  message!: string;
}
