import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ErrorBoundary } from './components/shared/error-boundary';
import LoginPage from './pages/auth/login';
import RegisterPage from './pages/auth/register';
import AuthCallbackPage from './pages/auth/callback';
import DashboardPage from './pages/dashboard';
import WorkspaceSettingsPage from './pages/dashboard/settings';
import { DashboardLayout } from './layout/dashboard-layout';
import { AuthLayout } from './layout/auth-layout';
import { ProtectedRoute } from './components/shared/protected-route';
import { RootLayout } from './layout/root-layout';

// Error Pages
import NotFoundPage from './pages/errors/404';
import ServerErrorPage from './pages/errors/500';
import ForbiddenPage from './pages/errors/403';
import OfflinePage from './pages/errors/offline';
import MaintenancePage from './pages/errors/maintenance';
import AcceptInvitationPage from './pages/workspace/invite';
import FlowsPage from './pages/dashboard/flows';

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
        path: 'workspace/invite/:token',
        element: <AcceptInvitationPage />,
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
          {
            path: 'settings',
            element: <WorkspaceSettingsPage />,
          },

          {
            path: 'flows',
            element: <FlowsPage />,
          },
          {
            path: 'spaces',
            element: <div>Spaces Page (Coming Soon)</div>,
          },
          {
            path: 'documents',
            element: <div>Documents Page (Coming Soon)</div>,
          },
          {
            path: 'sources',
            element: <div>Sources Page (Coming Soon)</div>,
          },
          {
            path: 'api-keys',
            element: <div>API Keys Page (Coming Soon)</div>,
          },
          {
            path: 'profile',
            element: <div>Profile Page (Coming Soon)</div>,
          },
        ],
      },
      // Error Pages
      {
        path: 'errors',
        children: [
          {
            path: '404',
            element: <NotFoundPage />,
          },
          {
            path: '500',
            element: <ServerErrorPage />,
          },
          {
            path: '403',
            element: <ForbiddenPage />,
          },
          {
            path: 'offline',
            element: <OfflinePage />,
          },
          {
            path: 'maintenance',
            element: <MaintenancePage />,
          },
        ],
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
]);
