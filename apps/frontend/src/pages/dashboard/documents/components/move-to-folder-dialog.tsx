import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Folder, Home, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DocumentFolder } from '../hooks/use-folders';

function getCurrentFolder(navigationPath: DocumentFolder[]): DocumentFolder | null {
  if (navigationPath.length === 0) return null;
  return navigationPath[navigationPath.length - 1];
}

interface MoveToFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: DocumentFolder[];
  currentFolderId: string | null;
  onMove: (folderId: string | null) => void;
}

export function MoveToFolderDialog({
  open,
  onOpenChange,
  folders,
  currentFolderId,
  onMove,
}: MoveToFolderDialogProps) {
  const [navigationPath, setNavigationPath] = useState<DocumentFolder[]>([]);
  // NEW: Track the intended move target. Defaults to selected folder on nav or Root.
  const currentFolder = getCurrentFolder(navigationPath);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(currentFolderId);

  const displayFolders = currentFolder ? currentFolder.children || [] : folders;

  const navigateInto = (folder: DocumentFolder) => {
    setNavigationPath([...navigationPath, folder]);
    setSelectedFolderId(folder.id);
  };

  const navigateTo = (index: number) => {
    const path = navigationPath.slice(0, index + 1);
    setNavigationPath(path);
    setSelectedFolderId(path[path.length - 1]?.id ?? null);
  };

  const navigateToRoot = () => {
    setNavigationPath([]);
    setSelectedFolderId(null);
  };

  // Clicking a folder row *selects* it
  const handleSelectFolder = (folder: DocumentFolder | null) => {
    setSelectedFolderId(folder?.id ?? null);
  };

  const handleMove = () => {
    onMove(selectedFolderId || null);
    onOpenChange(false);
  };

  // Reset selection on open/close
  // (prevents showing previous target if dialog is reopened)
  // optionally debounce this in production
  if (!open && navigationPath.length > 0) {
    setNavigationPath([]);
    setSelectedFolderId(currentFolderId);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Move to Folder</DialogTitle>
        </DialogHeader>

        {/* Breadcrumb Navigation */}
        <div className="border-b pb-3">
          <div className="flex items-center gap-1 text-sm">
            <Button variant="ghost" size="sm" className="h-7 gap-1 px-2" onClick={navigateToRoot}>
              <Home className="h-3.5 w-3.5" />
              <span>Root</span>
            </Button>
            {navigationPath.map((folder, index) => (
              <div key={folder.id} className="flex items-center gap-1">
                <ChevronRight className="text-muted-foreground h-3.5 w-3.5" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => navigateTo(index)}
                >
                  {folder.name}
                </Button>
              </div>
            ))}
          </div>
        </div>

        <ScrollArea className="max-h-[350px]">
          <div className="space-y-1 py-2">
            <Button
              variant={selectedFolderId === null ? 'outline' : 'ghost'}
              className={cn('w-full justify-start gap-2', selectedFolderId === null && 'bg-accent')}
              onClick={() => handleSelectFolder(null)}
            >
              <Home className="h-4 w-4" />
              <span className="font-medium">
                Select &quot;{currentFolder?.name || 'Root'}&quot; folder
              </span>
            </Button>

            {/* Subfolders */}
            {displayFolders.length > 0 ? (
              <>
                <div className="text-muted-foreground my-2 text-xs font-medium">Subfolders</div>
                {displayFolders.map((folder) => (
                  <div key={folder.id} className="flex items-center gap-1">
                    <Button
                      variant={selectedFolderId === folder.id ? 'outline' : 'ghost'}
                      className={cn(
                        'flex-1 justify-start gap-2',
                        selectedFolderId === folder.id && 'bg-accent'
                      )}
                      onClick={() => handleSelectFolder(folder)}
                      onDoubleClick={() => navigateInto(folder)}
                    >
                      <Folder
                        className={cn('h-4 w-4', folder.color ? '' : 'text-yellow-600')}
                        style={folder.color ? { color: folder.color } : undefined}
                      />
                      <span className="flex-1 truncate text-left">{folder.name}</span>
                      <ChevronRight className="text-muted-foreground h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </>
            ) : (
              <div className="text-muted-foreground py-8 text-center text-sm">No subfolders</div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={handleMove}
            disabled={selectedFolderId === currentFolderId}
          >
            Move Here
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
