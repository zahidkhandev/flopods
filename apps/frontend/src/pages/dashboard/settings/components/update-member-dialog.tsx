import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useWorkspaceMembers } from '../hooks/use-workspace-members';
import { toast } from '@/lib/toast-utils';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface UpdateMemberDialogProps {
  workspaceId: string;
  member: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function UpdateMemberDialog({
  workspaceId,
  member,
  open,
  onOpenChange,
  onSuccess,
}: UpdateMemberDialogProps) {
  const { updateMember } = useWorkspaceMembers(workspaceId);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state - REMOVED canManageBilling
  const [role, setRole] = useState<string>(member?.role || 'MEMBER');
  const [permissions, setPermissions] = useState({
    canCreateCanvas: member?.canCreateCanvas ?? true,
    canDeleteCanvas: member?.canDeleteCanvas ?? false,
    canInviteMembers: member?.canInviteMembers ?? false,
    canManageMembers: member?.canManageMembers ?? false,
    canManageApiKeys: member?.canManageApiKeys ?? false,
  });

  // Reset form when member changes
  useEffect(() => {
    if (member) {
      setRole(member.role);
      setPermissions({
        canCreateCanvas: member.canCreateCanvas ?? true,
        canDeleteCanvas: member.canDeleteCanvas ?? false,
        canInviteMembers: member.canInviteMembers ?? false,
        canManageMembers: member.canManageMembers ?? false,
        canManageApiKeys: member.canManageApiKeys ?? false,
      });
    }
  }, [member]);

  // Auto-set permissions based on role
  useEffect(() => {
    if (role === 'ADMIN') {
      setPermissions({
        canCreateCanvas: true,
        canDeleteCanvas: true,
        canInviteMembers: true,
        canManageMembers: true,
        canManageApiKeys: true,
      });
    } else if (role === 'VIEWER') {
      setPermissions({
        canCreateCanvas: false,
        canDeleteCanvas: false,
        canInviteMembers: false,
        canManageMembers: false,
        canManageApiKeys: false,
      });
    }
  }, [role]);

  const handleSubmit = async () => {
    if (!member) return;

    setIsSubmitting(true);

    try {
      await updateMember(member.userId, {
        role,
        ...permissions,
      });

      toast.success('Member updated', {
        description: `Updated ${member.user.name || member.user.email}`,
      });

      onOpenChange(false);
      onSuccess?.(); // ✅ Call onSuccess to reload data
    } catch (error: any) {
      console.error('Update member error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePermission = (key: keyof typeof permissions) => {
    setPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const getRoleBadgeVariant = (roleValue: string) => {
    switch (roleValue) {
      case 'ADMIN':
        return 'default' as const;
      case 'MEMBER':
        return 'secondary' as const;
      case 'VIEWER':
        return 'outline' as const;
      default:
        return 'outline' as const;
    }
  };

  const getInitials = (name?: string, email?: string) => {
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

  if (!member) return null;

  const isRoleDisabled = role === 'ADMIN' || role === 'VIEWER';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-hidden p-0">
        <DialogHeader className="p-4 pb-0 sm:p-6 sm:pb-0">
          <DialogTitle className="text-lg sm:text-xl">Update Member</DialogTitle>
          <DialogDescription className="text-sm">
            Manage role and permissions for {member.user.name || member.user.email}
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Content */}
        <div className="max-h-[calc(90vh-180px)] space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
          {/* Member Info */}
          <div className="bg-muted flex items-center gap-3 rounded-lg p-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={member.user.image} alt={member.user.name || member.user.email} />
              <AvatarFallback className="bg-primary/10 text-primary">
                {getInitials(member.user.name, member.user.email)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{member.user.name || 'Unnamed User'}</p>
              <p className="text-muted-foreground truncate text-sm">{member.user.email}</p>
            </div>
            <Badge variant={getRoleBadgeVariant(member.role)} className="shrink-0">
              {member.role}
            </Badge>
          </div>

          <Separator />

          {/* Role Selection */}
          <div className="space-y-3">
            <Label htmlFor="role" className="text-sm font-semibold sm:text-base">
              Role
            </Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="role">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="h-5">
                      ADMIN
                    </Badge>
                    <span className="text-muted-foreground text-xs">Full access</span>
                  </div>
                </SelectItem>
                <SelectItem value="MEMBER">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="h-5">
                      MEMBER
                    </Badge>
                    <span className="text-muted-foreground text-xs">Custom permissions</span>
                  </div>
                </SelectItem>
                <SelectItem value="VIEWER">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="h-5">
                      VIEWER
                    </Badge>
                    <span className="text-muted-foreground text-xs">Read-only</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            {isRoleDisabled && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  {role === 'ADMIN'
                    ? 'Admins have all permissions'
                    : 'Viewers have read-only access'}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <Separator />

          {/* Permissions */}
          <div className="space-y-4">
            <Label className="text-sm font-semibold sm:text-base">Permissions</Label>

            {/* Canvas Permissions */}
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium sm:text-sm">Canvas</p>
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Label htmlFor="canCreateCanvas" className="cursor-pointer text-sm font-normal">
                      Can create canvas
                    </Label>
                    <p className="text-muted-foreground text-xs">Create new flows</p>
                  </div>
                  <Switch
                    id="canCreateCanvas"
                    checked={permissions.canCreateCanvas}
                    onCheckedChange={() => togglePermission('canCreateCanvas')}
                    disabled={isRoleDisabled}
                  />
                </div>

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Label htmlFor="canDeleteCanvas" className="cursor-pointer text-sm font-normal">
                      Can delete canvas
                    </Label>
                    <p className="text-muted-foreground text-xs">Delete flows</p>
                  </div>
                  <Switch
                    id="canDeleteCanvas"
                    checked={permissions.canDeleteCanvas}
                    onCheckedChange={() => togglePermission('canDeleteCanvas')}
                    disabled={isRoleDisabled}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Workspace Permissions */}
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium sm:text-sm">Workspace</p>
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Label
                      htmlFor="canInviteMembers"
                      className="cursor-pointer text-sm font-normal"
                    >
                      Can invite members
                    </Label>
                    <p className="text-muted-foreground text-xs">Send invitations</p>
                  </div>
                  <Switch
                    id="canInviteMembers"
                    checked={permissions.canInviteMembers}
                    onCheckedChange={() => togglePermission('canInviteMembers')}
                    disabled={isRoleDisabled}
                  />
                </div>

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Label
                      htmlFor="canManageMembers"
                      className="cursor-pointer text-sm font-normal"
                    >
                      Can manage members
                    </Label>
                    <p className="text-muted-foreground text-xs">Edit/remove members</p>
                  </div>
                  <Switch
                    id="canManageMembers"
                    checked={permissions.canManageMembers}
                    onCheckedChange={() => togglePermission('canManageMembers')}
                    disabled={isRoleDisabled}
                  />
                </div>

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Label
                      htmlFor="canManageApiKeys"
                      className="cursor-pointer text-sm font-normal"
                    >
                      Can manage API keys
                    </Label>
                    <p className="text-muted-foreground text-xs">Add/edit API keys</p>
                  </div>
                  <Switch
                    id="canManageApiKeys"
                    checked={permissions.canManageApiKeys}
                    onCheckedChange={() => togglePermission('canManageApiKeys')}
                    disabled={isRoleDisabled}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-row gap-2 border-t p-4 sm:p-6">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="flex-1 sm:flex-none"
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="flex-1 sm:flex-none">
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? 'Updating...' : 'Update'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
