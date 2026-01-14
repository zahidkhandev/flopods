import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Mail, Trash2, Clock, CheckCircle2, XCircle, Copy, Check, UserPlus } from 'lucide-react';
import { useWorkspaceInvitations } from '../hooks/use-workspace-invitations';
import { Skeleton } from '@/components/ui/skeleton';
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
import { SendInvitationDialog } from './send-invitation-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export function InvitationsSettings({ workspaceId }: { workspaceId: string }) {
  const { invitations, isLoading, revokeInvitation, refetch } =
    useWorkspaceInvitations(workspaceId);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const handleRevoke = async () => {
    if (!revokeId) return;

    toast.promise(revokeInvitation(revokeId), {
      loading: 'Revoking invitation...',
      success: 'Invitation revoked',
      error: 'Failed to revoke invitation',
    });

    setRevokeId(null);
  };

  const handleSendSuccess = () => {
    setIsInviteDialogOpen(false);
    refetch(); // Refresh invitations list
  };

  const copyInvitationLink = (token: string) => {
    const inviteUrl = `${window.location.origin}/workspace/invite/${token}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedToken(token);
    toast.success('Link copied');
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'PENDING':
        return {
          variant: 'default' as const,
          icon: Clock,
          color: 'text-blue-600',
          label: 'Pending',
        };
      case 'ACCEPTED':
        return {
          variant: 'secondary' as const,
          icon: CheckCircle2,
          color: 'text-green-600',
          label: 'Accepted',
        };
      case 'EXPIRED':
        return {
          variant: 'destructive' as const,
          icon: XCircle,
          color: 'text-red-600',
          label: 'Expired',
        };
      case 'REVOKED':
        return {
          variant: 'outline' as const,
          icon: XCircle,
          color: 'text-gray-600',
          label: 'Revoked',
        };
      default:
        return {
          variant: 'secondary' as const,
          icon: null,
          color: 'text-gray-600',
          label: status,
        };
    }
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
        <Separator />
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const invitationsList = Array.isArray(invitations) ? invitations : [];
  const pendingInvitations = invitationsList.filter((inv) => inv.status === 'PENDING');

  const stats = {
    total: invitationsList.length,
    pending: pendingInvitations.length,
    accepted: invitationsList.filter((inv) => inv.status === 'ACCEPTED').length,
    expired: invitationsList.filter((inv) => inv.status === 'EXPIRED' || isExpired(inv.expiresAt))
      .length,
  };

  return (
    <div className="space-y-8">
      {/* Header with Stats */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold">Workspace Invitations</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Send and manage workspace invitations
          </p>

          <div className="mt-3 flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <Badge variant="default" className="h-5">
                {stats.pending}
              </Badge>
              <span className="text-muted-foreground">Pending</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="secondary" className="h-5">
                {stats.accepted}
              </Badge>
              <span className="text-muted-foreground">Accepted</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="h-5">
                {stats.expired}
              </Badge>
              <span className="text-muted-foreground">Expired</span>
            </div>
          </div>
        </div>

        <Button onClick={() => setIsInviteDialogOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Send Invitation
        </Button>
      </div>

      <Separator />

      {/* Invitations List or Empty State */}
      {invitationsList.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-16 text-center">
          <div className="bg-muted rounded-full p-4">
            <Mail className="text-muted-foreground h-10 w-10" />
          </div>
          <h3 className="mt-6 text-lg font-semibold">No invitations sent</h3>
          <p className="text-muted-foreground mt-2 max-w-sm text-sm">
            Invite team members to join your workspace via email
          </p>
          <Button className="mt-6" onClick={() => setIsInviteDialogOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Send Your First Invitation
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {invitationsList.map((invitation) => {
            const statusConfig = getStatusConfig(invitation.status);
            const expired = isExpired(invitation.expiresAt);
            const StatusIcon = statusConfig.icon;

            return (
              <div
                key={invitation.id}
                className="group bg-card hover:border-primary/50 flex items-start justify-between rounded-lg border p-4 transition-all hover:shadow-sm"
              >
                <div className="flex flex-1 items-start gap-3">
                  <div className="bg-muted rounded-full p-2.5">
                    <Mail className="text-muted-foreground h-4 w-4" />
                  </div>

                  <div className="flex-1 space-y-2">
                    {/* Email and Status */}
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{invitation.email}</p>
                      <Badge variant={statusConfig.variant} className="gap-1">
                        {StatusIcon && <StatusIcon className="h-3 w-3" />}
                        {statusConfig.label}
                      </Badge>
                    </div>

                    {/* Role and Permissions */}
                    <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
                      <Badge variant="outline" className="font-normal">
                        {invitation.role}
                      </Badge>

                      {invitation.permissions && (
                        <>
                          {invitation.permissions.canManageMembers && (
                            <Badge variant="outline" className="font-normal">
                              Can manage members
                            </Badge>
                          )}
                          {invitation.permissions.canManageApiKeys && (
                            <Badge variant="outline" className="font-normal">
                              Can manage API keys
                            </Badge>
                          )}
                          {invitation.permissions.canCreateCanvas && (
                            <Badge variant="outline" className="font-normal">
                              Can create canvas
                            </Badge>
                          )}
                          {invitation.permissions.canDeleteCanvas && (
                            <Badge variant="outline" className="font-normal">
                              Can delete canvas
                            </Badge>
                          )}
                        </>
                      )}
                    </div>

                    {/* Dates */}
                    <div className="text-muted-foreground flex items-center gap-4 text-xs">
                      <span>
                        Sent{' '}
                        {new Date(invitation.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                      <span>•</span>
                      <span className={expired ? 'text-destructive' : ''}>
                        {expired ? 'Expired' : 'Expires'}{' '}
                        {new Date(invitation.expiresAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {invitation.status === 'PENDING' && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copyInvitationLink(invitation.token)}
                            className="h-8 w-8 opacity-0 group-hover:opacity-100"
                          >
                            {copiedToken === invitation.token ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Copy invitation link</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}

                  {invitation.status === 'PENDING' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRevokeId(invitation.id)}
                      className="text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Revoke
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <SendInvitationDialog
        workspaceId={workspaceId}
        open={isInviteDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsInviteDialogOpen(false);
          }
        }}
        onSuccess={handleSendSuccess} // Pass success handler
      />

      <AlertDialog open={!!revokeId} onOpenChange={() => setRevokeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Invitation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke this invitation? The recipient will no longer be able
              to use the invitation link to join the workspace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevoke} className="bg-destructive">
              Revoke Invitation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
