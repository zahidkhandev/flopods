import { Outlet } from 'react-router-dom';
import { AuthProvider } from '@/context/auth-provider';

export function RootLayout() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}
