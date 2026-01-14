// File: apps/frontend/src/pages/dashboard/flows/[id]/components/pod-components/pod-handle.tsx
import { memo } from 'react';
import { Handle, HandleProps, Position } from 'reactflow';
import { cn } from '@/lib/utils';

interface PodHandleProps extends Omit<HandleProps, 'position'> {
  position: Position;
}

export default memo(function PodHandle({ type, position, ...props }: PodHandleProps) {
  const isLeft = position === Position.Left;
  const isRight = position === Position.Right;

  return (
    <Handle
      type={type}
      position={position}
      id={type}
      {...props}
      style={{
        width: '16px', // Make bigger
        height: '16px', // Make bigger
        border: '3px solid hsl(var(--primary))', // Thicker border
        background: 'white', // ALWAYS WHITE (visible on dark bg)
        borderRadius: '50%',
        left: isLeft ? '-8px' : undefined, // Adjust for bigger size
        right: isRight ? '-8px' : undefined, // Adjust for bigger size
        top: '50%',
        transform: 'translateY(-50%)',
        position: 'absolute',
        zIndex: 100, // FORCE on top
        cursor: 'crosshair',
        transition: 'all 0.2s ease',
        boxShadow: '0 0 0 2px hsl(var(--background)), 0 0 10px rgba(0,0,0,0.1)', // Add glow
      }}
      className={cn(
        'hover:scale-150', // Bigger hover
        'hover:shadow-[0_0_20px_hsl(var(--primary))]',
        'hover:border-primary'
      )}
    />
  );
});
