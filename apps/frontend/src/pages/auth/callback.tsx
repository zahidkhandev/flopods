import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from '@/lib/toast-utils';
import { setAuthTokens, setDeviceName } from '@/utils/token-utils';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';

export default function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setUser } = useAuth();

  useEffect(() => {
    const handleCallback = async () => {
      const accessToken = searchParams.get('accessToken');
      const refreshToken = searchParams.get('refreshToken');
      const userId = searchParams.get('userId');
      const deviceId = searchParams.get('deviceId');
      const deviceName = searchParams.get('deviceName');
      const error = searchParams.get('error');

      if (error) {
        toast.error(`Authentication failed: ${error}`);
        navigate('/auth/login');
        return;
      }

      if (!accessToken || !refreshToken || !userId || !deviceId) {
        toast.error('Invalid authentication response');
        navigate('/auth/login');
        return;
      }

      try {
        // Save tokens to encrypted cookies
        setAuthTokens({
          accessToken,
          refreshToken,
          deviceId,
        });

        // Save device name if provided
        if (deviceName) {
          setDeviceName(deviceName);
        }

        // Fetch user data
        const { axiosInstance } = await import('@/lib/axios-instance');
        const response = await axiosInstance.get('/users/me');

        setUser(response.data.data);

        toast.success('Logged in successfully!');
        navigate('/dashboard');
      } catch (error) {
        console.error('OAuth callback error:', error);
        toast.error('Failed to complete authentication');
        navigate('/auth/login');
      }
    };

    handleCallback();
  }, [searchParams, navigate, setUser]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <Loader2 className="text-primary mx-auto h-8 w-8 animate-spin" />
        <p className="text-muted-foreground mt-4 text-sm">Completing sign in...</p>
      </div>
    </div>
  );
}
