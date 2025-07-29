import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Shield, Users, Trophy } from 'lucide-react';

const Auth = () => {
  const { user, signIn, signUp, signInWithGoogle, resetPassword, updatePassword } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [searchParams] = useSearchParams();
  const isResetMode = searchParams.get('mode') === 'reset';
  
  // Redirect if already authenticated
  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    
    const { error } = await signIn(email, password);
    
    if (error) {
      toast({
        title: "Sign in failed",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Welcome back!",
        description: "You have successfully signed in."
      });
    }
    
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const displayName = formData.get('displayName') as string;
    
    const { error } = await signUp(email, password, displayName);
    
    if (error) {
      toast({
        title: "Sign up failed",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Account created!",
        description: "Please check your email to verify your account."
      });
    }
    
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    const { error } = await signInWithGoogle();
    
    if (error) {
      toast({
        title: "Sign in failed",
        description: error.message,
        variant: "destructive"
      });
      setLoading(false);
    }
    // Note: Don't set loading to false on success as user will be redirected
  };

  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setResetLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    
    const { error } = await resetPassword(email);
    
    if (error) {
      toast({
        title: "Reset failed",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Reset email sent",
        description: "Check your email for password reset instructions."
      });
      setShowForgotPassword(false);
    }
    
    setResetLoading(false);
  };

  const handlePasswordUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;
    
    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are the same.",
        variant: "destructive"
      });
      setLoading(false);
      return;
    }
    
    const { error } = await updatePassword(password);
    
    if (error) {
      toast({
        title: "Password update failed",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Password updated!",
        description: "Your password has been successfully updated."
      });
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl flex gap-8">
        {/* Hero Section */}
        <div className="hidden lg:flex flex-col justify-center flex-1 text-left">
          <h1 className="text-4xl font-bold text-primary mb-4">
            Last Person Standing (LPS)
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Test your Premier League knowledge in the ultimate survival game
          </p>
          
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Shield className="text-primary" size={20} />
              <span>Pick a team each gameweek</span>
            </div>
            <div className="flex items-center gap-3">
              <Users className="text-primary" size={20} />
              <span>Compete with friends</span>
            </div>
            <div className="flex items-center gap-3">
              <Trophy className="text-primary" size={20} />
              <span>Last player standing wins</span>
            </div>
          </div>
        </div>

        {/* Auth Form */}
        <div className="flex-1 max-w-md">
          <Card className="border-border/50 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl text-center">Join the Game</CardTitle>
              <CardDescription className="text-center">
                Sign in to your account or create a new one
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isResetMode ? (
                // Password Reset Mode
                <div className="space-y-4">
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-semibold">Reset Your Password</h3>
                    <p className="text-sm text-muted-foreground">
                      Enter your new password below
                    </p>
                  </div>
                  <form onSubmit={handlePasswordUpdate} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-password">New Password</Label>
                      <Input
                        id="new-password"
                        name="password"
                        type="password"
                        placeholder="Enter new password"
                        required
                        minLength={6}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirm Password</Label>
                      <Input
                        id="confirm-password"
                        name="confirmPassword"
                        type="password"
                        placeholder="Confirm new password"
                        required
                        minLength={6}
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? "Updating..." : "Update Password"}
                    </Button>
                  </form>
                </div>
              ) : showForgotPassword ? (
                // Forgot Password Mode
                <div className="space-y-4">
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-semibold">Reset Password</h3>
                    <p className="text-sm text-muted-foreground">
                      Enter your email to receive a password reset link
                    </p>
                  </div>
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="reset-email">Email</Label>
                      <Input
                        id="reset-email"
                        name="email"
                        type="email"
                        placeholder="Enter your email"
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={resetLoading}>
                      {resetLoading ? "Sending..." : "Send Reset Link"}
                    </Button>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      className="w-full"
                      onClick={() => setShowForgotPassword(false)}
                    >
                      Back to Sign In
                    </Button>
                  </form>
                </div>
              ) : (
                // Normal Auth Mode
                <>
                  {/* Google OAuth Button */}
                  <div className="space-y-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="w-full" 
                      onClick={handleGoogleSignIn}
                      disabled={loading}
                    >
                      <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="currentColor"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      {loading ? "Signing in..." : "Continue with Google"}
                    </Button>
                    
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <Separator />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">
                          Or continue with email
                        </span>
                      </div>
                    </div>
                  </div>

                  <Tabs defaultValue="signin" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="signin">Sign In</TabsTrigger>
                      <TabsTrigger value="signup">Sign Up</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="signin">
                      <form onSubmit={handleSignIn} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="signin-email">Email</Label>
                          <Input
                            id="signin-email"
                            name="email"
                            type="email"
                            placeholder="Enter your email"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="signin-password">Password</Label>
                          <Input
                            id="signin-password"
                            name="password"
                            type="password"
                            placeholder="Enter your password"
                            required
                          />
                        </div>
                        <Button type="submit" className="w-full" disabled={loading}>
                          {loading ? "Signing in..." : "Sign In"}
                        </Button>
                        <Button 
                          type="button" 
                          variant="link" 
                          className="w-full p-0 h-auto"
                          onClick={() => setShowForgotPassword(true)}
                        >
                          Forgot your password?
                        </Button>
                      </form>
                    </TabsContent>
                    
                    <TabsContent value="signup">
                      <form onSubmit={handleSignUp} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="signup-name">Display Name</Label>
                          <Input
                            id="signup-name"
                            name="displayName"
                            type="text"
                            placeholder="Your display name"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="signup-email">Email</Label>
                          <Input
                            id="signup-email"
                            name="email"
                            type="email"
                            placeholder="Enter your email"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="signup-password">Password</Label>
                          <Input
                            id="signup-password"
                            name="password"
                            type="password"
                            placeholder="Create a password"
                            required
                            minLength={6}
                          />
                        </div>
                        <Button type="submit" className="w-full" disabled={loading}>
                          {loading ? "Creating account..." : "Create Account"}
                        </Button>
                      </form>
                    </TabsContent>
                  </Tabs>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Auth;