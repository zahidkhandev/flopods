// File: apps/frontend/src/pages/dashboard/flows/[id]/components/pod-components/pod-execution-indicator.tsx
import { memo } from 'react';
import { Loader2, CheckCircle2, XCircle, Clock, Circle, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';

import { PodExecutionStatus } from '../../types';

interface StatusConfig {
  icon: typeof Circle;
  label: string;
  color: string;
  bg: string;
  animate?: string;
}

const statusConfig: Record<PodExecutionStatus, StatusConfig> = {
  [PodExecutionStatus.IDLE]: {
    icon: Circle,
    label: 'Idle',
    color: 'text-muted-foreground',
    bg: 'bg-muted/50',
  },
  [PodExecutionStatus.QUEUED]: {
    icon: Clock,
    label: 'Queued',
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/10',
    animate: 'animate-pulse',
  },
  [PodExecutionStatus.RUNNING]: {
    icon: Loader2,
    label: 'Running',
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    animate: 'animate-spin',
  },
  [PodExecutionStatus.PAUSED]: {
    icon: Pause,
    label: 'Paused',
    color: 'text-muted-foreground',
    bg: 'bg-muted/50',
  },
  [PodExecutionStatus.COMPLETED]: {
    icon: CheckCircle2,
    label: 'Completed',
    color: 'text-green-500',
    bg: 'bg-green-500/10',
  },
  [PodExecutionStatus.ERROR]: {
    icon: XCircle,
    label: 'Error',
    color: 'text-red-500',
    bg: 'bg-red-500/10',
  },
  [PodExecutionStatus.CANCELLED]: {
    icon: Circle,
    label: 'Cancelled',
    color: 'text-muted-foreground',
    bg: 'bg-muted/50',
  },
};

interface PodExecutionIndicatorProps {
  status: PodExecutionStatus;
  className?: string;
}

export default memo(function PodExecutionIndicator({
  status,
  className,
}: PodExecutionIndicatorProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5',
        'rounded-full px-2 py-0.5',
        'text-xs font-medium',
        'transition-all duration-200',
        config.bg,
        config.color,
        className
      )}
    >
      <Icon className={cn('h-3 w-3', config.animate)} />
      <span>{config.label}</span>
    </div>
  );
});
