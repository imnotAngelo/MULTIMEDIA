import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AetherLogo } from '@/components/AetherLogo';
import { AetherSpinner } from '@/components/AetherSpinner';
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
      setMessage((response.data as any)?.message || 'If an account exists, a reset link has been sent.');
    } else {
      setError(response.error?.message || 'Unable to send the reset email. Please try again later.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8"><div className="inline-flex mb-4"><AetherLogo /></div><h1 className="text-2xl font-bold text-white">Multimedia Learning</h1></div>
        <Card className="border-slate-800 bg-slate-900/80 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-xl text-white">Forgot your password?</CardTitle>
            <CardDescription className="text-slate-400">Enter your email and we will send you a secure reset link.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2"><Label htmlFor="reset-email" className="text-slate-300">Email</Label><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" /><Input id="reset-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="you@example.com" className="pl-10 bg-slate-800/60 border-slate-700 text-white" /></div></div>
              {message && <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-400">{message}</div>}
              {error && <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>}
              <Button type="submit" disabled={isLoading} className="w-full bg-violet-600 hover:bg-violet-500 text-white h-11">{isLoading ? <><AetherSpinner className="w-4 h-4 mr-2" />Sending...</> : 'Send reset link'}</Button>
              <Link to="/login" className="flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft className="w-4 h-4" />Back to sign in</Link>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
