import { useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/lib/toast-utils';
import { axiosInstance } from '@/lib/axios-instance';
import { AuthContext, AuthContextType } from './auth-context';
import { User, LoginData, RegisterData, LoginResponse, UserMeResponse } from '@/types/auth';
import { getAuthTokens, setAuthTokens, clearAuthTokens, setDeviceName } from '@/utils/token-utils';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchUser = useCallback(async () => {
    const tokens = getAuthTokens();
    if (!tokens?.accessToken) {
      setLoading(false);
      return;
    }

    try {
      const response = await axiosInstance.get<UserMeResponse>('/users/me', {
        showErrorToast: false, // Disable error toast on initial load
      } as any);

      setUser({
        userId: response.data.data.userId,
        email: response.data.data.email,
        name: response.data.data.name,
        image: response.data.data.image,
        createdAt: response.data.data.createdAt,
        updatedAt: response.data.data.updatedAt,
      });
    } catch (error: any) {
      console.error('Failed to fetch user:', error);

      // Only clear tokens if it's actually a 401 (not network error)
      if (error.response?.status === 401) {
        clearAuthTokens();
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const getRedirectPath = () => {
    // Check sessionStorage first
    const pendingInvitation = sessionStorage.getItem('pendingInvitation');
    if (pendingInvitation) {
      sessionStorage.removeItem('pendingInvitation');
      return `/workspace/invite/${pendingInvitation}`;
    }

    // Check URL params
    const urlParams = new URLSearchParams(window.location.search);
    const returnUrl = urlParams.get('returnUrl');
    if (returnUrl) {
      return decodeURIComponent(returnUrl);
    }

    // Default
    return '/dashboard';
  };

  const login = async (data: LoginData) => {
    try {
      const response = await axiosInstance.post<LoginResponse>('/auth/login', {
        email: data.email,
        password: data.password,
      });

      const responseData = response.data.data;

      setAuthTokens({
        accessToken: responseData.accessToken,
        refreshToken: responseData.refreshToken,
        deviceId: responseData.deviceId,
      });

      setDeviceName(responseData.deviceName);

      await fetchUser();

      toast.success('Logged in successfully');

      // Use the helper function
      const redirectPath = getRedirectPath();
      navigate(redirectPath);
    } catch (error: any) {
      const message = error.response?.data?.message || 'Login failed';
      toast.error(message);
      throw error;
    }
  };

  const register = async (data: RegisterData) => {
    try {
      const response = await axiosInstance.post<LoginResponse>('/auth/register', {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
      });

      const responseData = response.data.data;

      setAuthTokens({
        accessToken: responseData.accessToken,
        refreshToken: responseData.refreshToken,
        deviceId: responseData.deviceId,
      });

      setDeviceName(responseData.deviceName);

      await fetchUser();

      toast.success('Account created successfully');

      // Use the helper function
      const redirectPath = getRedirectPath();
      navigate(redirectPath);
    } catch (error: any) {
      const message = error.response?.data?.message || 'Registration failed';
      toast.error(message);
      throw error;
    }
  };

  const logout = async () => {
    try {
      const tokens = getAuthTokens();
      if (tokens?.deviceId) {
        await axiosInstance.post('/auth/logout', { deviceId: tokens.deviceId });
      }
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      clearAuthTokens();
      setUser(null);
      navigate('/auth/login');
    }
  };

  const isAuthenticated = useMemo(() => !!user, [user]);
  const isLoading = loading;

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated,
    isLoading,
    login,
    logout,
    register,
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
