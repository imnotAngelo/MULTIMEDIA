import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/services/api';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const { token: routeToken } = useParams();
  const navigate = useNavigate();
  const token = routeToken || searchParams.get('token') || '';
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('');
  const [destination, setDestination] = useState('/login');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Missing verification token.');
      return;
    }

    api.verifyEmail(token).then((response) => {
      if (response.success) {
        setStatus('success');
        setMessage((response.data as any)?.message || 'Your email has been verified.');
        const destination = (response.data as any)?.role === 'admin' ? '/admin/login' : '/login';
        setDestination(destination);
        setTimeout(() => navigate(destination), 1200);
      } else {
        setStatus('error');
        setMessage(response.error?.message || 'Could not verify your email.');
      }
    });
  }, [navigate, token]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.15),transparent_50%),radial-gradient(ellipse_at_bottom,rgba(14,165,233,0.10),transparent_50%)]" />
      <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full border border-violet-500/10 animate-pulse" />
      <div className="absolute -left-24 -bottom-24 h-96 w-96 rounded-full border border-fuchsia-500/10" />

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        <Card className="border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl shadow-2xl shadow-black/40 rounded-2xl">
          <CardHeader className="space-y-2 text-center pb-4 pt-6">
            <div className="flex justify-center mb-1">
              <div className={`p-3 rounded-2xl border shadow-lg ${
                status === 'verifying'
                  ? 'bg-violet-500/15 border-violet-500/30 text-violet-400 shadow-violet-500/20'
                  : status === 'success'
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 shadow-emerald-500/20'
                  : 'bg-red-500/15 border-red-500/30 text-red-400 shadow-red-500/20'
              }`}>
                {status === 'verifying' && <Loader2 className="w-8 h-8 animate-spin" />}
                {status === 'success' && <CheckCircle2 className="w-8 h-8" />}
                {status === 'error' && <XCircle className="w-8 h-8" />}
              </div>
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-white">
              {status === 'verifying' && 'Verifying your email...'}
              {status === 'success' && 'Email verified'}
              {status === 'error' && 'Verification failed'}
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs sm:text-sm">{message}</CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <Button asChild className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white h-11 rounded-xl font-medium shadow-lg shadow-violet-500/25 transition-all">
              <Link to={destination}>Go to Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
