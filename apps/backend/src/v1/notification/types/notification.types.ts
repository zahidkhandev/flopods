import { NotificationType } from '@flopods/schema';

export interface NotificationResponse {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, any> | null;
  isRead: boolean;
  readAt?: Date | null;
  actionUrl?: string | null;
  createdAt: Date;
  expiresAt?: Date | null;
}

export interface NotificationListResponse {
  notifications: NotificationResponse[];
  unreadCount: number;
  total: number;
}

export interface UnreadCountResponse {
  count: number;
}

export type NotificationCreateInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, any>;
  actionUrl?: string;
  expiresAt?: Date;
};
