import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationType, Notification, Prisma } from '@flopods/schema';
import { V1NotificationGateway } from './notification.gateway';
import { NotificationQueryDto } from './dto/notification-query.dto';
import {
  NotificationPaginatedResponseDto,
  NotificationPaginationDto,
} from './dto/notification-paginated-response.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { plainToInstance } from 'class-transformer';

/**
 * Production-Grade Notification Service
 * Features:
 * - Real-time WebSocket notifications
 * - Pagination support compatible with ResponseInterceptor
 * - Type-safe operations
 * - Comprehensive error handling
 * - Automatic cleanup of expired notifications
 * - Batch operations for performance
 * - Non-blocking WebSocket delivery
 */
@Injectable()
export class V1NotificationService {
  private readonly logger = new Logger(V1NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationGateway: V1NotificationGateway,
  ) {}

  /**
   * Create a new notification with real-time delivery
   */
  async createNotification(data: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, any>;
    actionUrl?: string;
    expiresAt?: Date;
  }): Promise<Notification> {
    try {
      const notification = await this.prisma.notification.create({
        data: {
          userId: data.userId,
          type: data.type,
          title: data.title,
          body: data.body,
          entityType: data.entityType,
          entityId: data.entityId,
          metadata: data.metadata as any,
          actionUrl: data.actionUrl,
          expiresAt: data.expiresAt,
        },
      });

      this.logger.log(
        `Notification created: ${notification.id} for user ${data.userId} (type: ${data.type})`,
      );

      // Send real-time notification (non-blocking)
      setImmediate(async () => {
        try {
          if (this.notificationGateway.isUserConnected(data.userId)) {
            this.notificationGateway.sendNotificationToUser(data.userId, notification);

            const unreadCount = await this.getUnreadCount(data.userId);
            this.notificationGateway.sendUnreadCountUpdate(data.userId, unreadCount);

            this.logger.debug(`Real-time notification sent to user ${data.userId}`);
          }
        } catch (wsError) {
          this.logger.warn(
            `WebSocket delivery failed for notification ${notification.id}`,
            wsError,
          );
        }
      });

      return notification;
    } catch (error) {
      this.logger.error(`Failed to create notification for user ${data.userId}`, error);
      throw new InternalServerErrorException('Failed to create notification');
    }
  }

  /**
   * Get paginated notifications with real-time metadata
   */
  async getUserNotifications(
    userId: string,
    query: NotificationQueryDto,
  ): Promise<NotificationPaginatedResponseDto> {
    try {
      const where: Prisma.NotificationWhereInput = {
        userId,
        ...(query.unreadOnly && { isRead: false }),
        ...(query.type && { type: query.type }),
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      };

      const [notifications, totalItems, unreadCount] = await Promise.all([
        this.prisma.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: query.skip,
          take: query.limit,
        }),
        this.prisma.notification.count({ where }),
        this.prisma.notification.count({
          where: {
            userId,
            isRead: false,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
        }),
      ]);

      const totalPages = Math.ceil(totalItems / query.limit);

      const pagination: NotificationPaginationDto = {
        totalItems,
        totalPages,
        currentPage: query.page,
        pageSize: notifications.length,
      };

      const data = plainToInstance(NotificationResponseDto, notifications, {
        excludeExtraneousValues: true,
      });

      return {
        data,
        pagination,
        unreadCount,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch notifications for user ${userId}`, error);
      throw new InternalServerErrorException('Failed to fetch notifications');
    }
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      return await this.prisma.notification.count({
        where: {
          userId,
          isRead: false,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      });
    } catch (error) {
      this.logger.error(`Failed to get unread count for user ${userId}`, error);
      throw new InternalServerErrorException('Failed to get unread count');
    }
  }

  /**
   * Mark notification as read with real-time update
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    try {
      const result = await this.prisma.notification.updateMany({
        where: { id: notificationId, userId },
        data: { isRead: true, readAt: new Date() },
      });

      if (result.count === 0) {
        throw new NotFoundException('Notification not found');
      }

      // Update unread count in real-time
      setImmediate(async () => {
        try {
          if (this.notificationGateway.isUserConnected(userId)) {
            const unreadCount = await this.getUnreadCount(userId);
            this.notificationGateway.sendUnreadCountUpdate(userId, unreadCount);
          }
        } catch (wsError) {
          this.logger.warn('WebSocket update failed for markAsRead', wsError);
        }
      });

      this.logger.debug(`Notification ${notificationId} marked as read by user ${userId}`);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to mark notification ${notificationId} as read`, error);
      throw new InternalServerErrorException('Failed to mark notification as read');
    }
  }

  /**
   * Mark multiple notifications as read with real-time update
   */
  async markManyAsRead(notificationIds: string[], userId: string): Promise<number> {
    try {
      if (!notificationIds || notificationIds.length === 0) {
        throw new BadRequestException('No notification IDs provided');
      }

      const result = await this.prisma.notification.updateMany({
        where: {
          id: { in: notificationIds },
          userId,
        },
        data: { isRead: true, readAt: new Date() },
      });

      // Update unread count in real-time
      setImmediate(async () => {
        try {
          if (this.notificationGateway.isUserConnected(userId)) {
            const unreadCount = await this.getUnreadCount(userId);
            this.notificationGateway.sendUnreadCountUpdate(userId, unreadCount);
          }
        } catch (wsError) {
          this.logger.warn('WebSocket update failed for markManyAsRead', wsError);
        }
      });

      this.logger.log(`Marked ${result.count} notifications as read for user ${userId}`);

      return result.count;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Failed to mark multiple notifications as read`, error);
      throw new InternalServerErrorException('Failed to mark notifications as read');
    }
  }

  /**
   * Mark all notifications as read with real-time update
   */
  async markAllAsRead(userId: string): Promise<number> {
    try {
      const result = await this.prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true, readAt: new Date() },
      });

      // Update unread count in real-time
      setImmediate(async () => {
        try {
          if (this.notificationGateway.isUserConnected(userId)) {
            this.notificationGateway.sendUnreadCountUpdate(userId, 0);
          }
        } catch (wsError) {
          this.logger.warn('WebSocket update failed for markAllAsRead', wsError);
        }
      });

      this.logger.log(`Marked all ${result.count} notifications as read for user ${userId}`);

      return result.count;
    } catch (error) {
      this.logger.error(`Failed to mark all notifications as read for user ${userId}`, error);
      throw new InternalServerErrorException('Failed to mark all notifications as read');
    }
  }

  /**
   * Delete notification with real-time update
   */
  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    try {
      // Check if notification is unread before deleting
      const notification = await this.prisma.notification.findFirst({
        where: { id: notificationId, userId },
        select: { isRead: true },
      });

      const result = await this.prisma.notification.deleteMany({
        where: { id: notificationId, userId },
      });

      if (result.count === 0) {
        throw new NotFoundException('Notification not found');
      }

      // Update unread count if deleted notification was unread
      if (notification && !notification.isRead) {
        setImmediate(async () => {
          try {
            if (this.notificationGateway.isUserConnected(userId)) {
              const unreadCount = await this.getUnreadCount(userId);
              this.notificationGateway.sendUnreadCountUpdate(userId, unreadCount);
            }
          } catch (wsError) {
            this.logger.warn('WebSocket update failed for deleteNotification', wsError);
          }
        });
      }

      this.logger.debug(`Notification ${notificationId} deleted by user ${userId}`);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to delete notification ${notificationId}`, error);
      throw new InternalServerErrorException('Failed to delete notification');
    }
  }

  /**
   * Delete all read notifications
   */
  async deleteAllRead(userId: string): Promise<number> {
    try {
      const result = await this.prisma.notification.deleteMany({
        where: { userId, isRead: true },
      });

      this.logger.log(`Deleted ${result.count} read notifications for user ${userId}`);

      return result.count;
    } catch (error) {
      this.logger.error(`Failed to delete read notifications for user ${userId}`, error);
      throw new InternalServerErrorException('Failed to delete read notifications');
    }
  }

  /**
   * Cleanup expired notifications (CRON job)
   */
  async cleanupExpiredNotifications(): Promise<number> {
    try {
      const result = await this.prisma.notification.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });

      this.logger.log(`Cleaned up ${result.count} expired notifications`);

      return result.count;
    } catch (error) {
      this.logger.error('Failed to cleanup expired notifications', error);
      throw new InternalServerErrorException('Failed to cleanup expired notifications');
    }
  }
}
