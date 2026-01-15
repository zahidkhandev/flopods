import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, Trash2, Settings2, Mail } from 'lucide-react';
import { useWorkspaceMembers } from '../hooks/use-workspace-members';
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
import { UpdateMemberDialog } from './update-member-dialog';

export function MembersSettings({ workspaceId }: { workspaceId: string }) {
  const { members, isLoading, removeMember, refetch } = useWorkspaceMembers(workspaceId);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [editMember, setEditMember] = useState<any | null>(null);

  const handleRemove = async () => {
    if (!removeId) return;

    toast.promise(removeMember(removeId), {
      loading: 'Removing member...',
      success: 'Member removed successfully',
      error: 'Failed to remove member',
    });

    setRemoveId(null);
  };

  const handleUpdateSuccess = () => {
    setEditMember(null);
    refetch();
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'OWNER':
        return 'default' as const;
      case 'ADMIN':
        return 'secondary' as const;
      case 'MEMBER':
        return 'outline' as const;
      default:
        return 'outline' as const;
    }
  };

  const getInitials = (name?: string | null, email?: string | null) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return 'U';
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
        <Separator />
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const membersList = Array.isArray(members) ? members : [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold">Team Members</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage workspace members, their roles, and permissions
          </p>
          <p className="text-muted-foreground mt-2 flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4" />
            <span>Use invitations to add new members to your workspace</span>
          </p>
        </div>
      </div>

      <Separator />

      {/* Members List */}
      {membersList.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-16 text-center">
          <div className="bg-muted rounded-full p-4">
            <Users className="text-muted-foreground h-10 w-10" />
          </div>
          <h3 className="mt-6 text-lg font-semibold">No members yet</h3>
          <p className="text-muted-foreground mt-2 max-w-sm text-sm">
            Send invitations to add team members to this workspace
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {membersList.map((member) => {
            const isOwner = member.role === 'OWNER';

            return (
              <div
                key={member.userId}
                className="group bg-card hover:border-primary/50 flex items-start justify-between rounded-lg border p-4 transition-all hover:shadow-sm"
              >
                <div className="flex flex-1 items-start gap-3">
                  {/* Avatar */}
                  <Avatar className="h-10 w-10">
                    <AvatarImage
                      src={member.user.image || undefined}
                      alt={member.user.firstName || member.user.email || 'User'}
                    />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {getInitials(member.user.firstName, member.user.email)}
                    </AvatarFallback>
                  </Avatar>

                  {/* Member Info */}
                  <div className="min-w-0 flex-1 space-y-2">
                    {/* Name & Email */}
                    <div>
                      <p className="font-semibold">
                        {member.user.firstName + ' ' + member.user.lastName || 'Unnamed User'}
                      </p>
                      <p className="text-muted-foreground text-sm">{member.user.email}</p>
                    </div>

                    {/* Role & Permissions */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={getRoleBadgeVariant(member.role)} className="font-medium">
                        {member.role}
                      </Badge>

                      {member.canManageMembers && (
                        <Badge variant="outline" className="text-xs font-normal">
                          Can manage members
                        </Badge>
                      )}
                      {member.canManageApiKeys && (
                        <Badge variant="outline" className="text-xs font-normal">
                          Can manage API keys
                        </Badge>
                      )}
                      {member.canCreateCanvas && (
                        <Badge variant="outline" className="text-xs font-normal">
                          Can create canvas
                        </Badge>
                      )}
                      {member.canDeleteCanvas && (
                        <Badge variant="outline" className="text-xs font-normal">
                          Can delete canvas
                        </Badge>
                      )}
                    </div>

                    {/* Join Date */}
                    <p className="text-muted-foreground text-xs">
                      Joined{' '}
                      {new Date(member.joinedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                {!isOwner && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditMember(member)}
                      className="opacity-0 group-hover:opacity-100"
                    >
                      <Settings2 className="mr-2 h-4 w-4" />
                      Edit
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRemoveId(member.userId)}
                      className="text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove
                    </Button>
                  </div>
                )}

                {isOwner && (
                  <Badge variant="default" className="ml-4 shrink-0">
                    Owner
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Update Member Dialog */}
      {editMember && (
        <UpdateMemberDialog
          workspaceId={workspaceId}
          member={editMember}
          open={!!editMember}
          onOpenChange={(open) => {
            if (!open) {
              setEditMember(null);
            }
          }}
          onSuccess={handleUpdateSuccess}
        />
      )}

      {/* Remove Confirmation Dialog */}
      <AlertDialog open={!!removeId} onOpenChange={() => setRemoveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this member from the workspace? They will lose access
              to all workspace resources.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} className="bg-destructive">
              Remove Member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
