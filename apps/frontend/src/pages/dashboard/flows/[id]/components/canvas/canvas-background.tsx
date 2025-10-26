// File: apps/frontend/src/pages/dashboard/flows/[id]/components/canvas/canvas-background.tsx
import { memo } from 'react';
import { Background, BackgroundVariant } from 'reactflow';

/**
 * Custom animated canvas background
 * Features:
 * - Dot pattern background
 * - Subtle radial gradients
 * - Theme-aware colors
 */
export default memo(function CanvasBackground() {
  return (
    <>
      {/* Dot grid pattern */}
      <Background
        variant={BackgroundVariant.Dots}
        gap={20}
        size={1.5}
        color="oklch(0.552 0.016 285.938 / 0.2)"
        className="opacity-50"
      />

      {/* Animated gradient overlays */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(circle 800px at 20% 30%, oklch(0.606 0.25 292.717 / 0.03), transparent 50%),
            radial-gradient(circle 600px at 80% 70%, oklch(0.646 0.222 222 / 0.02), transparent 50%)
          `,
        }}
      />

      {/* Vignette effect */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(circle at center, transparent 0%, oklch(0 0 0 / 0.05) 100%)',
        }}
      />
    </>
  );
});
