import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Eye, EyeOff, Mail, Lock, GraduationCap, Presentation } from 'lucide-react';
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
      <section className="relative hidden md:flex md:w-[46%] lg:w-1/2 min-h-screen overflow-hidden bg-[#101d3d] px-8 py-10 lg:px-14 lg:py-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_20%,rgba(73,210,239,0.22),transparent_25%),radial-gradient(circle_at_82%_78%,rgba(243,118,166,0.2),transparent_28%),linear-gradient(145deg,#182b58_0%,#101b3b_48%,#0a122a_100%)]" />
        <div className="absolute -right-24 top-16 h-72 w-72 rounded-full border border-cyan-300/20 animate-pulse" />
        <div className="absolute -bottom-32 -left-20 h-80 w-80 rounded-full border border-fuchsia-300/15" />
        <div className="absolute inset-x-10 bottom-10 h-px bg-gradient-to-r from-transparent via-cyan-200/40 to-transparent" />
        <div className="relative z-10 flex w-full flex-col justify-between">
          <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-100/70">
            <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(103,232,249,0.9)]" />
            Interactive learning
          </div>
          <div className="flex flex-1 items-center justify-center py-10">
            <div className="login-aether-logo w-full max-w-[620px] animate-fade-in">
              <AetherLogo />
            </div>
          </div>
          <div className="max-w-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/60">Create. Explore. Master.</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight text-white lg:text-4xl">Your creative classroom starts here.</h2>
          </div>
        </div>
      </section>

      <main className="relative z-10 flex min-h-screen w-full items-center justify-center px-5 py-10 sm:px-10 md:w-[54%] lg:w-1/2 lg:px-16">
        <div className="w-full max-w-[440px] animate-fade-in">
          <div className="mb-8 md:hidden">
            <div className="mx-auto mb-5 w-48"><AetherLogo compact /></div>
            <p className="text-center text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Interactive learning</p>
          </div>
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Welcome back</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Sign in to continue</h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">Pick up where you left off and keep building your creative practice.</p>
          </div>

        <Card className="auth-form-surface border-0 bg-transparent shadow-none">
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-200 text-sm">Sign in as</Label>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Sign in as">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={role === 'student'}
                    onClick={() => setRole('student')}
                    className={`flex items-center justify-center gap-2 h-11 rounded-md border text-sm font-medium transition-all ${
                      role === 'student'
                        ? 'border-violet-500/60 bg-violet-500/10 text-white shadow-sm shadow-violet-500/20'
                        : 'border-slate-600/80 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <GraduationCap className="w-4 h-4 text-violet-400" />
                    Student
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={role === 'instructor'}
                    onClick={() => setRole('instructor')}
                    className={`flex items-center justify-center gap-2 h-11 rounded-md border text-sm font-medium transition-all ${
                      role === 'instructor'
                        ? 'border-fuchsia-500/60 bg-fuchsia-500/10 text-white shadow-sm shadow-fuchsia-500/20'
                        : 'border-slate-600/80 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Presentation className="w-4 h-4 text-fuchsia-400" />
                    Instructor
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-200 text-sm">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-10 bg-white/5 border-slate-600/80 text-white placeholder:text-slate-500 focus-visible:ring-cyan-400/40 focus-visible:border-cyan-400/60 h-12"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-200 text-sm">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pl-10 pr-10 bg-white/5 border-slate-600/80 text-white placeholder:text-slate-500 focus-visible:ring-cyan-400/40 focus-visible:border-cyan-400/60 h-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <button type="button" onClick={() => navigate('/forgot-password')} className="text-sm text-cyan-700 hover:text-cyan-900">
                  Forgot password?
                </button>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400 space-y-2">
                  <p>{error}</p>
                  {isUnverifiedError && (
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resending || !email}
                      className="text-red-300 underline hover:text-white disabled:opacity-50"
                    >
                      {resending ? 'Sending...' : 'Resend verification email'}
                    </button>
                  )}
                </div>
              )}

              {resendMessage && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-sm text-emerald-400">
                  {resendMessage}
                </div>
              )}

              {roleMismatch && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-sm text-amber-400">
                  {roleMismatch}
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#101d3d] hover:bg-[#1a2c55] text-white h-12 font-medium shadow-lg shadow-slate-900/15 transition-all"
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
                  <span className="px-3 bg-[#101d3d] text-slate-500">or</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/signup')}
                className="w-full border-slate-600/80 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white h-12 transition-all"
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