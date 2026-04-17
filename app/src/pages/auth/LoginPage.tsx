import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff, Mail, Lock, Loader2 } from 'lucide-react';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { loginAsync, isLoading, error, user } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await loginAsync(email, password);
    if (success) {
      // Redirect based on user role
      setTimeout(() => {
        const currentUser = useAuthStore.getState().user;
        if (currentUser?.role === 'instructor') {
          navigate('/instructor/dashboard');
        } else {
          navigate('/dashboard');
        }
      }, 100);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -right-1/4 w-[800px] h-[800px] rounded-full bg-violet-500/5 blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/4 w-[600px] h-[600px] rounded-full bg-fuchsia-500/5 blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 mb-4 shadow-lg shadow-violet-500/20">
            <span className="text-white font-bold text-2xl">M</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Multimedia Learning</h1>
          <p className="text-slate-400 text-sm mt-1">Interactive Visual Effects Education</p>
        </div>

        <Card className="border-slate-800 bg-slate-900/80 backdrop-blur-xl shadow-2xl shadow-black/20">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl text-white">Welcome back</CardTitle>
            <CardDescription className="text-slate-400">
              Sign in to continue your learning journey
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300 text-sm">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-10 bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-violet-500/50 focus-visible:border-violet-500/50 h-11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300 text-sm">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pl-10 pr-10 bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-violet-500/50 focus-visible:border-violet-500/50 h-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white h-11 font-medium shadow-lg shadow-violet-500/20 transition-all"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-800"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3 bg-slate-900/80 text-slate-500">or</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/signup')}
                className="w-full border-slate-700 text-slate-300 hover:bg-slate-800/50 hover:text-white h-11 transition-all"
              >
                Create an account
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
