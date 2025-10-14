import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { useWorkspaceInvitations } from '../hooks/use-workspace-invitations';
import { SendInvitationDto } from '../types/settings.types';

interface SendInvitationDialogProps {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SendInvitationDialog({
  workspaceId,
  open,
  onOpenChange,
}: SendInvitationDialogProps) {
  const { sendInvitation } = useWorkspaceInvitations(workspaceId);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<SendInvitationDto & { permissions: any }>({
    email: '',
    role: 'MEMBER',
    permissions: {
      canCreateCanvas: true,
      canDeleteCanvas: false,
      canInviteMembers: false,
      canManageMembers: false,
      canManageApiKeys: false,
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await sendInvitation(formData);
      onOpenChange(false);
      setFormData({
        email: '',
        role: 'MEMBER',
        permissions: {
          canCreateCanvas: true,
          canDeleteCanvas: false,
          canInviteMembers: false,
          canManageMembers: false,
          canManageApiKeys: false,
        },
      });
    } catch {
      // Error handled in hook
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Send Invitation</DialogTitle>
            <DialogDescription>Invite someone to join this workspace via email</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role *</Label>
              <Select
                value={formData.role}
                onValueChange={(value: any) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MEMBER">Member</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="VIEWER">Viewer</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">Invitation expires in 7 days</p>
            </div>

            <div className="space-y-3 rounded-lg border p-4">
              <p className="text-sm font-medium">Permissions</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="canCreateCanvas" className="font-normal">
                    Create Flows
                  </Label>
                  <Switch
                    id="canCreateCanvas"
                    checked={formData.permissions.canCreateCanvas}
                    onCheckedChange={(checked) =>
                      setFormData({
                        ...formData,
                        permissions: { ...formData.permissions, canCreateCanvas: checked },
                      })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="canDeleteCanvas" className="font-normal">
                    Delete Flows
                  </Label>
                  <Switch
                    id="canDeleteCanvas"
                    checked={formData.permissions.canDeleteCanvas}
                    onCheckedChange={(checked) =>
                      setFormData({
                        ...formData,
                        permissions: { ...formData.permissions, canDeleteCanvas: checked },
                      })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="canInviteMembers" className="font-normal">
                    Invite Members
                  </Label>
                  <Switch
                    id="canInviteMembers"
                    checked={formData.permissions.canInviteMembers}
                    onCheckedChange={(checked) =>
                      setFormData({
                        ...formData,
                        permissions: { ...formData.permissions, canInviteMembers: checked },
                      })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="canManageMembers" className="font-normal">
                    Manage Members
                  </Label>
                  <Switch
                    id="canManageMembers"
                    checked={formData.permissions.canManageMembers}
                    onCheckedChange={(checked) =>
                      setFormData({
                        ...formData,
                        permissions: { ...formData.permissions, canManageMembers: checked },
                      })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="canManageApiKeys" className="font-normal">
                    Manage API Keys
                  </Label>
                  <Switch
                    id="canManageApiKeys"
                    checked={formData.permissions.canManageApiKeys}
                    onCheckedChange={(checked) =>
                      setFormData({
                        ...formData,
                        permissions: { ...formData.permissions, canManageApiKeys: checked },
                      })
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
