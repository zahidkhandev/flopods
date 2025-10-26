import { memo, ReactNode } from 'react';
import { Position } from 'reactflow';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import PodHandle from '../pod-components/pod-handle';
import PodHeader from '../pod-components/pod-header';
import { PodExecutionStatus } from '../../types';

interface BasePodNodeProps {
  title: string | ReactNode;
  icon: ReactNode;
  status: PodExecutionStatus;
  variant: 'input' | 'process' | 'output';
  selected?: boolean;
  children?: ReactNode;
  onConfigure?: () => void;
  onExecute?: () => void;
}

const variantStyles = {
  input: {
    bg: 'bg-gradient-to-br from-blue-500/5 via-blue-500/3 to-transparent',
    border: 'border-blue-500/30',
    glow: 'shadow-[0_0_20px_rgba(59,130,246,0.1)]',
  },
  process: {
    bg: 'bg-gradient-to-br from-primary/5 via-primary/3 to-transparent',
    border: 'border-primary/30',
    glow: 'shadow-[0_0_20px_hsl(var(--primary)_/_0.1)]',
  },
  output: {
    bg: 'bg-gradient-to-br from-green-500/5 via-green-500/3 to-transparent',
    border: 'border-green-500/30',
    glow: 'shadow-[0_0_20px_rgba(34,197,94,0.1)]',
  },
};

const statusGlow = {
  [PodExecutionStatus.IDLE]: '',
  [PodExecutionStatus.QUEUED]: 'shadow-[0_0_25px_rgba(250,204,21,0.3)] border-yellow-500/50',
  [PodExecutionStatus.RUNNING]:
    'shadow-[0_0_30px_rgba(59,130,246,0.4)] border-blue-500/70 animate-pulse',
  [PodExecutionStatus.PAUSED]: 'shadow-[0_0_15px_rgba(100,116,139,0.2)]',
  [PodExecutionStatus.COMPLETED]: 'shadow-[0_0_20px_rgba(34,197,94,0.3)] border-green-500/50',
  [PodExecutionStatus.ERROR]: 'shadow-[0_0_25px_rgba(239,68,68,0.4)] border-red-500/70',
  [PodExecutionStatus.CANCELLED]: 'shadow-[0_0_15px_rgba(100,116,139,0.2)]',
};

export default memo(function BasePodNode({
  title,
  icon,
  status,
  variant,
  children,
  selected = false,
  onConfigure,
}: BasePodNodeProps) {
  const styles = variantStyles[variant];

  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.95, opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'group relative w-[700px]',
        'rounded-2xl border-2',
        'backdrop-blur-xl',
        'bg-card/90',
        'transition-all duration-300',
        styles.bg,
        styles.border,
        styles.glow,
        selected && 'ring-primary/40 scale-[1.02] ring-4',
        statusGlow[status]
      )}
    >
      <PodHandle type="target" position={Position.Left} />
      <PodHandle type="source" position={Position.Right} />

      {status === PodExecutionStatus.RUNNING && (
        <div
          className={cn(
            'absolute -inset-0.5 rounded-2xl opacity-30 blur-xl',
            'bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500',
            'animate-pulse'
          )}
        />
      )}

      <div className="relative overflow-hidden rounded-2xl">
        <div className="drag-handle cursor-move rounded-t-2xl bg-black/[0.03] dark:bg-white/[0.02]">
          <PodHeader title={title} icon={icon} status={status} onConfigure={onConfigure} />
        </div>

        <div className="nodrag nowheel max-w-full space-y-3 overflow-hidden p-4">{children}</div>
      </div>
    </motion.div>
  );
});
