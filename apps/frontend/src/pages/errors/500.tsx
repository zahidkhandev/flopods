import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home, RefreshCw, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ServerErrorPage() {
  const navigate = useNavigate();

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-2xl text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-8 flex justify-center"
        >
          <div className="relative">
            <h1 className="text-destructive text-9xl font-bold">500</h1>
            <motion.div
              animate={{ rotate: [0, 10, -10, 10, 0] }}
              transition={{ repeat: Infinity, duration: 2, repeatDelay: 1 }}
              className="absolute -top-8 -right-8"
            >
              <AlertTriangle className="text-destructive h-16 w-16" />
            </motion.div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="space-y-4"
        >
          <h2 className="text-foreground text-3xl font-semibold">Internal Server Error</h2>
          <p className="text-muted-foreground text-lg">
            Something went wrong on our end. We&apos;re working to fix it.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <Button onClick={handleRefresh} variant="outline" size="lg">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
          <Button onClick={() => navigate('/dashboard')} size="lg">
            <Home className="mr-2 h-4 w-4" />
            Go to Dashboard
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="mt-12 space-y-4"
        >
          <p className="text-muted-foreground text-sm">
            If this problem persists, please{' '}
            <a href="mailto:support@flopods.com" className="text-primary hover:underline">
              contact our support team
            </a>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
