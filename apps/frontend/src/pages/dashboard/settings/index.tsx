import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Settings, Users, Mail, Key } from 'lucide-react';
import { GeneralSettings } from './components/general-settings';
import { MembersSettings } from './components/members-settings';
import { InvitationsSettings } from './components/invitations-settings';
import { ApiKeysSettings } from './components/api-keys-settings';
import { useWorkspaces } from '@/hooks/use-workspaces';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

const tabs = [
  { value: 'general', label: 'General', icon: Settings },
  { value: 'members', label: 'Members', icon: Users },
  { value: 'invitations', label: 'Invitations', icon: Mail },
  { value: 'api-keys', label: 'API Keys', icon: Key },
];

export default function WorkspaceSettingsPage() {
  const { currentWorkspace, isLoading } = useWorkspaces();
  const [searchParams, setSearchParams] = useSearchParams();

  // Derive active tab from URL - no state needed!
  const activeTab = useMemo(() => {
    const urlTab = searchParams.get('tab') || 'general';
    // Validate tab exists
    return tabs.some((tab) => tab.value === urlTab) ? urlTab : 'general';
  }, [searchParams]);

  // Update URL when tab changes
  const handleTabChange = (newTab: string) => {
    setSearchParams({ tab: newTab });
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Loading workspace...</p>
      </div>
    );
  }

  if (!currentWorkspace) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No workspace selected. Please select a workspace from the sidebar.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Workspace Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm md:mt-2">
          Manage your workspace settings, members, and integrations
        </p>
      </div>

      <Card>
        <CardContent className="px-6 py-1 md:px-6 md:py-4">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            {/* Mobile: Dropdown Selector */}
            <div className="mb-6 md:hidden">
              <Select value={activeTab} onValueChange={handleTabChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <SelectItem key={tab.value} value={tab.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span>{tab.label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Desktop: Side Navigation */}
            <div className="hidden md:flex md:gap-6">
              {/* TABS ON LEFT (Desktop) */}
              <TabsList className="flex h-fit w-48 shrink-0 flex-col items-stretch justify-start space-y-1 bg-transparent p-0">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="data-[state=active]:bg-accent justify-start gap-3 rounded-lg px-3 py-2.5 data-[state=active]:shadow-sm"
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{tab.label}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {/* CONTENT ON RIGHT (Desktop) */}
              <div className="min-w-0 flex-1">
                <TabsContent value="general" className="m-0">
                  <GeneralSettings workspace={currentWorkspace} />
                </TabsContent>

                <TabsContent value="members" className="m-0">
                  <MembersSettings workspaceId={currentWorkspace.id} />
                </TabsContent>

                <TabsContent value="invitations" className="m-0">
                  <InvitationsSettings workspaceId={currentWorkspace.id} />
                </TabsContent>

                <TabsContent value="api-keys" className="m-0">
                  <ApiKeysSettings workspaceId={currentWorkspace.id} />
                </TabsContent>
              </div>
            </div>

            {/* Mobile: Full Width Content */}
            <div className="md:hidden">
              <TabsContent value="general" className="m-0">
                <GeneralSettings workspace={currentWorkspace} />
              </TabsContent>

              <TabsContent value="members" className="m-0">
                <MembersSettings workspaceId={currentWorkspace.id} />
              </TabsContent>

              <TabsContent value="invitations" className="m-0">
                <InvitationsSettings workspaceId={currentWorkspace.id} />
              </TabsContent>

              <TabsContent value="api-keys" className="m-0">
                <ApiKeysSettings workspaceId={currentWorkspace.id} />
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
