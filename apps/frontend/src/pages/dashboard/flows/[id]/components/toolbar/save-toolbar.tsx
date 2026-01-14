// File: apps/frontend/src/pages/dashboard/flows/[id]/components/toolbar/save-toolbar.tsx
import { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Save, Loader2, ZoomIn } from 'lucide-react';
import { useCanvas } from '../../context/canvas-context';
import { cn } from '@/lib/utils';
import { useReactFlow } from 'reactflow';

export default memo(function SaveToolbar() {
  const { save, isSaving, hasUnsavedChanges } = useCanvas();
  const { fitView } = useReactFlow();

  const handleAutoLayout = () => {
    // For now, just fit view nicely
    // Later you can add dagre layout algorithm
    fitView({
      padding: 0.2,
      duration: 300,
      minZoom: 0.1,
      maxZoom: 1,
    });
  };

  return (
    <div className="bg-card/80 border-border/50 flex items-center gap-2 rounded-lg border p-2 shadow-lg backdrop-blur-xl">
      {/* Auto Layout */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleAutoLayout}
        className="h-8 gap-2"
        title="Auto Layout (Arrange nodes)"
      >
        <ZoomIn className="h-4 w-4" />
        <span className="text-xs">Fit</span>
      </Button>

      <div className="bg-border/50 h-6 w-px" />

      {/* Save Button */}
      <Button
        variant={hasUnsavedChanges ? 'default' : 'ghost'}
        size="sm"
        onClick={save}
        disabled={isSaving || !hasUnsavedChanges}
        className={cn('gap-2', hasUnsavedChanges && 'animate-pulse')}
        title="Save (Cmd/Ctrl + S)"
      >
        {isSaving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="h-4 w-4" />
            {hasUnsavedChanges ? 'Save' : 'Saved'}
          </>
        )}
      </Button>
    </div>
  );
});
