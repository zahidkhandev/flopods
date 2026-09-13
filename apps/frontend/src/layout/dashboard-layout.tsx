// layouts/dashboard-layout.tsx
import { Outlet, useLocation, Link } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { ThemeToggle } from '@/components/shared/theme/theme-toggle';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { AppSidebar } from '@/components/common/app-sidebar';
import { NotificationsDropdown } from '@/components/common/notifications/notifications-dropdown';
import { useBreadcrumbs } from '@/hooks/use-breadcrumbs';
import { Button } from '@/components/ui/button';
import { Users } from 'lucide-react';

export function DashboardLayout() {
  const location = useLocation();
  const { customBreadcrumbs } = useBreadcrumbs();

  const generateBreadcrumbs = () => {
    const pathnames = location.pathname.split('/').filter((x) => x);

    return pathnames.map((value, index) => {
      const to = `/${pathnames.slice(0, index + 1).join('/')}`;
      const isLast = index === pathnames.length - 1;

      const label = value
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      return {
        label,
        to,
        isLast,
      };
    });
  };

  const breadcrumbs = customBreadcrumbs || generateBreadcrumbs();
  const isFlowEditor = location.pathname.match(/^\/dashboard\/flows\/[^/]+$/);
  const isChatPage = location.pathname.match(/^\/dashboard\/chats\/[^/]+$/);
  const isFullScreen = isFlowEditor || isChatPage;

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex flex-col overflow-hidden">
        <header className="bg-background sticky top-0 z-10 flex h-16 shrink-0 items-center gap-4 border-b px-4 sm:px-6">
          <SidebarTrigger className="-ml-1 translate-y-px cursor-pointer" />
          <Breadcrumb className="hidden sm:block">
            <BreadcrumbList className="gap-2">
              {breadcrumbs.map((crumb, index) => (
                <div key={crumb.to} className="flex items-center gap-2">
                  {index > 0 && <BreadcrumbSeparator className="mx-0 translate-y-0.5" />}
                  <BreadcrumbItem>
                    {crumb.isLast ? (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link to={crumb.to}>{crumb.label}</Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </div>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto flex items-center gap-2">
            {isFlowEditor && (
              <Button variant="ghost" size="icon">
                <Users className="h-4 w-4" />
              </Button>
            )}
            <NotificationsDropdown />
            <ThemeToggle />
          </div>
        </header>
        <main
          className={
            isFullScreen
              ? 'relative flex-1 overflow-hidden'
              : 'flex flex-1 flex-col gap-4 p-4 md:p-6'
          }
        >
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
