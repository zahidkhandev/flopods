import { memo, useState, useRef } from 'react';
import { EdgeProps, getBezierPath, EdgeLabelRenderer } from 'reactflow';
import { X } from 'lucide-react';
import { useCanvas } from '../../context/canvas-context';

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
  const { deleteEdge } = useCanvas();

  // State to track hover status manually for better UX
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.25,
  });

  const onEdgeClick = (evt: React.MouseEvent) => {
    evt.stopPropagation();
    deleteEdge(id);
  };

  // === SMART HOVER LOGIC ===
  // Prevents blinking when moving mouse between the line and the button
  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    // Wait 150ms before hiding. If mouse enters button/line again, we cancel this.
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 150);
  };

  return (
    <>
      <g
        className="react-flow__edge"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* INVISIBLE HIT AREA - 50px wide for super easy grabbing */}
        <path
          d={edgePath}
          fill="none"
          strokeWidth={50}
          className="cursor-pointer stroke-transparent"
          style={{ pointerEvents: 'all' }} // Essential for capturing events on transparent
        />

        {/* VISIBLE PATH */}
        <path
          id={id}
          d={edgePath}
          fill="none"
          stroke="#a855f7"
          strokeWidth={selected ? 4 : 2}
          markerEnd={markerEnd}
          className={`transition-all duration-300 ${
            isHovered || selected ? 'stroke-[3px] opacity-100' : 'opacity-60'
          }`}
        />

        {/* GLOW EFFECT */}
        <path
          d={edgePath}
          fill="none"
          stroke="#a855f7"
          strokeWidth={selected ? 12 : 8}
          opacity={selected ? 0.4 : 0}
          style={{ filter: 'blur(4px)' }}
          className="transition-opacity duration-300"
        />
      </g>

      {/* DELETE BUTTON */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
            zIndex: 1001,
          }}
          className="nopan"
          // Attach handlers here too so button stays alive when hovered directly
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <button
            className={`border-border bg-destructive text-destructive-foreground flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border shadow-md transition-all duration-200 hover:scale-110 ${isHovered || selected ? 'scale-100 opacity-100' : 'pointer-events-none scale-50 opacity-0'} `}
            onClick={onEdgeClick}
            aria-label="Delete connection"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
});
