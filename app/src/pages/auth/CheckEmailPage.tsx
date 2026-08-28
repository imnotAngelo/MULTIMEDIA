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
  const location = useLocation() as { state?: { email?: string } };
  const navigate = useNavigate();
  const [email] = useState(location.state?.email ?? '');
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
        setTimeout(() => navigate('/login'), 1200);
      } else {
        setError(response.error?.message || 'That code is incorrect or has expired.');
      }
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="border-slate-800 bg-slate-900/80 backdrop-blur-xl shadow-2xl shadow-black/20">
          <CardHeader className="space-y-1 text-center pb-4">
            <div className="flex justify-center mb-2">
              <MailCheck className="w-10 h-10 text-violet-400" />
            </div>
            <CardTitle className="text-xl text-white">Check your email</CardTitle>
            <CardDescription className="text-slate-400">
              {email
                ? `We sent a 6-digit code to ${email}. Enter it below, or click the link in the email.`
                : 'We sent a 6-digit code to your email. Enter it below, or click the link in the email.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <form onSubmit={handleVerifyCode} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="code" className="text-slate-300 text-sm">Verification code</Label>
                <Input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  className="text-center tracking-[0.5em] text-lg bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-violet-500/50 focus-visible:border-violet-500/50 h-12"
                />
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400 text-center">
                  {error}
                </div>
              )}
              {message && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-sm text-emerald-400 text-center">
                  {message}
                </div>
              )}

              <Button
                type="submit"
                disabled={verifying || code.length !== 6}
                className="w-full bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white h-11"
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
              className="w-full border-slate-700 text-slate-300 hover:bg-slate-800/50 hover:text-white h-11"
            >
              {resending ? <AetherSpinner className="w-4 h-4 mr-2" /> : null}
              Resend verification email
            </Button>
            <Button asChild variant="ghost" className="w-full text-slate-400 hover:text-white h-9">
              <Link to="/login">Back to Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

