import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, CheckCheck, Trash2, Loader2, Inbox, Mail, Users, Settings } from 'lucide-react';
import { useNotifications } from '@/hooks/notifications/use-notifications';
import { useWorkspaces } from '@/hooks/use-workspaces';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

const notificationIcons: Record<string, any> = {
  WORKSPACE_INVITATION: Mail,
  WORKSPACE_MEMBER_JOINED: Users,
  WORKSPACE_UPDATED: Settings,
  default: Bell,
};

export function NotificationsDropdown() {
  const navigate = useNavigate();
  const { switchWorkspace } = useWorkspaces();
  const [open, setOpen] = useState(false);

  const {
    notifications,
    unreadCount,
    isLoading,
    hasMore,
    loadMore,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  const handleNotificationClick = async (notification: any) => {
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }

    if (notification.actionUrl) {
      setOpen(false);

      const metadata = notification.metadata || {};

      if (notification.actionUrl.includes('/workspace/invite/')) {
        navigate(notification.actionUrl);
      } else if (metadata.workspaceId) {
        switchWorkspace(metadata.workspaceId);

        if (notification.actionUrl.includes('/members')) {
          navigate('/dashboard/settings?tab=members');
        } else if (notification.actionUrl.includes('/settings')) {
          navigate('/dashboard/settings');
        } else {
          navigate('/dashboard');
        }
      } else {
        navigate(notification.actionUrl);
      }
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="h-4 w-4" />

          {unreadCount > 0 && (
            <Badge
              className="border-background absolute -top-1 -right-1 flex h-5 min-w-5 animate-pulse items-center justify-center rounded-full border-2 p-0 text-xs"
              style={{
                backgroundColor: 'hsl(var(--primary))',
                color: 'hsl(var(--primary-foreground))',
              }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[380px] p-0 sm:w-[420px]" sideOffset={8}>
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <h3 className="font-semibold">Notifications</h3>
            <p className="text-muted-foreground text-xs">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </p>
          </div>
          {notifications.length > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead} disabled={unreadCount === 0}>
              <CheckCheck className="mr-2 h-4 w-4" />
              Mark all read
            </Button>
          )}
        </div>

        <ScrollArea className="h-[400px]">
          {isLoading && notifications.length === 0 ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center text-center">
              <Inbox className="text-muted-foreground mb-2 h-8 w-8" />
              <p className="text-sm font-medium">No notifications</p>
              <p className="text-muted-foreground text-xs">You&apos;re all caught up!</p>
            </div>
          ) : (
            <>
              {notifications.map((notification, index) => {
                const Icon = notificationIcons[notification.type] || notificationIcons.default;

                return (
                  <div key={notification.id}>
                    <div
                      onClick={() => handleNotificationClick(notification)}
                      className={cn(
                        'group hover:bg-accent flex cursor-pointer items-start gap-3 p-4 transition-colors',
                        !notification.isRead && 'bg-muted/50'
                      )}
                    >
                      <div
                        className={cn(
                          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                          notification.isRead ? 'bg-muted' : 'bg-primary/10'
                        )}
                      >
                        <Icon
                          className={cn(
                            'h-4 w-4',
                            notification.isRead ? 'text-muted-foreground' : 'text-primary'
                          )}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={cn(
                              'text-sm font-medium',
                              !notification.isRead && 'font-semibold'
                            )}
                          >
                            {notification.title}
                          </p>
                          {!notification.isRead && (
                            <div className="bg-primary h-2 w-2 shrink-0 rounded-full" />
                          )}
                        </div>
                        <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                          {notification.body}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <p className="text-muted-foreground text-xs">
                            {formatDistanceToNow(new Date(notification.createdAt), {
                              addSuffix: true,
                            })}
                          </p>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notification.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {index < notifications.length - 1 && <Separator />}
                  </div>
                );
              })}

              {hasMore && (
                <div className="border-t p-3">
                  <Button
                    variant="ghost"
                    className="w-full"
                    size="sm"
                    onClick={loadMore}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      'Load more'
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </ScrollArea>

        {notifications.length > 0 && (
          <>
            <Separator />
            <div className="p-2">
              <Button
                variant="ghost"
                className="w-full justify-start"
                size="sm"
                onClick={() => {
                  setOpen(false);
                  navigate('/dashboard/notifications');
                }}
              >
                View all notifications
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
