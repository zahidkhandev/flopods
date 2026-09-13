import { memo, ReactNode } from 'react';
import { Settings, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PodExecutionIndicator from './pod-execution-indicator';
import { PodExecutionStatus } from '../../types';
import { useCanvas } from '../../context/canvas-context';

interface PodHeaderProps {
  id: string; // ID is now required
  title: string | ReactNode;
  icon: ReactNode;
  status: PodExecutionStatus;
  onConfigure?: () => void;
}

export default memo(function PodHeader({ id, title, icon, status, onConfigure }: PodHeaderProps) {
  const { deleteNode } = useCanvas();

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    // In a real app, you might want a confirmation dialog here
    deleteNode(id);
  };

  return (
    <div className="border-border/50 group/header flex items-center gap-3 border-b p-4">
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

      <div className="flex items-center gap-1 opacity-0 transition-opacity duration-200 group-hover/header:opacity-100">
        {onConfigure && (
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground hover:text-foreground h-8 w-8 shrink-0 p-0"
            onClick={(e) => {
              e.stopPropagation();
              onConfigure();
            }}
            aria-label="Configure pod"
          >
            <Settings className="h-4 w-4" />
          </Button>
        )}

        {/* DELETE BUTTON */}
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8 shrink-0 p-0"
          onClick={handleDelete}
          aria-label="Delete pod"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
});
