import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Building2,
  Shield,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { axiosInstance } from '@/lib/axios-instance';
import { toast } from '@/lib/toast-utils';
import { useAuth } from '@/hooks/use-auth';
import { motion } from 'framer-motion';

interface InvitationDetails {
  workspace: {
    id: string;
    name: string;
    type: string;
  };
  email: string;
  role: string;
  expiresAt: string;
}

export default function AcceptInvitationPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const fetchInvitationDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await axiosInstance.get(`/workspaces/invitations/${token}/details`);
      const data = response.data?.data || response.data;

      setInvitation(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid invitation');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      sessionStorage.setItem('pendingInvitation', token || '');
      const returnUrl = `/workspace/invite/${token}`; // ✅ Fixed path
      navigate(`/auth/login?returnUrl=${encodeURIComponent(returnUrl)}`);
      return;
    }

    fetchInvitationDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isAuthenticated, authLoading]);

  const handleAccept = async () => {
    if (!token) return;

    try {
      setIsAccepting(true);
      await axiosInstance.post(`/workspaces/invitations/${token}/accept`);

      toast.success('Welcome!', {
        description: `Joined ${invitation?.workspace.name}`,
      });

      setSuccess(true);

      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to accept';
      toast.error('Failed', {
        description: errorMessage,
      });
      setError(errorMessage);
    } finally {
      setIsAccepting(false);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    if (role === 'ADMIN') return 'default' as const;
    if (role === 'MEMBER') return 'secondary' as const;
    return 'outline' as const;
  };

  // Loading State
  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-3">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-full" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error State
  if (error && !invitation) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Card className="border-destructive/50">
            <CardHeader className="text-center">
              <div className="bg-destructive/10 mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full">
                <XCircle className="text-destructive h-6 w-6" />
              </div>
              <CardTitle>Invalid Invitation</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => navigate('/dashboard')}>
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Success State
  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <Card className="border-green-500/50">
            <CardHeader className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-500" />
              </div>
              <CardTitle>Welcome! 🎉</CardTitle>
              <CardDescription>Joined {invitation?.workspace.name}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted flex items-center justify-center gap-2 rounded-lg p-3">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-muted-foreground text-sm">Redirecting...</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  const isExpired = invitation && new Date(invitation.expiresAt) < new Date();
  const emailMismatch = user?.email !== invitation?.email;

  // Main Invitation Card
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Card>
          <CardHeader className="text-center">
            <div className="bg-primary/10 mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full">
              <Building2 className="text-primary h-6 w-6" />
            </div>
            <CardTitle className="text-xl">{invitation?.workspace.name}</CardTitle>
            <CardDescription>
              {invitation?.workspace.type === 'TEAM' ? 'Team Workspace' : 'Workspace'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Role Badge */}
            <div className="bg-muted flex items-center justify-between rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Shield className="text-muted-foreground h-4 w-4" />
                <span className="text-muted-foreground text-sm">Your Role</span>
              </div>
              <Badge variant={getRoleBadgeVariant(invitation?.role || '')}>
                {invitation?.role}
              </Badge>
            </div>

            {/* Warnings */}
            {isExpired && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">Invitation expired</AlertDescription>
              </Alert>
            )}

            {emailMismatch && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Sent to <strong>{invitation?.email}</strong>
                  <br />
                  You&apos;re signed in as <strong>{user?.email}</strong>
                </AlertDescription>
              </Alert>
            )}

            {/* Actions */}
            <div className="space-y-2 pt-2">
              <Button
                className="w-full"
                size="lg"
                onClick={handleAccept}
                disabled={isExpired || isAccepting || emailMismatch}
              >
                {isAccepting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Accepting...
                  </>
                ) : (
                  <>
                    Accept Invitation
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>

              <Button
                variant="ghost"
                className="w-full"
                onClick={() => navigate('/dashboard')}
                disabled={isAccepting}
              >
                Decline
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
