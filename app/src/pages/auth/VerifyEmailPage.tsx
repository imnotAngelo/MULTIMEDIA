import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/services/api';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const { token: routeToken } = useParams();
  const token = routeToken || searchParams.get('token') || '';
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('');

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
      } else {
        setStatus('error');
        setMessage(response.error?.message || 'Could not verify your email.');
      }
    });
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="border-slate-800 bg-slate-900/80 backdrop-blur-xl shadow-2xl shadow-black/20">
          <CardHeader className="space-y-1 text-center pb-4">
            <div className="flex justify-center mb-2">
              {status === 'verifying' && <Loader2 className="w-10 h-10 text-violet-400 animate-spin" />}
              {status === 'success' && <CheckCircle2 className="w-10 h-10 text-emerald-400" />}
              {status === 'error' && <XCircle className="w-10 h-10 text-red-400" />}
            </div>
            <CardTitle className="text-xl text-white">
              {status === 'verifying' && 'Verifying your email...'}
              {status === 'success' && 'Email verified'}
              {status === 'error' && 'Verification failed'}
            </CardTitle>
            <CardDescription className="text-slate-400">{message}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white h-11">
              <Link to="/login">Go to Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
