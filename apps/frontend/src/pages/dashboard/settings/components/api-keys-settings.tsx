import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Key, Trash2, Plus, Zap, Clock, DollarSign, Activity } from 'lucide-react';
import { useWorkspaceApiKeys } from '../hooks/use-workspace-api-keys';
import { Skeleton } from '@/components/ui/skeleton';
import { AddApiKeyDialog } from './add-api-key-dialog';
import { toast } from '@/lib/toast-utils';
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
  const { apiKeys, stats, isLoading, deleteApiKey, refetch } = useWorkspaceApiKeys(workspaceId);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      await deleteApiKey(deleteId);
      toast.success('API key deleted');
    } catch {
      // Error handled in hook
    }
    setDeleteId(null);
  };

  const handleAddSuccess = () => {
    setIsAddDialogOpen(false);
    refetch(); // Refresh data after adding
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
        {/* Header with Stats */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">API Keys</h3>
            <p className="text-muted-foreground mt-1 text-sm">
              Manage your LLM provider API keys ({apiKeysList.length}{' '}
              {apiKeysList.length === 1 ? 'key' : 'keys'})
            </p>

            {/* Usage Stats */}
            {stats && apiKeysList.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <Activity className="text-muted-foreground h-4 w-4" />
                  <span className="text-muted-foreground">Total Usage:</span>
                  <span className="font-semibold">{stats.totalUsageCount.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="text-muted-foreground h-4 w-4" />
                  <span className="text-muted-foreground">Total Cost:</span>
                  <span className="font-semibold">${stats.totalCostIncurred.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Zap className="text-muted-foreground h-4 w-4" />
                  <span className="text-muted-foreground">Active:</span>
                  <span className="font-semibold">
                    {stats.activeKeys} / {stats.totalKeys}
                  </span>
                </div>
              </div>
            )}
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
                className="group bg-card hover:border-primary/50 flex items-start justify-between rounded-lg border p-4 transition-all hover:shadow-sm"
              >
                <div className="flex items-start gap-4">
                  <div className="from-primary/20 to-primary/10 rounded-full bg-gradient-to-br p-3">
                    <Zap className="text-primary h-5 w-5" />
                  </div>
                  <div className="flex-1 space-y-2">
                    {/* Title Row */}
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{apiKey.displayName || 'Unnamed Key'}</p>
                      <Badge
                        variant={apiKey.isActive ? 'default' : 'secondary'}
                        className="font-medium"
                      >
                        {apiKey.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>

                    {/* Provider & Last Used */}
                    <div className="text-muted-foreground flex items-center gap-4 text-sm">
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
                              year: 'numeric',
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

                    {/* Usage Stats */}
                    {apiKey.usageCount > 0 && (
                      <div className="text-muted-foreground flex items-center gap-4 text-xs">
                        <span className="flex items-center gap-1">
                          <Activity className="h-3 w-3" />
                          {apiKey.usageCount.toLocaleString()} uses
                        </span>
                        {apiKey.totalCost > 0 && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />${apiKey.totalCost.toFixed(2)}
                            </span>
                          </>
                        )}
                        {apiKey.totalTokens && (
                          <>
                            <span>•</span>
                            <span>{parseInt(apiKey.totalTokens).toLocaleString()} tokens</span>
                          </>
                        )}
                      </div>
                    )}

                    {/* Creator Info */}
                    {apiKey.createdBy && (
                      <div className="text-muted-foreground text-xs">
                        Added by {apiKey.createdBy.name || apiKey.createdBy.email}
                      </div>
                    )}
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
        onOpenChange={(open) => {
          if (!open) {
            setIsAddDialogOpen(false);
          }
        }}
        onSuccess={handleAddSuccess} // Pass success handler
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
