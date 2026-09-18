import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Eye, EyeOff, Mail, Lock, GraduationCap, Presentation, BookOpen, FlaskConical, BarChart3 } from 'lucide-react';
import { AetherSpinner } from '@/components/AetherSpinner';
import { AetherLogo } from '@/components/AetherLogo';
import { api } from '@/services/api';

type Role = 'student' | 'instructor';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('student');
  const [showPassword, setShowPassword] = useState(false);
  const [roleMismatch, setRoleMismatch] = useState<string>('');
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  const { loginAsync, logout, isLoading, error } = useAuthStore();
  const navigate = useNavigate();
  const isUnverifiedError = /verify your email/i.test(error || '');

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    setResendMessage('');
    try {
      const response = await api.resendVerification(email);
      setResendMessage((response.data as any)?.message || response.error?.message || 'Verification email sent.');
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRoleMismatch('');
    setResendMessage('');

    const success = await loginAsync(email, password);

    if (success) {
      setTimeout(() => {
        const currentUser = useAuthStore.getState().user;
        
        if (currentUser && currentUser.role !== 'admin' && currentUser.role !== role) {
          setRoleMismatch(
            `This account is registered as ${currentUser.role}. Please select "${
              currentUser.role === 'instructor' ? 'Instructor' : 'Student'
            }" to sign in.`
          );
          logout();
          return;
        }

        if (currentUser?.role === 'instructor') {
          navigate('/instructor/dashboard');
        } else if (currentUser?.role === 'admin') {
          navigate('/admin/instructors');
        } else {
          navigate('/dashboard');
        }
      }, 100);
    }
  };

  return (
    <div className="auth-aether-page min-h-screen flex relative overflow-hidden">
      {/* Left Branding Hero Panel */}
      <section className="auth-hero-panel relative hidden md:flex md:w-[46%] lg:w-1/2 min-h-screen overflow-hidden px-8 py-10 lg:px-14 lg:py-12">
        <div className="absolute -right-24 top-16 h-72 w-72 rounded-full auth-hero-ring animate-pulse" />
        <div className="absolute -bottom-32 -left-20 h-80 w-80 rounded-full auth-hero-ring--secondary" />
        <div className="absolute inset-x-10 bottom-10 h-px auth-hero-line" />
        
        <div className="relative z-10 flex w-full flex-col justify-between">
          <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/80">
            <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)]" />
            Interactive Multimedia Learning
          </div>

          <div className="py-6 space-y-6">
            <div className="login-aether-logo w-full max-w-[560px] animate-fade-in">
              <AetherLogo />
            </div>

            <div className="space-y-3 max-w-md pt-2" />
          </div>

          <div className="max-w-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-300/70">Create. Explore. Master.</p>
            <h2 className="mt-2 text-2xl font-semibold leading-tight text-white lg:text-3xl">Your creative learning studio.</h2>
          </div>
        </div>
      </section>

      {/* Right Login Form */}
      <main className="relative z-10 flex min-h-screen w-full items-center justify-center px-5 py-10 sm:px-10 md:w-[54%] lg:w-1/2 lg:px-16">
        <div className="w-full max-w-[440px] animate-fade-in">
          <div className="mb-8 md:hidden text-center">
            <div className="mx-auto mb-4 w-44"><AetherLogo compact /></div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-400">Interactive learning</p>
          </div>

          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-400">Welcome back</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Sign in to continue</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">Pick up where you left off and keep building your creative practice.</p>
          </div>

          <Card className="auth-form-surface border border-slate-800/80 bg-slate-900/50 backdrop-blur-xl shadow-2xl shadow-black/40 rounded-2xl">
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-slate-300 text-sm font-medium">Sign in as</Label>
                  <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Sign in as">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={role === 'student'}
                      onClick={() => setRole('student')}
                      className={`flex items-center justify-center gap-2 h-11 rounded-xl border text-sm font-medium transition-all ${
                        role === 'student'
                          ? 'border-violet-500/80 bg-violet-500/15 text-white shadow-sm shadow-violet-500/30'
                          : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                      }`}
                    >
                      <GraduationCap className={`w-4 h-4 ${role === 'student' ? 'text-violet-400' : 'text-slate-500'}`} />
                      Student
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={role === 'instructor'}
                      onClick={() => setRole('instructor')}
                      className={`flex items-center justify-center gap-2 h-11 rounded-xl border text-sm font-medium transition-all ${
                        role === 'instructor'
                          ? 'border-fuchsia-500/80 bg-fuchsia-500/15 text-white shadow-sm shadow-fuchsia-500/30'
                          : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                      }`}
                    >
                      <Presentation className={`w-4 h-4 ${role === 'instructor' ? 'text-fuchsia-400' : 'text-slate-500'}`} />
                      Instructor
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-300 text-sm font-medium">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="pl-10 bg-slate-950/70 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-2 focus-visible:ring-violet-500/30 focus-visible:border-violet-500 h-11 rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-slate-300 text-sm font-medium">
                      Password
                    </Label>
                    <button
                      type="button"
                      onClick={() => navigate('/forgot-password')}
                      className="text-xs text-violet-400 hover:text-violet-300 font-medium transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="pl-10 pr-10 bg-slate-950/70 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-2 focus-visible:ring-violet-500/30 focus-visible:border-violet-500 h-11 rounded-xl"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400 space-y-2">
                    <p>{error}</p>
                    {isUnverifiedError && (
                      <button
                        type="button"
                        onClick={handleResend}
                        disabled={resending || !email}
                        className="text-red-300 underline hover:text-white disabled:opacity-50 text-xs font-medium"
                      >
                        {resending ? 'Sending...' : 'Resend verification email'}
                      </button>
                    )}
                  </div>
                )}

                {resendMessage && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-sm text-emerald-400">
                    {resendMessage}
                  </div>
                )}

                {roleMismatch && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-sm text-amber-400">
                    {roleMismatch}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full h-11 rounded-xl font-medium shadow-lg transition-all ${
                    role === 'student'
                      ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-violet-500/25'
                      : 'bg-gradient-to-r from-fuchsia-600 to-violet-600 hover:from-fuchsia-500 hover:to-violet-500 text-white shadow-fuchsia-500/25'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <AetherSpinner className="w-4 h-4 mr-2" />
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
                    <span className="px-3 bg-slate-900/90 text-slate-500 font-medium">or</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/signup')}
                  className="w-full border-slate-800 bg-slate-950/60 text-slate-300 hover:bg-slate-800/60 hover:text-white h-11 rounded-xl transition-all"
                >
                  Create an account
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
