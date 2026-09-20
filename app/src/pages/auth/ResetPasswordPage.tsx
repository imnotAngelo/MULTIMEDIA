import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Lock, KeyRound } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AetherLogo } from '@/components/AetherLogo';
import { AetherSpinner } from '@/components/AetherSpinner';
import { ThemeToggle } from '@/components/ThemeToggle';
import { api } from '@/services/api';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const { token: routeToken } = useParams();
  const token = routeToken || searchParams.get('token') || '';
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (password !== confirmation) { setError('Passwords do not match.'); return; }
    setIsLoading(true);
    const response = await api.resetPassword(token, password, email.trim(), code.trim());
    setIsLoading(false);
    if (response.success) setMessage((response.data as any)?.message || 'Password reset successfully.');
    else setError(response.error?.message || 'Unable to reset your password.');
  };

  return (
    <div className="min-h-screen auth-ambient-page flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute right-5 top-5 z-30"><ThemeToggle /></div>
      {/* Ambient background glow */}
      <div className="absolute inset-0 auth-ambient-glow" />
      <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full border border-violet-500/10 animate-pulse" />
      <div className="absolute -left-24 -bottom-24 h-96 w-96 rounded-full border border-fuchsia-500/10" />

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        <div className="text-center mb-6">
          <div className="inline-flex mb-3">
            <AetherLogo compact />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-400">Security</p>
        </div>

        <Card className="border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl shadow-2xl shadow-black/40 rounded-2xl">
          <CardContent className="p-6 sm:p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400 mb-3 shadow-lg shadow-violet-500/20">
                <KeyRound className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Create a new password</h1>
              <p className="text-xs sm:text-sm text-slate-400">
                Choose a strong password with at least 6 characters.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!token && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="reset-account-email" className="text-slate-300 text-sm font-medium">
                      Email Address
                    </Label>
                    <Input
                      id="reset-account-email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                      placeholder="you@example.com"
                      className="bg-slate-950/70 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-2 focus-visible:ring-violet-500/30 focus-visible:border-violet-500 h-11 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reset-code" className="text-slate-300 text-sm font-medium">
                      Confirmation code
                    </Label>
                    <Input
                      id="reset-code"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      value={code}
                      onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                      required
                      placeholder="123456"
                      className="bg-slate-950/70 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-2 focus-visible:ring-violet-500/30 focus-visible:border-violet-500 h-11 rounded-xl tracking-widest text-center"
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-slate-300 text-sm font-medium">
                  New password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={6}
                    required
                    placeholder="Min. 6 characters"
                    className="pl-10 pr-10 bg-slate-950/70 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-2 focus-visible:ring-violet-500/30 focus-visible:border-violet-500 h-11 rounded-xl"
                  />
                  <button
                    type="button"
                    aria-label="Show password"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-slate-300 text-sm font-medium">
                  Confirm password
                </Label>
                <Input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  minLength={6}
                  required
                  placeholder="Repeat your password"
                  className="bg-slate-950/70 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-2 focus-visible:ring-violet-500/30 focus-visible:border-violet-500 h-11 rounded-xl"
                />
              </div>

              {message && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-sm text-emerald-400 text-center font-medium">
                  {message}{' '}
                  <Link to="/login" className="underline font-semibold hover:text-white">
                    Sign in now
                  </Link>
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-sm text-red-400 text-center font-medium">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading || (!token && (!email || code.length !== 6)) || Boolean(message)}
                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white h-11 rounded-xl font-medium shadow-lg shadow-violet-500/25 transition-all"
              >
                {isLoading ? (
                  <>
                    <AetherSpinner className="w-4 h-4 mr-2" />
                    Updating password...
                  </>
                ) : (
                  'Reset password'
                )}
              </Button>

              <div className="pt-2 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-violet-300 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to sign in
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
