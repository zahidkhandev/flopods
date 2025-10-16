import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { V1NotificationService } from './notification.service';
import { GetCurrentUserId } from '../../common/decorators/user';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { NotificationMarkReadDto } from './dto/notification-mark-read.dto';
import { NotificationPaginatedResponseDto } from './dto/notification-paginated-response.dto';
import { NotificationUnreadCountResponseDto } from './dto/notification-unread-count-response.dto';
import { NotificationCountResponseDto } from './dto/notification-count-response.dto';

@ApiTags('Notifications')
@ApiBearerAuth('JWT')
@Controller({
  path: 'notifications',
  version: '1',
})
@ApiUnauthorizedResponse({
  description: 'Unauthorized - Invalid or missing JWT token',
})
@ApiInternalServerErrorResponse({
  description: 'Internal server error',
})
export class V1NotificationController {
  constructor(private readonly notificationService: V1NotificationService) {}

  @Get()
  @ApiOperation({
    summary: 'Get user notifications',
    description:
      'Retrieve a paginated list of notifications for the authenticated user. ' +
      'Supports filtering by read status and notification type. ' +
      'Automatically excludes expired notifications.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully retrieved notifications',
    type: NotificationPaginatedResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid query parameters',
  })
  async getNotifications(
    @GetCurrentUserId() userId: string,
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: NotificationQueryDto,
  ): Promise<NotificationPaginatedResponseDto> {
    return this.notificationService.getUserNotifications(userId, query);
  }

  @Get('unread-count')
  @ApiOperation({
    summary: 'Get unread notification count',
    description: 'Get the total count of unread notifications for the authenticated user.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully retrieved unread count',
    type: NotificationUnreadCountResponseDto,
  })
  async getUnreadCount(
    @GetCurrentUserId() userId: string,
  ): Promise<NotificationUnreadCountResponseDto> {
    const count = await this.notificationService.getUnreadCount(userId);
    return { count };
  }

  // ✅ REMOVED ParseUUIDPipe - CUID IDs are not UUIDs
  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Mark notification as read',
    description:
      'Mark a single notification as read. The notification must belong to the authenticated user.',
  })
  @ApiParam({
    name: 'id',
    description: 'Notification ID (CUID format)',
    example: 'cm2abc123xyz',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Notification successfully marked as read',
  })
  @ApiNotFoundResponse({
    description: 'Notification not found or does not belong to user',
  })
  async markAsRead(
    @Param('id') notificationId: string,
    @GetCurrentUserId() userId: string,
  ): Promise<void> {
    await this.notificationService.markAsRead(notificationId, userId);
  }

  @Patch('read-many')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark multiple notifications as read',
    description:
      'Mark multiple notifications as read in a single batch operation. Maximum 50 notification IDs per request.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully marked notifications as read',
    type: NotificationCountResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid request body or too many IDs',
  })
  async markManyAsRead(
    @Body(ValidationPipe) dto: NotificationMarkReadDto,
    @GetCurrentUserId() userId: string,
  ): Promise<NotificationCountResponseDto> {
    const count = await this.notificationService.markManyAsRead(dto.notificationIds, userId);
    return {
      count,
      message: `Successfully marked ${count} notification${count !== 1 ? 's' : ''} as read`,
    };
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark all notifications as read',
    description: 'Mark all unread notifications as read for the authenticated user.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully marked all notifications as read',
    type: NotificationCountResponseDto,
  })
  async markAllAsRead(@GetCurrentUserId() userId: string): Promise<NotificationCountResponseDto> {
    const count = await this.notificationService.markAllAsRead(userId);
    return {
      count,
      message: `Successfully marked ${count} notification${count !== 1 ? 's' : ''} as read`,
    };
  }

  // ✅ REMOVED ParseUUIDPipe
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete notification',
    description:
      'Permanently delete a notification. The notification must belong to the authenticated user.',
  })
  @ApiParam({
    name: 'id',
    description: 'Notification ID (CUID format)',
    example: 'cm2abc123xyz',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Notification successfully deleted',
  })
  @ApiNotFoundResponse({
    description: 'Notification not found or does not belong to user',
  })
  async deleteNotification(
    @Param('id') notificationId: string,
    @GetCurrentUserId() userId: string,
  ): Promise<void> {
    await this.notificationService.deleteNotification(notificationId, userId);
  }

  @Delete('read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete all read notifications',
    description: 'Delete all read notifications for the authenticated user.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully deleted read notifications',
    type: NotificationCountResponseDto,
  })
  async deleteAllRead(@GetCurrentUserId() userId: string): Promise<NotificationCountResponseDto> {
    const count = await this.notificationService.deleteAllRead(userId);
    return {
      count,
      message: `Successfully deleted ${count} notification${count !== 1 ? 's' : ''}`,
    };
  }
}
