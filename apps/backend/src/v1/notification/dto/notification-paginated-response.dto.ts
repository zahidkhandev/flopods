import { ApiProperty } from '@nestjs/swagger';
import { NotificationResponseDto } from './notification-response.dto';

/**
 * Compatible with your ResponseInterceptor's pagination format
 */
export class NotificationPaginationDto {
  @ApiProperty({
    description: 'Total number of items',
    example: 45,
  })
  totalItems!: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 3,
  })
  totalPages!: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  currentPage!: number;

  @ApiProperty({
    description: 'Number of items in current page',
    example: 20,
  })
  pageSize!: number;
}

export class NotificationPaginatedResponseDto {
  @ApiProperty({
    description: 'Array of notifications',
    type: [NotificationResponseDto],
  })
  data!: NotificationResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: NotificationPaginationDto,
  })
  pagination!: NotificationPaginationDto;

  @ApiProperty({
    description: 'Number of unread notifications',
    example: 12,
  })
  unreadCount!: number;
}
