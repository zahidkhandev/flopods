import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ErrorBoundary } from './components/shared/error-boundary';
import LoginPage from './pages/auth/login';
import RegisterPage from './pages/auth/register';
import AuthCallbackPage from './pages/auth/callback';
import DashboardPage from './pages/dashboard';
import { DashboardLayout } from './layout/dashboard-layout';
import { AuthLayout } from './layout/auth-layout';
import { ProtectedRoute } from './components/shared/protected-route';
import { RootLayout } from './layout/root-layout';

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <ErrorBoundary />,
    children: [
      {
        path: '/',
        element: <Navigate to="/auth/login" replace />,
      },
      {
        path: 'auth',
        element: <AuthLayout />,
        children: [
          {
            path: 'login',
            element: <LoginPage />,
          },
          {
            path: 'register',
            element: <RegisterPage />,
          },
          {
            path: 'callback',
            element: <AuthCallbackPage />,
          },
        ],
      },
      {
        path: 'dashboard',
        element: (
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        ),
        children: [
          {
            index: true,
            element: <DashboardPage />,
          },
        ],
      },
      {
        path: '*',
        element: <ErrorBoundary />,
      },
    ],
  },
]);
