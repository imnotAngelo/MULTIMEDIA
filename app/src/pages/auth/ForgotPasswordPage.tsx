import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, KeyRound } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AetherLogo } from '@/components/AetherLogo';
import { AetherSpinner } from '@/components/AetherSpinner';
import { ThemeToggle } from '@/components/ThemeToggle';
import { api } from '@/services/api';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setMessage('');
    setError('');
    const response = await api.forgotPassword(email.trim());
    setIsLoading(false);
    if (response.success) {
      setMessage((response.data as any)?.message || 'If an account exists, a reset link has been sent to your email.');
    } else {
      setError(response.error?.message || 'Unable to send the reset email. Please try again later.');
    }
  };

  return (
    <div className="min-h-screen auth-ambient-page flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute right-5 top-5 z-30"><ThemeToggle /></div>
      {/* Ambient background glow */}
      <div className="absolute inset-0 auth-ambient-glow" />
      <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full auth-ambient-ring animate-pulse" />
      <div className="absolute -left-24 -bottom-24 h-96 w-96 rounded-full auth-ambient-ring--secondary" />

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        <div className="text-center mb-6">
          <div className="inline-flex mb-3">
            <AetherLogo compact />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-400">Account Recovery</p>
        </div>

        <Card className="auth-card-surface rounded-2xl">
          <CardContent className="p-6 sm:p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="mx-auto w-12 h-12 rounded-2xl auth-icon-badge flex items-center justify-center mb-3">
                <KeyRound className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Forgot password?</h1>
              <p className="text-xs sm:text-sm text-slate-400">
                Enter your account email and we&apos;ll send you instructions to reset your password.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email" className="text-slate-300 text-sm font-medium">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    placeholder="you@example.com"
                    className="pl-10 bg-slate-950/70 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-2 focus-visible:ring-violet-500/30 focus-visible:border-violet-500 h-11 rounded-xl"
                  />
                </div>
              </div>

              {message && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-sm text-emerald-400 text-center font-medium">
                  {message}
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-sm text-red-400 text-center font-medium">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white h-11 rounded-xl font-medium shadow-lg shadow-violet-500/25 transition-all"
              >
                {isLoading ? (
                  <>
                    <AetherSpinner className="w-4 h-4 mr-2" />
                    Sending instructions...
                  </>
                ) : (
                  'Send Reset Instructions'
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
