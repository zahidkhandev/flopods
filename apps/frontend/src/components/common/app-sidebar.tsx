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
  FolderOpen,
  Database,
  User2,
  LogOut,
  Settings,
  Plus,
  Workflow,
  LayoutDashboard,
  ChevronsUpDown,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const navData = [
  {
    title: 'Overview',
    items: [
      { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
      { title: 'Flows', url: '/dashboard/flows', icon: Workflow },
    ],
  },
  {
    title: 'Resources',
    items: [
      { title: 'Spaces', url: '/dashboard/spaces', icon: FolderOpen },
      { title: 'Documents', url: '/dashboard/documents', icon: FileText },
      { title: 'Sources', url: '/dashboard/sources', icon: Database },
    ],
  },
  {
    title: 'Workspace',
    items: [{ title: 'Settings', url: '/dashboard/settings', icon: Settings }],
  },
];

export function AppSidebar() {
  const { workspaces, currentWorkspace, switchWorkspace, isLoading } = useWorkspaces();
  const { user, logout } = useAuth();
  const location = useLocation();
  const { state, isMobile } = useSidebar();

  // Determine if we should use "collapsed" behavior
  const isCollapsedMode = !isMobile && state === 'collapsed';

  return (
    <Sidebar variant="floating" collapsible="icon">
      {/* ==================== HEADER: WORKSPACE SELECTOR ==================== */}
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
                  isCollapsedMode ? 'w-56' : 'w-[var(--radix-dropdown-menu-trigger-width)]'
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
                <div className="max-h-[300px] overflow-y-auto">
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
                          {workspace.type} • {workspace.memberCount} members
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

      {/* ==================== NAVIGATION MENU ==================== */}
      <SidebarContent className="overflow-y-auto">
        {navData.map((section) => (
          <SidebarGroup key={section.title}>
            <SidebarGroupLabel className="text-xs">{section.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {section.items.map((item) => {
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
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* ==================== FOOTER: USER MENU ==================== */}
      <SidebarFooter>
        <SidebarMenu>
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
                  isCollapsedMode ? 'w-56' : 'w-[var(--radix-dropdown-menu-trigger-width)]'
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
