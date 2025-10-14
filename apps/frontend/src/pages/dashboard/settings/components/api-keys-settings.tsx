import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Key, Trash2, Plus, Zap, Clock } from 'lucide-react';
import { useWorkspaceApiKeys } from '../hooks/use-workspace-api-keys';
import { Skeleton } from '@/components/ui/skeleton';
import { AddApiKeyDialog } from './add-api-key-dialog';
import { toast } from 'sonner';
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

export function ApiKeysSettings({ workspaceId }: { workspaceId: string }) {
  const { apiKeys, isLoading, deleteApiKey } = useWorkspaceApiKeys(workspaceId);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deleteId) return;

    toast.promise(deleteApiKey(deleteId), {
      loading: 'Deleting API key...',
      success: 'API key deleted successfully',
      error: 'Failed to delete API key',
    });
    setDeleteId(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
        <Separator />
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const apiKeysList = Array.isArray(apiKeys) ? apiKeys : [];

  return (
    <>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">API Keys</h3>
            <p className="text-muted-foreground mt-1 text-sm">
              Manage your LLM provider API keys for integrations ({apiKeysList.length}{' '}
              {apiKeysList.length === 1 ? 'key' : 'keys'})
            </p>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add API Key
          </Button>
        </div>

        <Separator />

        {/* API Keys List or Empty State */}
        {apiKeysList.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-16 text-center">
            <div className="bg-muted rounded-full p-4">
              <Key className="text-muted-foreground h-10 w-10" />
            </div>
            <h3 className="mt-6 text-lg font-semibold">No API keys configured</h3>
            <p className="text-muted-foreground mt-2 max-w-sm text-sm">
              Connect LLM providers like OpenAI, Anthropic, or Google AI to power your workflows
            </p>
            <Button className="mt-6" onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Your First API Key
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {apiKeysList.map((apiKey) => (
              <div
                key={apiKey.id}
                className="group bg-card hover:border-primary/50 flex items-center justify-between rounded-lg border p-4 transition-all hover:shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <div className="from-primary/20 to-primary/10 rounded-full bg-gradient-to-br p-3">
                    <Zap className="text-primary h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{apiKey.displayName || 'Unnamed Key'}</p>
                      <Badge
                        variant={apiKey.isActive ? 'default' : 'secondary'}
                        className="font-medium"
                      >
                        {apiKey.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground mt-1 flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1">
                        <span className="font-medium">Provider:</span>{' '}
                        {apiKey.provider || 'Unknown'}
                      </span>
                      {apiKey.lastUsedAt ? (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Last used:{' '}
                            {new Date(apiKey.lastUsedAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </>
                      ) : (
                        <>
                          <span>•</span>
                          <span className="text-muted-foreground/60">Never used</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteId(apiKey.id)}
                  className="text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <AddApiKeyDialog
        workspaceId={workspaceId}
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this API key? This action cannot be undone and any
              workflows or flows using this key will stop working immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive">
              Delete API Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
