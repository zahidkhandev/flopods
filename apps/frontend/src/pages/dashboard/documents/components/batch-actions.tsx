// apps/frontend/src/pages/dashboard/documents/components/batch-actions.tsx

import { Trash2, FolderInput, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

interface BatchActionsProps {
  selectedCount: number;
  onMoveToFolder: () => void;
  onDelete: () => void;
  onDownload: () => void;
  onClearSelection: () => void;
}

export function DocumentsBatchActions({
  selectedCount,
  onMoveToFolder,
  onDelete,
  onDownload,
  onClearSelection,
}: BatchActionsProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
      <Card className="border-2 shadow-2xl">
        <div className="flex items-center gap-2 px-5">
          <Badge variant="secondary" className="shrink-0">
            {selectedCount} selected
          </Badge>
          <div className="bg-border h-4 w-px" />
          <Button variant="ghost" size="sm" onClick={onMoveToFolder}>
            <FolderInput className="mr-2 h-4 w-4" />
            Move
          </Button>
          <Button variant="ghost" size="sm" onClick={onDownload}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-600">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
          <div className="bg-border h-4 w-px" />
          <Button variant="ghost" size="sm" onClick={onClearSelection}>
            Clear
          </Button>
        </div>
      </Card>
    </div>
  );
}
