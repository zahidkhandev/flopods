// layout/auth-layout.tsx
import { Navigate, Outlet } from 'react-router-dom';
import { ThemeToggle } from '@/components/shared/theme/theme-toggle';
import { useAuth } from '@/hooks/use-auth';

export function AuthLayout() {
  const { user, loading } = useAuth();

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
      </div>
    );
  }

  // If already logged in, redirect to dashboard
  if (user) {
    console.log('[AuthLayout] User already logged in, redirecting to dashboard');
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="bg-background relative flex min-h-screen items-center justify-center">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Outlet />
    </div>
  );
}
