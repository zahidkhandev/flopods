import { Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { ThemeToggle } from '@/components/shared/theme/theme-toggle';
import { Button } from '@/components/ui/button';
import { LogOut, User as UserIcon } from 'lucide-react';

export function DashboardLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="bg-background min-h-screen">
      <header className="border-border border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">Actopod</h1>
          </div>

          <div className="flex items-center gap-4">
            {/* User Info */}
            <div className="flex items-center gap-2 text-sm">
              {user?.image ? (
                <img
                  src={user.image}
                  alt={user.name || user.email}
                  className="h-8 w-8 rounded-full"
                />
              ) : (
                <div className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-full">
                  <UserIcon className="h-4 w-4" />
                </div>
              )}
              <div className="hidden md:block">
                <p className="font-medium">{user?.name || 'User'}</p>
                <p className="text-muted-foreground text-xs">{user?.email}</p>
              </div>
            </div>

            <ThemeToggle />

            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4">
        <Outlet />
      </main>
    </div>
  );
}
