/**
 * Folder Card - SUPER RESPONSIVE
 */

import { Card } from '@/components/ui/card';
import { Folder, MoreVertical, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';
import type { DocumentFolder } from '../hooks/use-folders';

interface FolderCardProps {
  folder: DocumentFolder;
  onClick: () => void;
  onDelete?: () => void;
  onRename?: () => void;
}

export function FolderCard({ folder, onClick, onDelete, onRename }: FolderCardProps) {
  return (
    <Card
      className="group hover:border-primary cursor-pointer transition-all hover:shadow-md"
      onClick={onClick}
    >
      <div className="p-3 sm:p-4">
        {/* Mobile: Stacked */}
        <div className="flex flex-col gap-2 sm:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
              <Folder className="h-5 w-5 text-yellow-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{folder.name}</p>
              <p className="text-muted-foreground truncate text-xs">
                {folder._count?.documents || 0} files
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onRename && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onRename();
                    }}
                    className="gap-2"
                  >
                    <Edit className="h-4 w-4" />
                    Rename
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem
                    className="text-destructive gap-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete();
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Desktop: Horizontal */}
        <div className="hidden sm:flex sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
              <Folder className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{folder.name}</p>
              <p className="text-muted-foreground mt-1 text-xs">
                {folder._count?.documents || 0} files •{' '}
                {formatDistanceToNow(new Date(folder.createdAt), { addSuffix: true })}
              </p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onRename && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onRename();
                  }}
                  className="gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Rename
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  className="text-destructive gap-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Card>
  );
}
