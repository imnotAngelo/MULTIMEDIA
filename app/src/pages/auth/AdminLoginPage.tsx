import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Eye, EyeOff, Mail, Lock, ShieldCheck, ArrowLeft, KeyRound, Users, ShieldAlert } from 'lucide-react';
import { AetherSpinner } from '@/components/AetherSpinner';
import { AetherLogo } from '@/components/AetherLogo';
import { api } from '@/services/api';

export function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminSecret, setAdminSecret] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    setResendMessage('');

    const success = await loginAsync(email, password, adminSecret);

    if (success) {
      setTimeout(() => {
        const currentUser = useAuthStore.getState().user;

        if (currentUser && currentUser.role !== 'admin') {
          logout();
          return;
        }

        navigate('/admin/instructors');
      }, 100);
    }
  };

  return (
    <div className="auth-aether-page min-h-screen flex relative overflow-hidden bg-slate-950">
      {/* Left Admin Hero Panel */}
      <section className="relative hidden md:flex md:w-[46%] lg:w-1/2 min-h-screen overflow-hidden bg-[#071326] px-8 py-10 lg:px-14 lg:py-12 border-r border-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_20%,rgba(6,182,212,0.18),transparent_50%),radial-gradient(ellipse_at_80%_80%,rgba(59,130,246,0.16),transparent_50%),radial-gradient(ellipse_at_50%_50%,rgba(99,102,241,0.10),transparent_60%)]" />
        <div className="absolute -right-24 top-16 h-72 w-72 rounded-full border border-cyan-500/20 animate-pulse" />
        <div className="absolute -bottom-32 -left-20 h-80 w-80 rounded-full border border-blue-500/15" />
        <div className="absolute inset-x-10 bottom-10 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />
        
        <div className="relative z-10 flex w-full flex-col justify-between">
          <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/80">
            <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)]" />
            Administration Portal
          </div>

          <div className="py-6 space-y-6">
            <div className="login-aether-logo w-full max-w-[560px] animate-fade-in">
              <AetherLogo />
            </div>

            <div className="space-y-3 max-w-md pt-2">
              <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3.5 backdrop-blur-md transition-all hover:bg-white/[0.06]">
                <div className="rounded-lg bg-cyan-500/15 p-2 text-cyan-400 shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Instructor Approvals</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Review, verify, and approve instructor onboarding requests securely.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3.5 backdrop-blur-md transition-all hover:bg-white/[0.06]">
                <div className="rounded-lg bg-blue-500/15 p-2 text-blue-400 shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">System Governance</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Role management, curriculum access enforcement, and security auditing.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3.5 backdrop-blur-md transition-all hover:bg-white/[0.06]">
                <div className="rounded-lg bg-indigo-500/15 p-2 text-indigo-400 shrink-0">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Protected Access</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Dual-factor admin secret verification protects core educational assets.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300/70">Control. Protect. Oversee.</p>
            <h2 className="mt-2 text-2xl font-semibold leading-tight text-white lg:text-3xl">Administrative governance.</h2>
          </div>
        </div>
      </section>

      {/* Right Admin Form */}
      <main className="relative z-10 flex min-h-screen w-full items-center justify-center px-5 py-10 sm:px-10 md:w-[54%] lg:w-1/2 lg:px-16 bg-slate-950">
        <div className="w-full max-w-[440px] animate-fade-in">
          <div className="mb-8 md:hidden text-center">
            <div className="mx-auto mb-4 w-44"><AetherLogo compact /></div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-400">Administration Portal</p>
          </div>

          <div className="mb-6">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-medium mb-3">
              <ShieldAlert className="w-3.5 h-3.5" />
              Restricted Area
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">Sign in as admin</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">Enter your administrator credentials and secret key to proceed.</p>
          </div>

          <Card className="auth-form-surface border border-slate-800/80 bg-slate-900/50 backdrop-blur-xl shadow-2xl shadow-black/40 rounded-2xl">
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-300 text-sm font-medium">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="admin@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="pl-10 bg-slate-950/70 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-2 focus-visible:ring-cyan-500/30 focus-visible:border-cyan-500 h-11 rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-300 text-sm font-medium">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter admin password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="pl-10 pr-10 bg-slate-950/70 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-2 focus-visible:ring-cyan-500/30 focus-visible:border-cyan-500 h-11 rounded-xl"
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

                <div className="space-y-2">
                  <Label htmlFor="adminSecret" className="text-slate-300 text-sm font-medium">
                    Admin Secret
                  </Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      id="adminSecret"
                      type="password"
                      placeholder="Enter admin secret key"
                      value={adminSecret}
                      onChange={(e) => setAdminSecret(e.target.value)}
                      required
                      className="pl-10 bg-slate-950/70 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-2 focus-visible:ring-cyan-500/30 focus-visible:border-cyan-500 h-11 rounded-xl"
                    />
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

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white h-11 rounded-xl font-medium shadow-lg shadow-cyan-500/25 transition-all"
                >
                  {isLoading ? (
                    <>
                      <AetherSpinner className="w-4 h-4 mr-2" />
                      Signing in...
                    </>
                  ) : (
                    'Admin Sign In'
                  )}
                </Button>

                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-800"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-3 bg-slate-900/90 text-slate-500 font-medium">admin access</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/admin/signup')}
                  className="w-full border-slate-800 bg-slate-950/60 text-slate-300 hover:bg-slate-800/60 hover:text-white h-11 rounded-xl transition-all"
                >
                  <ShieldCheck className="w-4 h-4 mr-2 text-cyan-400" />
                  Create admin account
                </Button>

                <div className="pt-2 text-center">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-cyan-300 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back to standard sign in
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

