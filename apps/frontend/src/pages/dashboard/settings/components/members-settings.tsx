import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  UserPlus,
  Trash2,
  MoreVertical,
  Shield,
  User as UserIcon,
  Mail,
  Calendar,
  Crown,
} from 'lucide-react';
import { useWorkspaceMembers } from '../hooks/use-workspace-members';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
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
import { AddMemberDialog } from './add-member-dialog';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/use-auth';

export function MembersSettings({ workspaceId }: { workspaceId: string }) {
  const { members, isLoading, removeMember } = useWorkspaceMembers(workspaceId);
  const { user } = useAuth();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState<{
    userId: string;
    userName: string;
  } | null>(null);

  const handleRemoveMember = async () => {
    if (!removeConfirm) return;

    const { userId, userName } = removeConfirm;

    // ✅ PREVENT SELF-REMOVAL
    if (userId === user?.userId) {
      toast.error('Cannot remove yourself', {
        description: 'You cannot remove yourself from the workspace',
      });
      setRemoveConfirm(null);
      return;
    }

    toast.promise(removeMember(userId), {
      loading: `Removing ${userName}...`,
      success: `${userName} removed from workspace`,
      error: 'Failed to remove member',
    });

    setRemoveConfirm(null);
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'OWNER':
        return 'default';
      case 'ADMIN':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getPermissionBadges = (member: any) => {
    const permissions = [];
    if (member.canManageMembers) permissions.push('Manage Members');
    if (member.canManageApiKeys) permissions.push('Manage API Keys');
    if (member.canManageBilling) permissions.push('Manage Billing');
    if (member.canDeleteCanvas) permissions.push('Delete Canvas');
    return permissions;
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
        <Separator />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 rounded-lg border p-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const membersList = Array.isArray(members) ? members : [];
  const stats = {
    total: membersList.length,
    owners: membersList.filter((m) => m.role === 'OWNER').length,
    admins: membersList.filter((m) => m.role === 'ADMIN').length,
    members: membersList.filter((m) => m.role === 'MEMBER').length,
  };

  return (
    <>
      <div className="space-y-8">
        {/* Header with Stats */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">Workspace Members</h3>
            <p className="text-muted-foreground mt-1 text-sm">
              Manage team members and their access levels
            </p>
            <div className="mt-3 flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <Badge variant="default" className="h-5">
                  {stats.total}
                </Badge>
                <span className="text-muted-foreground">Total</span>
              </div>
              {stats.owners > 0 && (
                <div className="flex items-center gap-1.5">
                  <Crown className="h-4 w-4 text-yellow-600" />
                  <span className="text-muted-foreground">{stats.owners} Owner</span>
                </div>
              )}
              {stats.admins > 0 && (
                <div className="flex items-center gap-1.5">
                  <Shield className="h-4 w-4 text-blue-600" />
                  <span className="text-muted-foreground">{stats.admins} Admin(s)</span>
                </div>
              )}
            </div>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Member
          </Button>
        </div>

        <Separator />

        {/* Members List or Empty State */}
        {membersList.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-16 text-center">
            <div className="bg-muted rounded-full p-4">
              <UserIcon className="text-muted-foreground h-10 w-10" />
            </div>
            <h3 className="mt-6 text-lg font-semibold">No members yet</h3>
            <p className="text-muted-foreground mt-2 max-w-sm text-sm">
              Start collaborating by adding team members to your workspace
            </p>
            <Button className="mt-6" onClick={() => setIsAddDialogOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Add Your First Member
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {membersList.map((member) => {
              const permissions = getPermissionBadges(member);
              const isCurrentUser = member.userId === user?.userId;

              return (
                <div
                  key={member.userId}
                  className="group bg-card hover:border-primary/50 flex items-start justify-between rounded-lg border p-4 transition-all hover:shadow-sm"
                >
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12 border-2">
                      <AvatarImage src={member.user?.image || ''} />
                      <AvatarFallback className="from-primary/20 to-primary/10 bg-gradient-to-br">
                        {member.user?.name?.charAt(0) ||
                          member.user?.email?.charAt(0)?.toUpperCase() ||
                          'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-2">
                      {/* Name and Role Badge */}
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">
                          {member.user?.name || 'User'}
                          {isCurrentUser && (
                            <span className="text-muted-foreground ml-2 text-xs">(You)</span>
                          )}
                        </p>
                        <Badge variant={getRoleBadgeVariant(member.role)} className="gap-1">
                          {member.role === 'OWNER' && <Crown className="h-3 w-3" />}
                          {member.role === 'ADMIN' && <Shield className="h-3 w-3" />}
                          {member.role}
                        </Badge>
                      </div>

                      {/* Email */}
                      <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
                        <Mail className="h-3 w-3" />
                        <span>{member.user?.email || 'No email'}</span>
                      </div>

                      {/* Permissions */}
                      {permissions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {permissions.slice(0, 3).map((permission) => (
                            <Badge
                              key={permission}
                              variant="outline"
                              className="text-xs font-normal"
                            >
                              {permission}
                            </Badge>
                          ))}
                          {permissions.length > 3 && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="text-xs font-normal">
                                    +{permissions.length - 3} more
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="space-y-1">
                                    {permissions.slice(3).map((permission) => (
                                      <div key={permission} className="text-xs">
                                        {permission}
                                      </div>
                                    ))}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      )}

                      {/* Joined Date */}
                      <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                        <Calendar className="h-3 w-3" />
                        <span>
                          Joined{' '}
                          {new Date(member.joinedAt).toLocaleDateString('en-US', {
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
                    {member.role !== 'OWNER' && !isCurrentUser && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel>Member Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() =>
                              setRemoveConfirm({
                                userId: member.userId,
                                userName: member.user?.name || member.user?.email || 'User',
                              })
                            }
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Member Dialog */}
      <AddMemberDialog
        workspaceId={workspaceId}
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
      />

      {/* Remove Confirmation Dialog */}
      <AlertDialog open={!!removeConfirm} onOpenChange={() => setRemoveConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{removeConfirm?.userName}</strong> from this
              workspace? They will lose access to all workspace resources immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMember} className="bg-destructive">
              Remove Member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
