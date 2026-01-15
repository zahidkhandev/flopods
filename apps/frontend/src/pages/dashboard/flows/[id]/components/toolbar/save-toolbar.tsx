// File: apps/frontend/src/pages/dashboard/flows/[id]/components/toolbar/save-toolbar.tsx
import { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Save, Loader2, ZoomIn, Sparkles } from 'lucide-react';
import { useCanvas } from '../../context/canvas-context';
import { cn } from '@/lib/utils';
import { useReactFlow } from 'reactflow';

export default memo(function SaveToolbar() {
  const { save, isSaving, hasUnsavedChanges, autoArrange, isArranging } = useCanvas();
  const { fitView } = useReactFlow();

  const handleFitView = () => {
    fitView({
      padding: 0.2,
      duration: 300,
      minZoom: 0.1,
      maxZoom: 1,
    });
  };

  return (
    <div className="bg-card/80 border-border/50 flex items-center gap-2 rounded-lg border p-2 shadow-lg backdrop-blur-xl">
      {/* Auto Arrange */}
      <Button
        variant="ghost"
        size="sm"
        onClick={autoArrange}
        disabled={isArranging}
        className="h-8 gap-2"
        title="Auto Arrange (Organize nodes)"
      >
        {isArranging ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        <span className="text-xs">Arrange</span>
      </Button>

      {/* Fit View */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleFitView}
        className="h-8 gap-2"
        title="Fit to screen"
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
