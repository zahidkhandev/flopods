// File: apps/frontend/src/pages/dashboard/flows/[id]/components/panels/pod-library/pod-library-item.tsx
import { memo } from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PodLibraryItemProps {
  type: string;
  label: string;
  icon: LucideIcon;
  description: string;
}

/**
 * Individual draggable pod item in library
 * Features:
 * - Drag to canvas to create pod
 * - Hover effects
 * - Icon + description
 */
export default memo(function PodLibraryItem({
  type,
  label,
  icon: Icon,
  description,
}: PodLibraryItemProps) {
  const handleDragStart = (event: React.DragEvent) => {
    event.dataTransfer.setData('application/reactflow', type);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <motion.div
      draggable
      // Use onDragStartCapture for motion.div instead of onDragStart
      onDragStartCapture={handleDragStart}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'group relative',
        'border-border/50 rounded-lg border',
        'bg-card/50 backdrop-blur-sm',
        'cursor-grab p-3 active:cursor-grabbing',
        'transition-all duration-200',
        'hover:bg-card/80 hover:border-primary/30',
        'hover:shadow-[0_0_20px_oklch(0.606_0.25_292.717_/_0.1)]'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="bg-primary/10 text-primary group-hover:bg-primary/20 flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors">
          <Icon className="h-4 w-4" />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-sm font-medium">{label}</h4>
          <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">{description}</p>
        </div>
      </div>

      {/* Drag indicator */}
      <div className="border-primary/0 group-hover:border-primary/20 pointer-events-none absolute inset-0 rounded-lg border-2 transition-colors" />
    </motion.div>
  );
});
