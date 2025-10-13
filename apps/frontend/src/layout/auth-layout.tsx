import { Outlet } from 'react-router-dom';
import { ThemeToggle } from '@/components/shared/theme/theme-toggle';

export function AuthLayout() {
  return (
    <div className="bg-background relative flex min-h-screen items-center justify-center">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Outlet />
    </div>
  );
}
