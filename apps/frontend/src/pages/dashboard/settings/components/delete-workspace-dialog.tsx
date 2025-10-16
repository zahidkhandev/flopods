import { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from '@/lib/toast-utils';
import axiosInstance from '@/lib/axios-instance';

interface DeleteWorkspaceDialogProps {
  workspace: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteWorkspaceDialog({
  workspace,
  open,
  onOpenChange,
}: DeleteWorkspaceDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (confirmText !== workspace.name) {
      toast.error('Workspace name does not match');
      return;
    }

    setIsDeleting(true);
    try {
      await axiosInstance.delete(`/workspaces/${workspace.id}`);
      toast.success('Workspace deleted successfully');
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1000);
    } catch (error: any) {
      toast.error('Failed to delete workspace', {
        description: error.response?.data?.message || 'Please try again',
      });
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Workspace</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              This action <strong>cannot be undone</strong>. This will permanently delete the
              workspace <strong>&quot;{workspace.name}&quot;</strong> and remove all associated data
              including:
            </p>
            <ul className="list-inside list-disc space-y-1">
              <li>All workspace members</li>
              <li>All flows and spaces</li>
              <li>All documents and sources</li>
              <li>All API keys and integrations</li>
            </ul>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-4">
          <Label htmlFor="confirm">
            Type <strong>{workspace.name}</strong> to confirm
          </Label>
          <Input
            id="confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={workspace.name}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={confirmText !== workspace.name || isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete Workspace
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
