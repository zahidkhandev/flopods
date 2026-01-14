import { useState, useEffect, useCallback } from 'react';
import { axiosInstance } from '@/lib/axios-instance';
import { toast } from '@/lib/toast-utils';
import { useNotificationSocket } from './use-notification-socket';

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  actionUrl?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, any>;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const fetchNotifications = useCallback(async (page = 1, append = false) => {
    try {
      setIsLoading(true);
      const response = await axiosInstance.get('/notifications', {
        params: { page, limit: 10 },
      });

      const responseData = response.data?.data || response.data;
      const newNotifications = Array.isArray(responseData) ? responseData : responseData.data || [];
      const pagination = responseData.pagination || {
        totalPages: 1,
        currentPage: 1,
      };
      const unread = responseData.unreadCount || 0;

      if (append) {
        setNotifications((prev) => [...prev, ...newNotifications]);
      } else {
        setNotifications(newNotifications);
      }

      setUnreadCount(unread);
      setCurrentPage(pagination.currentPage);
      setTotalPages(pagination.totalPages);
      setHasMore(pagination.currentPage < pagination.totalPages);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle real-time new notification
  const handleNewNotification = useCallback((notification: Notification) => {
    setNotifications((prev) => {
      // Prevent duplicates
      if (prev.some((n) => n.id === notification.id)) {
        return prev;
      }
      return [notification, ...prev];
    });
    setUnreadCount((prev) => prev + 1);
  }, []);

  // Handle real-time unread count update
  const handleUnreadCountUpdate = useCallback((count: number) => {
    setUnreadCount(count);
  }, []);

  // Connect to WebSocket (no return value needed)
  useNotificationSocket(handleNewNotification, handleUnreadCountUpdate);

  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      fetchNotifications(currentPage + 1, true);
    }
  }, [currentPage, hasMore, isLoading, fetchNotifications]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await axiosInstance.patch(`/notifications/${notificationId}/read`);

      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
      );
      // WebSocket will handle unread count update
    } catch (error) {
      console.error('Failed to mark as read:', error);
      toast.error('Failed to mark as read');
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await axiosInstance.patch('/notifications/read-all');

      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      toast.error('Failed to mark all as read');
    }
  }, []);

  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      await axiosInstance.delete(`/notifications/${notificationId}`);

      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      toast.success('Notification deleted');
    } catch (error) {
      console.error('Failed to delete notification:', error);
      toast.error('Failed to delete notification');
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return {
    notifications,
    unreadCount,
    isLoading,
    hasMore,
    totalPages,
    fetchNotifications,
    loadMore,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  };
}
