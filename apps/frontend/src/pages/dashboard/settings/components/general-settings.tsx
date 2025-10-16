import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Trash2, Save, Loader2, Copy, Check, Calendar, Building2, AlertCircle } from 'lucide-react';
import { toast } from '@/lib/toast-utils';
import { axiosInstance } from '@/lib/axios-instance';
import { DeleteWorkspaceDialog } from './delete-workspace-dialog';
import { useWorkspaces } from '@/hooks/use-workspaces';

interface GeneralSettingsProps {
  workspace: any;
}

export function GeneralSettings({ workspace }: GeneralSettingsProps) {
  const { workspaces } = useWorkspaces();
  const [workspaceName, setWorkspaceName] = useState(workspace.name);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // ✅ Handle both workspace list format (role) and workspace details format (currentUserRole)
  const userRole = workspace.currentUserRole || workspace.role;
  const isOwner = userRole === 'OWNER';

  const totalWorkspaces = Array.isArray(workspaces) ? workspaces.length : 0;
  const isLastWorkspace = totalWorkspaces <= 1;
  const canDelete = isOwner && workspace.type === 'TEAM' && !isLastWorkspace;

  const handleUpdateName = async () => {
    if (!workspaceName.trim()) {
      toast.error('Workspace name cannot be empty');
      return;
    }

    if (workspaceName === workspace.name) {
      toast.info('No changes to save');
      return;
    }

    setIsUpdating(true);
    try {
      await axiosInstance.patch(`/workspaces/${workspace.id}`, { name: workspaceName });
      toast.success('Workspace name updated');
      setTimeout(() => window.location.reload(), 1000);
    } catch (error: any) {
      toast.error('Failed to update workspace', {
        description: error.response?.data?.message || 'Please try again',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const copyWorkspaceId = () => {
    navigator.clipboard.writeText(workspace.id);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div>
        <h3 className="text-lg font-semibold">General Settings</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage your workspace information and settings
        </p>
      </div>

      <Separator />

      {/* Workspace Name Section */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="workspace-name" className="text-base font-medium">
            Workspace Name
          </Label>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Update the display name for your workspace
          </p>
        </div>
        <div className="flex max-w-2xl gap-3">
          <Input
            id="workspace-name"
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            placeholder="Enter workspace name"
            className="h-10"
            disabled={!isOwner}
          />
          <Button
            onClick={handleUpdateName}
            disabled={isUpdating || workspaceName === workspace.name || !isOwner}
            size="default"
          >
            {isUpdating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save
              </>
            )}
          </Button>
        </div>
        {!isOwner && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Only workspace owners can update the workspace name
            </AlertDescription>
          </Alert>
        )}
      </div>

      <Separator />

      {/* Workspace Details Section */}
      <div className="space-y-6">
        <div>
          <h4 className="text-base font-medium">Workspace Details</h4>
          <p className="text-muted-foreground mt-0.5 text-sm">
            View information about your workspace
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {/* Workspace Type */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Building2 className="text-muted-foreground h-4 w-4" />
              <span>Workspace Type</span>
            </div>
            <Badge
              variant={workspace.type === 'PERSONAL' ? 'default' : 'secondary'}
              className="text-xs"
            >
              {workspace.type}
            </Badge>
          </div>

          {/* Created Date */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Calendar className="text-muted-foreground h-4 w-4" />
              <span>Created</span>
            </div>
            <p className="text-muted-foreground text-sm">
              {new Date(workspace.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
        </div>

        {/* Workspace ID */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Workspace ID</Label>
          <div className="flex max-w-2xl items-center gap-2">
            <Input
              value={workspace.id}
              readOnly
              className="h-9 flex-1 font-mono text-xs"
              disabled
            />
            <Button variant="outline" size="sm" onClick={copyWorkspaceId} className="h-9 shrink-0">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">Your unique workspace identifier</p>
        </div>
      </div>

      {/* ✅ DANGER ZONE - ONLY SHOWS FOR OWNER OF TEAM WORKSPACES */}
      {isOwner && workspace.type === 'TEAM' && (
        <>
          <Separator />
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-destructive text-base">Danger Zone</CardTitle>
              <CardDescription>
                Irreversible actions that will permanently affect your workspace
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border-destructive/20 bg-background flex items-start justify-between rounded-lg border p-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Delete this workspace</p>
                  <p className="text-muted-foreground text-sm">
                    {isLastWorkspace
                      ? 'Cannot delete your last workspace'
                      : 'Once deleted, all data will be permanently removed'}
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  disabled={!canDelete}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>

              {/* Last Workspace Warning */}
              {isLastWorkspace && (
                <Alert className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    You must have at least one workspace. Create another workspace before deleting
                    this one.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Personal Workspace Note */}
      {workspace.type === 'PERSONAL' && (
        <>
          <Separator />
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Personal workspaces cannot be deleted. They are automatically managed for each user.
            </AlertDescription>
          </Alert>
        </>
      )}

      <DeleteWorkspaceDialog
        workspace={workspace}
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      />
    </div>
  );
}
