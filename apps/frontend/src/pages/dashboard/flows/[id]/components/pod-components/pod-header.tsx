import { memo, ReactNode } from 'react';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PodExecutionIndicator from './pod-execution-indicator';
import { PodExecutionStatus } from '../../types';

interface PodHeaderProps {
  title: string | ReactNode;
  icon: ReactNode;
  status: PodExecutionStatus;
  onConfigure?: () => void;
  onExecute?: () => void;
}

export default memo(function PodHeader({ title, icon, status, onConfigure }: PodHeaderProps) {
  return (
    <div className="border-border/50 flex items-center gap-3 border-b p-4">
      <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        {typeof title === 'string' ? (
          <h3 className="truncate text-sm font-semibold" title={title}>
            {title}
          </h3>
        ) : (
          title
        )}
        <PodExecutionIndicator status={status} className="mt-1" />
      </div>

      {onConfigure && (
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 shrink-0 p-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onConfigure();
          }}
          aria-label="Configure pod"
        >
          <Settings className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
});
