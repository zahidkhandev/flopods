/**
 * New Folder Modal
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Folder } from 'lucide-react';

interface NewFolderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateFolder: (name: string) => Promise<void>;
  isCreating: boolean;
}

export function NewFolderModal({
  open,
  onOpenChange,
  onCreateFolder,
  isCreating,
}: NewFolderModalProps) {
  const [folderName, setFolderName] = useState('');

  const handleCreate = async () => {
    if (!folderName.trim()) return;
    await onCreateFolder(folderName);
    setFolderName('');
    onOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isCreating) {
      handleCreate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[425px] sm:w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5 text-yellow-600" />
            New Folder
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Create a new folder to organize your documents
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="folder-name" className="text-sm">
              Folder name
            </Label>
            <Input
              id="folder-name"
              placeholder="Untitled folder"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              disabled={isCreating}
              className="text-sm"
            />
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCreating}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isCreating || !folderName.trim()}
            className="w-full sm:w-auto"
          >
            {isCreating ? 'Creating...' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
