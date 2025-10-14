import { Button } from '@/components/ui/button';
import { RefreshCw, Wrench } from 'lucide-react';
import { motion } from 'framer-motion';

export default function MaintenancePage() {
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
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
          >
            <Wrench className="text-primary h-32 w-32" />
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="space-y-4"
        >
          <h2 className="text-foreground text-3xl font-semibold">Under Maintenance</h2>
          <p className="text-muted-foreground text-lg">
            We&apos;re currently performing scheduled maintenance. We&apos;ll be back soon!
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="mt-8"
        >
          <Button onClick={handleRefresh} size="lg">
            <RefreshCw className="mr-2 h-4 w-4" />
            Check Status
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="mt-12"
        >
          <div className="border-border bg-card rounded-lg border p-6">
            <p className="text-muted-foreground text-sm">
              Expected downtime: <strong>30 minutes</strong>
            </p>
            <p className="text-muted-foreground mt-2 text-xs">
              Follow us on{' '}
              <a href="https://twitter.com/flopods" className="text-primary hover:underline">
                Twitter
              </a>{' '}
              for live updates
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
