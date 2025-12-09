/**
 * Folder Context Menu - Google Drive Style
 */

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { FolderPlus, Upload, RefreshCw } from 'lucide-react';

interface FolderContextMenuProps {
  children: React.ReactNode;
  onNewFolder: () => void;
  onUpload: () => void;
  onRefresh: () => void;
}

export function FolderContextMenu({
  children,
  onNewFolder,
  onUpload,
  onRefresh,
}: FolderContextMenuProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem onClick={onNewFolder} className="gap-2">
          <FolderPlus className="h-4 w-4" />
          New Folder
        </ContextMenuItem>
        <ContextMenuItem onClick={onUpload} className="gap-2">
          <Upload className="h-4 w-4" />
          Upload Files
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onRefresh} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
