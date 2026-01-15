// RegisterForm.tsx - WITH PROPER ICONS
import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Github, Loader2, Eye, EyeOff, Check, X } from 'lucide-react';
import { toast } from '@/lib/toast-utils';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// Password strength calculator (0-3 scale like PostHog)
const calculatePasswordStrength = (password: string): number => {
  if (!password) return 0;

  let strength = 0;

  // Length check
  if (password.length >= 8) strength++;
  if (password.length >= 12) strength++;

  // Character variety checks
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);

  const varietyCount = [hasLower, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;

  if (varietyCount >= 2) strength++;
  if (varietyCount >= 3) strength++;

  return Math.min(strength, 3);
};

const getStrengthConfig = (strength: number) => {
  const configs = [
    { label: 'Weak', color: 'bg-red-500', bars: 1 },
    { label: 'Fair', color: 'bg-orange-500', bars: 1 },
    { label: 'Good', color: 'bg-yellow-500', bars: 2 },
    { label: 'Strong', color: 'bg-green-500', bars: 3 },
  ];
  return configs[strength];
};

export function RegisterForm({ className, ...props }: React.ComponentProps<'div'>) {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const passwordStrength = useMemo(
    () => calculatePasswordStrength(formData.password),
    [formData.password]
  );

  const strengthConfig = getStrengthConfig(passwordStrength);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.id]: e.target.value,
    }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.firstName.trim() ||
      !formData.lastName.trim() ||
      !formData.email ||
      !formData.password ||
      !formData.confirmPassword
    ) {
      toast.error('Please fill in all fields');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      await register({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        password: formData.password,
      });

      toast.success('Account created successfully!');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Register error:', error);
      const message = error.response?.data?.message || 'Registration failed';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGithubSignup = () => {
    window.location.href = `${API_URL}/auth/github`;
  };

  const handleGoogleSignup = () => {
    window.location.href = `${API_URL}/auth/google`;
  };

  return (
    <Card className={cn('w-full max-w-md', className)} {...props}>
      <CardHeader>
        <CardTitle className="text-2xl">Create an account</CardTitle>
        <CardDescription>Enter your information below to create your account</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleRegister} className="space-y-4">
          {/* First + Last Name */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                type="text"
                placeholder="John"
                value={formData.firstName}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                type="text"
                placeholder="Doe"
                value={formData.lastName}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="john.doe@example.com"
              value={formData.email}
              onChange={handleChange}
              required
              disabled={loading}
            />
          </div>

          {/* Password with visibility toggle & strength */}
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={handleChange}
                required
                disabled={loading}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
                disabled={loading}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Password Strength Indicator */}
            {formData.password && (
              <div className="space-y-1.5">
                <div className="flex gap-1">
                  {[0, 1, 2].map((index) => (
                    <div
                      key={index}
                      className={cn(
                        'h-1 flex-1 rounded-full transition-all duration-300',
                        index < strengthConfig.bars ? strengthConfig.color : 'bg-muted'
                      )}
                    />
                  ))}
                </div>
                <p className="text-muted-foreground text-xs">
                  Password strength: <span className="font-medium">{strengthConfig.label}</span>
                </p>
              </div>
            )}
          </div>

          {/* Confirm Password with visibility toggle */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                disabled={loading}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
                disabled={loading}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Match indicator with proper icons */}
            {formData.confirmPassword && (
              <p
                className={cn(
                  'flex items-center gap-1 text-xs',
                  formData.password === formData.confirmPassword
                    ? 'text-green-600 dark:text-green-500'
                    : 'text-red-600 dark:text-red-500'
                )}
              >
                {formData.password === formData.confirmPassword ? (
                  <>
                    <Check className="h-3 w-3" />
                    <span>Passwords match</span>
                  </>
                ) : (
                  <>
                    <X className="h-3 w-3" />
                    <span>Passwords do not match</span>
                  </>
                )}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              'Create Account'
            )}
          </Button>

          <div className="relative">
            <Separator />
            <span className="bg-card text-muted-foreground absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-2 text-xs">
              OR
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Button variant="outline" type="button" onClick={handleGoogleSignup} disabled={loading}>
              <svg className="mr-2 h-4 w-4" viewBox="0 0 30 30" fill="currentColor">
                <path d="M 15.003906 3 C 8.3749062 3 3 8.373 3 15 C 3 21.627 8.3749062 27 15.003906 27 C 25.013906 27 27.269078 17.707 26.330078 13 L 25 13 L 22.732422 13 L 15 13 L 15 17 L 22.738281 17 C 21.848702 20.448251 18.725955 23 15 23 C 10.582 23 7 19.418 7 15 C 7 10.582 10.582 7 15 7 C 17.009 7 18.839141 7.74575 20.244141 8.96875 L 23.085938 6.1289062 C 20.951937 4.1849063 18.116906 3 15.003906 3 z" />
              </svg>
              Google
            </Button>
            <Button variant="outline" type="button" onClick={handleGithubSignup} disabled={loading}>
              <Github className="mr-2 h-4 w-4" />
              GitHub
            </Button>
          </div>

          <p className="text-muted-foreground px-6 text-center text-sm">
            Already have an account?{' '}
            <Link to="/auth/login" className="text-primary font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export default RegisterForm;
