import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff, Mail, Lock, User, ShieldCheck, ArrowLeft } from 'lucide-react';
import { AetherSpinner } from '@/components/AetherSpinner';
import { AetherLogo } from '@/components/AetherLogo';

export function AdminSignupPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [adminSecret, setAdminSecret] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState('');
  const { registerAsync, isLoading, error } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (password !== confirmPassword) {
      setValidationError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setValidationError('Password must be at least 6 characters');
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const success = await registerAsync(normalizedEmail, password, fullName.trim(), 'admin', 1, 'admin', undefined, undefined, adminSecret);

    if (success) {
      navigate('/check-email', { state: { email: normalizedEmail } });
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
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/60">Create admin access</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight text-white lg:text-4xl">Build the administrative account securely.</h2>
          </div>
        </div>
      </section>

      <main className="relative z-10 flex min-h-screen w-full items-center justify-center overflow-y-auto px-5 py-10 sm:px-10 md:w-[54%] lg:w-1/2 lg:px-16">
        <div className="w-full max-w-[520px] animate-fade-in">
          <div className="mb-8 md:hidden">
            <div className="mx-auto mb-5 w-48"><AetherLogo compact /></div>
            <p className="text-center text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Interactive learning</p>
          </div>

          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Admin signup</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Create admin account</h1>
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate('/admin/login')}
              className="text-slate-300 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </div>

          <Card className="auth-form-surface border-0 bg-transparent backdrop-blur-xl shadow-2xl shadow-black/20">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-xl text-white">Admin Account</CardTitle>
              <CardDescription className="text-slate-400">
                Create the secure administrator profile for the system.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-slate-300 text-sm">
                    Full Name
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Admin User"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      className="pl-10 bg-slate-800/60 border-slate-700 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/40 focus-visible:border-cyan-400/60 h-11"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-300 text-sm">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="admin@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="pl-10 bg-slate-800/60 border-slate-700 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/40 focus-visible:border-cyan-400/60 h-11"
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
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="pl-10 pr-10 bg-slate-800/60 border-slate-700 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/40 focus-visible:border-cyan-400/60 h-11"
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

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-slate-300 text-sm">
                    Confirm Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      id="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Confirm password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="pl-10 bg-slate-800/60 border-slate-700 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/40 focus-visible:border-cyan-400/60 h-11"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adminSecret" className="text-slate-300 text-sm">
                    Admin Secret
                  </Label>
                  <div className="relative">
                    <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      id="adminSecret"
                      type="password"
                      placeholder="Enter admin secret"
                      value={adminSecret}
                      onChange={(e) => setAdminSecret(e.target.value)}
                      required
                      className="pl-10 bg-slate-800/60 border-slate-700 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/40 focus-visible:border-cyan-400/60 h-11"
                    />
                  </div>
                </div>

                {validationError && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-sm text-amber-400">
                    {validationError}
                  </div>
                )}

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 h-12 font-semibold shadow-lg shadow-cyan-500/20 transition-all"
                >
                  {isLoading ? (
                    <>
                      <AetherSpinner className="w-4 h-4 mr-2" />
                      Creating account...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 mr-2" />
                      Create admin account
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
