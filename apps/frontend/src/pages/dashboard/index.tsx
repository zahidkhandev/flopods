import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Welcome back, {user?.name || user?.email}!</h1>
        <p className="text-muted-foreground">
          Here&apos;s what&apos;s happening with your workspace
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="space-y-2">
            <div>
              <p className="text-sm font-medium">Email</p>
              <p className="text-muted-foreground text-sm">{user?.email}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Name</p>
              <p className="text-muted-foreground text-sm">{user?.name || 'Not set'}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Member since</p>
              <p className="text-muted-foreground text-sm">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workspaces</CardTitle>
            <CardDescription>Your active workspaces</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">0</p>
            <p className="text-muted-foreground text-sm">No workspaces yet</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Canvases</CardTitle>
            <CardDescription>Your AI workflows</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">0</p>
            <p className="text-muted-foreground text-sm">No canvases yet</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
