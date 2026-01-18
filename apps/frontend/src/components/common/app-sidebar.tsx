import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useWorkspaces } from '@/hooks/use-workspaces';
import { useAuth } from '@/hooks/use-auth';
import {
  FileText,
  User2,
  LogOut,
  Settings,
  Plus,
  Workflow,
  LayoutDashboard,
  ChevronsUpDown,
  MessagesSquare,
  ChevronDown,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useFlows } from '@/pages/dashboard/flows/hooks/use-flows';
import { usePods } from '@/pages/dashboard/flows/[id]/hooks/use-pods';
import { useState } from 'react';

export function AppSidebar() {
  const { workspaces, currentWorkspace, switchWorkspace, isLoading } = useWorkspaces();
  const { user, logout } = useAuth();
  const location = useLocation();
  const { state, isMobile } = useSidebar();

  const isCollapsedMode = !isMobile && state === 'collapsed';
  const { flows, isLoading: flowsLoading } = useFlows({ limit: 50 });
  const footerNav = [
    { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
    { title: 'Flows', url: '/dashboard/flows', icon: Workflow },
    { title: 'Sources', url: '/dashboard/documents', icon: FileText },
    { title: 'Settings', url: '/dashboard/settings', icon: Settings },
  ];

  return (
    <Sidebar variant="floating" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground hover:bg-sidebar-accent/50"
                >
                  {isLoading ? (
                    <div className="flex w-full items-center gap-2">
                      <Skeleton className="size-8 shrink-0 rounded-lg" />
                      {(state === 'expanded' || isMobile) && (
                        <div className="min-w-0 flex-1">
                          <Skeleton className="mb-1 h-4 w-20" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="bg-sidebar-primary text-sidebar-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg font-semibold">
                        {currentWorkspace?.name?.charAt(0)?.toUpperCase() || 'F'}
                      </div>
                      {(state === 'expanded' || isMobile) && (
                        <>
                          <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-left text-sm leading-tight">
                            <span className="truncate font-semibold">
                              {currentWorkspace?.name || 'Select Workspace'}
                            </span>
                            <span className="text-muted-foreground truncate text-xs">
                              {currentWorkspace?.type || 'No workspace'}
                            </span>
                          </div>
                          <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-50" />
                        </>
                      )}
                    </>
                  )}
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className={cn(
                  'cursor-pointer rounded-lg',
                  isCollapsedMode ? 'w-56' : 'w-(--radix-dropdown-menu-trigger-width)'
                )}
                side={isCollapsedMode ? 'right' : 'bottom'}
                align="start"
                sideOffset={isCollapsedMode ? 8 : 4}
                alignOffset={isCollapsedMode ? -8 : 0}
              >
                <DropdownMenuLabel className="text-muted-foreground text-xs font-medium">
                  Workspaces
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="max-h-75 overflow-y-auto">
                  {workspaces.map((workspace) => (
                    <DropdownMenuItem
                      key={workspace.id}
                      onClick={() => switchWorkspace(workspace.id)}
                      className="cursor-pointer gap-2 p-2"
                    >
                      <div className="bg-background flex size-8 shrink-0 items-center justify-center rounded-md border">
                        <span className="text-sm font-semibold">
                          {workspace.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <div className="no-scrollbar overflow-x-auto text-sm font-medium whitespace-nowrap">
                          {workspace.name}
                        </div>
                        <div className="text-muted-foreground truncate text-xs">
                          {workspace.type} | {workspace.memberCount} members
                        </div>
                      </div>
                      {workspace.id === currentWorkspace?.id && (
                        <Badge
                          variant="secondary"
                          className="ml-auto shrink-0 px-1.5 py-0 text-[10px]"
                        >
                          Active
                        </Badge>
                      )}
                    </DropdownMenuItem>
                  ))}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer gap-2 p-2">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-dashed">
                    <Plus className="size-4" />
                  </div>
                  <div className="text-muted-foreground truncate text-sm font-medium">
                    Create workspace
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="overflow-y-auto">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs">Chats</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {flowsLoading && (
                <div className="space-y-2 px-2">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-3/4" />
                </div>
              )}
              {flows.map((flow) => (
                <FlowChatsNav
                  key={flow.id}
                  flowId={flow.id}
                  name={flow.name}
                  currentPath={location.pathname}
                />
              ))}
              {!flowsLoading && flows.length === 0 && (
                <div className="px-2 py-2 text-xs text-muted-foreground">No chats yet</div>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {footerNav.map((item) => {
            const isActive = location.pathname === item.url;
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                  <Link to={item.url} className="gap-2">
                    <item.icon className="size-4 shrink-0" />
                    <span className="truncate">{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground hover:bg-sidebar-accent/50"
                >
                  <Avatar className="size-8 shrink-0 rounded-lg">
                    <AvatarImage src={user?.image || ''} alt={user?.name || user?.email} />
                    <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground rounded-lg">
                      <User2 className="size-4" />
                    </AvatarFallback>
                  </Avatar>
                  {(state === 'expanded' || isMobile) && (
                    <>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">{user?.name || 'User'}</span>
                        <span className="text-muted-foreground truncate text-xs">
                          {user?.email}
                        </span>
                      </div>
                      <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-50" />
                    </>
                  )}
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className={cn(
                  'rounded-lg',
                  isCollapsedMode ? 'w-56' : 'w-(--radix-dropdown-menu-trigger-width)'
                )}
                side={isCollapsedMode ? 'right' : 'top'}
                align="end"
                sideOffset={isCollapsedMode ? 14 : 4}
                alignOffset={isCollapsedMode ? -8 : 0}
              >
                <DropdownMenuLabel className="p-0 px-2 py-1.5 font-normal">
                  <div className="flex items-center gap-2">
                    <Avatar className="size-8 shrink-0 rounded-lg">
                      <AvatarImage src={user?.image || ''} alt={user?.name || user?.email} />
                      <AvatarFallback className="rounded-lg">
                        <User2 className="size-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-col">
                      <p className="truncate text-sm leading-none font-medium">
                        {user?.name || 'User'}
                      </p>
                      <p className="text-muted-foreground mt-1 truncate text-xs leading-none">
                        {user?.email}
                      </p>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link to="/dashboard/profile">
                    <User2 className="mr-2 size-4 shrink-0" />
                    <span>Profile</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link to="/dashboard/settings">
                    <Settings className="mr-2 size-4 shrink-0" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="text-destructive focus:text-destructive cursor-pointer"
                >
                  <LogOut className="mr-2 size-4 shrink-0" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function FlowChatsNav({
  flowId,
  name,
  currentPath,
}: {
  flowId: string;
  name: string;
  currentPath: string;
}) {
  const [open, setOpen] = useState(false);
  const { data: pods = [], isLoading } = usePods(flowId);
  const toggle = () => setOpen((v) => !v);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton onClick={toggle} className="w-full gap-2 min-w-0">
        <MessagesSquare className="size-4 shrink-0" />
        <span className="truncate">{name}</span>
        <ChevronDown
          className={cn(
            'ml-auto size-4 shrink-0 transition-transform',
            open ? 'rotate-180' : ''
          )}
        />
      </SidebarMenuButton>
      {open && (
        <SidebarMenu className="ml-6 mt-1 space-y-0.5">
          {isLoading && (
            <div className="space-y-2 px-1">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-4/5" />
            </div>
          )}
          {!isLoading && pods.length === 0 && (
            <div className="px-2 py-1 text-[11px] text-muted-foreground">No pods</div>
          )}
          {pods.map((pod) => {
            const href = `/dashboard/chats/${pod.id}`;
            const to = { pathname: href, search: `?flowId=${flowId}` };
            const isActive = currentPath === href;
            return (
              <SidebarMenuItem key={pod.id}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={pod.label || 'Chat'}
                  className="w-full"
                >
                  <Link
                    to={to}
                    state={{ flowId }}
                    className="flex min-w-0 items-center gap-2"
                  >
                    <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-muted-foreground/80" />
                    <span className="truncate text-sm">{pod.label || 'Untitled pod'}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      )}
    </SidebarMenuItem>
  );
}
