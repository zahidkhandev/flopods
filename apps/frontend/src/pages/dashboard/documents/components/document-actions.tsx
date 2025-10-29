/**
 * Document Actions Menu
 * Context menu with all document operations
 */

import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  MoreVertical,
  Download,
  Trash2,
  RefreshCw,
  Eye,
  Loader2,
  Edit,
  FolderInput,
} from 'lucide-react';
import { useDocuments } from '../hooks';
import type { Document } from '../types';

interface DocumentActionsProps {
  document: Document;
  onViewDetails?: (document: Document) => void;
  onEdit?: (document: Document) => void;
  onMove?: (document: Document) => void;
}

export function DocumentActions({
  document: doc,
  onViewDetails,
  onEdit,
  onMove,
}: DocumentActionsProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);

  const {
    deleteDocument,
    regenerateEmbeddings,
    downloadDocument,
    isDeleting,
    isRegenerating,
    isDownloading,
  } = useDocuments();

  const handleDelete = async () => {
    try {
      await deleteDocument(doc.id);
      setShowDeleteDialog(false);
    } catch {
      // Error handled in hook
    }
  };

  const handleRegenerate = async () => {
    try {
      await regenerateEmbeddings(doc.id);
      setShowRegenerateDialog(false);
    } catch {
      // Error handled in hook
    }
  };

  const handleDownload = async () => {
    try {
      await downloadDocument(doc.id);
    } catch {
      // Error handled in hook
    }
  };

  const canRegenerate = doc.status !== 'PROCESSING' && doc.status !== 'QUEUED';
  const canDownload = !!doc.s3Key && doc.status === 'READY';

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
            <span className="sr-only">Actions for {doc.name}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* View Details */}
          {onViewDetails && (
            <DropdownMenuItem onClick={() => onViewDetails(doc)} className="gap-2">
              <Eye className="h-4 w-4" />
              View Details
            </DropdownMenuItem>
          )}

          {/* Edit Name */}
          {onEdit && (
            <DropdownMenuItem onClick={() => onEdit(doc)} className="gap-2">
              <Edit className="h-4 w-4" />
              Rename
            </DropdownMenuItem>
          )}

          {/* Move to Folder */}
          {onMove && (
            <DropdownMenuItem onClick={() => onMove(doc)} className="gap-2">
              <FolderInput className="h-4 w-4" />
              Move to Folder
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          {/* Download */}
          <DropdownMenuItem
            onClick={handleDownload}
            disabled={!canDownload || isDownloading}
            className="gap-2"
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download
          </DropdownMenuItem>

          {/* Regenerate */}
          <DropdownMenuItem
            onClick={() => setShowRegenerateDialog(true)}
            disabled={!canRegenerate}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Regenerate Embeddings
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Delete */}
          <DropdownMenuItem
            onClick={() => setShowDeleteDialog(true)}
            className="text-destructive focus:text-destructive gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <span className="font-semibold">{doc.name}</span> and all
              its embeddings. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Regenerate Dialog */}
      <AlertDialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate embeddings?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reprocess <span className="font-semibold">{doc.name}</span> and regenerate
              all embeddings. Processing time depends on document size.
              {doc.status === 'FAILED' && (
                <span className="mt-2 block text-yellow-600">
                  This document previously failed. Regeneration may help resolve the issue.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRegenerating}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRegenerate} disabled={isRegenerating}>
              {isRegenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                'Regenerate'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
