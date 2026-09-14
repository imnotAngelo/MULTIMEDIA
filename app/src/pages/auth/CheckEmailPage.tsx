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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-8 text-foreground transition-colors duration-300 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.14),transparent_34%),radial-gradient(circle_at_bottom_right,hsl(var(--accent)/0.12),transparent_30%)]" />
      <div className="w-full max-w-md">
        <Card className="relative border-border/80 bg-card/85 shadow-2xl shadow-black/10 backdrop-blur-xl">
          <CardHeader className="space-y-1 text-center pb-4">
            <div className="flex justify-center mb-2">
              <div className="rounded-2xl border border-primary/20 bg-primary/10 p-3">
                <MailCheck className="h-10 w-10 text-primary" />
              </div>
            </div>
            <CardTitle className="text-xl text-foreground">Check your email</CardTitle>
            <CardDescription className="text-muted-foreground">
              {email
                ? `We sent a 6-digit code to ${email}. Enter it below, or click the link in the email.`
                : 'We sent a 6-digit code to your email. Enter it below, or click the link in the email.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <form onSubmit={handleVerifyCode} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="code" className="text-foreground text-sm">Verification code</Label>
                <Input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  className="h-12 border-input bg-background/70 text-center text-lg tracking-[0.5em] text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/50"
                />
              </div>

              {error && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-center text-sm text-destructive">
                  {error}
                </div>
              )}
              {message && (
                <div className="rounded-lg border border-primary/20 bg-primary/10 p-3 text-center text-sm text-primary">
                  {message}
                </div>
              )}

              <Button
                type="submit"
                disabled={verifying || code.length !== 6}
                className="h-11 w-full bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90"
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
              className="h-11 w-full border-border text-foreground hover:bg-accent hover:text-accent-foreground"
            >
              {resending ? <AetherSpinner className="w-4 h-4 mr-2" /> : null}
              Resend verification email
            </Button>
            <Button asChild variant="ghost" className="h-9 w-full text-muted-foreground hover:text-foreground">
              <Link to="/login">Back to Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

