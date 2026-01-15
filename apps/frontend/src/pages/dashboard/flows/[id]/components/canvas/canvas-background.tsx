// File: apps/frontend/src/pages/dashboard/flows/[id]/components/canvas/canvas-background.tsx
import { memo } from 'react';
import { Background, BackgroundVariant } from 'reactflow';

/**
 * Custom animated canvas background
 * Features:
 * - Dot pattern background (blue in dark mode, gray in light mode)
 * - Subtle radial gradients
 * - Works in both light and dark modes
 */
export default memo(function CanvasBackground() {
  return (
    <>
      {/* Dot grid pattern - blue in dark mode */}
      <Background
        variant={BackgroundVariant.Dots}
        gap={16}
        size={1}
        className="[&>*]:!stroke-[oklch(0.552_0.016_285.938/0.3)] [&>*]:dark:!stroke-[oklch(0.488_0.243_264.376/0.5)]"
        style={{ backgroundColor: 'oklch(var(--background))' }}
      />

      {/* Animated gradient overlays - using sidebar-primary blue */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(circle 800px at 20% 30%, oklch(0.488 0.243 264.376 / 0.05), transparent 50%),
            radial-gradient(circle 600px at 80% 70%, oklch(0.541 0.281 293.009 / 0.03), transparent 50%)
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
