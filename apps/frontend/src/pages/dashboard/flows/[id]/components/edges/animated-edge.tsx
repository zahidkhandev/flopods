// File: apps/frontend/src/pages/dashboard/flows/[id]/components/edges/animated-edge.tsx
import { memo } from 'react';
import { EdgeProps, getBezierPath } from 'reactflow';

export default memo(function AnimatedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  selected,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.25,
  });

  return (
    <g className="react-flow__edge">
      {/* SIMPLE VISIBLE PATH - NO ANIMATIONS */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke="#a855f7" // HARD-CODED PURPLE (always visible)
        strokeWidth={selected ? 4 : 3} // THICK line
        markerEnd={markerEnd}
        style={{ opacity: 1 }} // FORCE visible
      />

      {/* Glow effect */}
      <path
        d={edgePath}
        fill="none"
        stroke="#a855f7"
        strokeWidth={selected ? 12 : 8}
        opacity={0.2}
        style={{ filter: 'blur(4px)' }}
      />
    </g>
  );
});
