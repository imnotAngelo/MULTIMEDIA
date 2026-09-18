import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AetherSpinner } from '@/components/AetherSpinner';
import { api } from '@/services/api';

export function CheckEmailPage() {
  const location = useLocation() as { state?: { email?: string; isAdmin?: boolean } };
  const navigate = useNavigate();
  const [email] = useState(location.state?.email ?? '');
  const isAdmin = location.state?.isAdmin ?? false;
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    setMessage('');
    setError('');
    try {
      const response = await api.resendVerification(email);
      setMessage((response.data as any)?.message || response.error?.message || 'Verification email sent.');
    } finally {
      setResending(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !code.trim()) return;
    setVerifying(true);
    setMessage('');
    setError('');
    try {
      const response = await api.verifyEmailCode(email, code.trim());
      if (response.success) {
        setMessage((response.data as any)?.message || 'Email verified. Redirecting to sign in...');
        setTimeout(() => navigate(isAdmin ? '/admin/login' : '/login'), 1200);
      } else {
        setError(response.error?.message || 'That code is incorrect or has expired.');
      }
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-8 text-white sm:px-6">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.15),transparent_50%),radial-gradient(ellipse_at_bottom,rgba(14,165,233,0.10),transparent_50%)]" />
      <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full border border-violet-500/10 animate-pulse" />
      <div className="absolute -left-24 -bottom-24 h-96 w-96 rounded-full border border-fuchsia-500/10" />

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        <Card className="relative border border-slate-800/80 bg-slate-900/60 shadow-2xl shadow-black/40 backdrop-blur-xl rounded-2xl">
          <CardHeader className="space-y-2 text-center pb-4 pt-6">
            <div className="flex justify-center mb-1">
              <div className="rounded-2xl border border-violet-500/30 bg-violet-500/15 p-3 text-violet-400 shadow-lg shadow-violet-500/20">
                <MailCheck className="h-9 w-9" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-white">Check your email</CardTitle>
            <CardDescription className="text-slate-400 text-xs sm:text-sm">
              {email
                ? `We sent a 6-digit confirmation code to ${email}. Enter it below or click the link in your email.`
                : 'We sent a 6-digit confirmation code to your email. Enter it below or click the link in your email.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-6 pt-0">
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code" className="text-slate-300 text-sm font-medium">Verification Code</Label>
                <Input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  className="h-12 border-slate-800 bg-slate-950/70 text-center text-xl tracking-[0.5em] text-white placeholder:text-slate-600 focus-visible:ring-2 focus-visible:ring-violet-500/30 focus-visible:border-violet-500 rounded-xl font-mono"
                />
              </div>

              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-center text-sm text-red-400">
                  {error}
                </div>
              )}
              {message && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-center text-sm text-emerald-400">
                  {message}
                </div>
              )}

              <Button
                type="submit"
                disabled={verifying || code.length !== 6}
                className="h-11 w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl font-medium shadow-lg shadow-violet-500/25 transition-all"
              >
                {verifying ? <AetherSpinner className="w-4 h-4 mr-2" /> : null}
                Verify code
              </Button>
            </form>

            <Button
              type="button"
              variant="outline"
              onClick={handleResend}
              disabled={resending || !email}
              className="h-11 w-full border-slate-800 bg-slate-950/60 text-slate-300 hover:bg-slate-800/60 hover:text-white rounded-xl transition-all"
            >
              {resending ? <AetherSpinner className="w-4 h-4 mr-2" /> : null}
              Resend verification email
            </Button>
            <Button asChild variant="ghost" className="h-9 w-full text-slate-400 hover:text-white">
              <Link to={isAdmin ? '/admin/login' : '/login'}>Back to Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

