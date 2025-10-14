// pages/errors/OfflinePage.tsx
import { Button } from '@/components/ui/button';
import { RefreshCw, WifiOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { useCallback, useState } from 'react';
import { axiosInstance } from '@/lib/axios-instance';

const OFFLINE_REDIRECT_FLAG = 'offlineRedirectPending';
const PRE_ERROR_PATH = 'preErrorPath';

export default function OfflinePage() {
  const [loading, setLoading] = useState(false);

  const redirectBack = useCallback(() => {
    try {
      const prev = sessionStorage.getItem(PRE_ERROR_PATH) || '/dashboard';
      sessionStorage.removeItem(PRE_ERROR_PATH);
      sessionStorage.removeItem(OFFLINE_REDIRECT_FLAG);
      // Replace so /errors/offline isn't left in history
      window.location.replace(prev);
    } catch {
      window.location.replace('/dashboard');
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      // Call the user endpoint as the connectivity/session probe
      const res = await axiosInstance.get('/users/me');
      // Your backend shape shows statusCode/message/data; just check it responded
      if (res?.status === 200) {
        redirectBack();
        return;
      }
      // If your API wraps with {statusCode:200,...}, you could also check:
      // if ((res.data?.statusCode ?? 200) === 200) redirectBack();
    } catch (err: any) {
      // If unauthorized after recovery, kick to login
      if (err?.response?.status === 401) {
        sessionStorage.removeItem(PRE_ERROR_PATH);
        sessionStorage.removeItem(OFFLINE_REDIRECT_FLAG);
        window.location.replace('/auth/login');
        return;
      }
      // Still offline or other errors — stay on this page
    } finally {
      setLoading(false);
    }
  }, [loading, redirectBack]);

  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-2xl text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-8 flex justify-center"
        >
          <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
            <WifiOff className="text-muted-foreground h-32 w-32" />
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="space-y-4"
        >
          <h2 className="text-foreground text-3xl font-semibold">No Internet Connection</h2>
          <p className="text-muted-foreground text-lg">
            Please check your network connection and try again.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="mt-8"
        >
          <Button onClick={handleRefresh} size="lg" disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {loading ? 'Checking…' : 'Retry Connection'}
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="mt-12"
        >
          <div className="border-border bg-card rounded-lg border p-4">
            <p className="text-muted-foreground text-sm">
              <strong>Troubleshooting tips:</strong>
            </p>
            <ul className="text-muted-foreground mt-2 space-y-1 text-left text-sm">
              <li>• Check if your Wi-Fi or mobile data is turned on</li>
              <li>• Try restarting your router</li>
              <li>• Check if other websites are loading</li>
            </ul>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
