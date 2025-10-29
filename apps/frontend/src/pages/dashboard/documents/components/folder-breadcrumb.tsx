/**
 * Folder Breadcrumb - MOBILE OPTIMIZED
 */

import { Button } from '@/components/ui/button';
import { ChevronRight, Home } from 'lucide-react';
import type { DocumentFolder } from '../hooks/use-folders';

interface FolderBreadcrumbProps {
  breadcrumb: DocumentFolder[];
  onNavigate: (folderId: string | null) => void;
}

export function FolderBreadcrumb({ breadcrumb, onNavigate }: FolderBreadcrumbProps) {
  return (
    <div className="no-scrollbar flex items-center gap-0.5 overflow-x-auto sm:gap-1">
      {/* Home Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onNavigate(null)}
        className="h-8 shrink-0 gap-1.5 px-2 text-xs sm:h-9 sm:gap-2 sm:px-3 sm:text-sm"
      >
        <Home className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        <span className="hidden sm:inline">Documents</span>
      </Button>

      {/* Breadcrumb Trail */}
      {breadcrumb.map((folder, index) => (
        <div key={folder.id} className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          <ChevronRight className="text-muted-foreground h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate(folder.id)}
            className={`h-8 max-w-[120px] shrink-0 truncate px-2 text-xs sm:h-9 sm:max-w-none sm:px-3 sm:text-sm ${
              index === breadcrumb.length - 1 ? 'font-medium' : ''
            }`}
          >
            {folder.name}
          </Button>
        </div>
      ))}
    </div>
  );
}
