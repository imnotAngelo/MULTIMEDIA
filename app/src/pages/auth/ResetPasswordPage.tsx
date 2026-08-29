import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Lock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AetherLogo } from '@/components/AetherLogo';
import { AetherSpinner } from '@/components/AetherSpinner';
import { api } from '@/services/api';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
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
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8"><div className="inline-flex mb-4"><AetherLogo /></div><h1 className="text-2xl font-bold text-white">Multimedia Learning</h1></div>
        <Card className="border-slate-800 bg-slate-900/80 backdrop-blur-xl">
          <CardHeader><CardTitle className="text-xl text-white">Create a new password</CardTitle><CardDescription className="text-slate-400">Choose a password with at least 6 characters.</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!token && <>
                <div className="space-y-2"><Label htmlFor="reset-account-email" className="text-slate-300">Email</Label><Input id="reset-account-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="bg-slate-800/60 border-slate-700 text-white" /></div>
                <div className="space-y-2"><Label htmlFor="reset-code" className="text-slate-300">Confirmation code</Label><Input id="reset-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} required className="bg-slate-800/60 border-slate-700 text-white" /></div>
              </>}
              <div className="space-y-2"><Label htmlFor="new-password" className="text-slate-300">New password</Label><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" /><Input id="new-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required className="pl-10 pr-10 bg-slate-800/60 border-slate-700 text-white" /><button type="button" aria-label="Show password" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div></div>
              <div className="space-y-2"><Label htmlFor="confirm-password" className="text-slate-300">Confirm password</Label><Input id="confirm-password" type={showPassword ? 'text' : 'password'} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={6} required className="bg-slate-800/60 border-slate-700 text-white" /></div>
              {message && <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-400">{message} <Link to="/login" className="underline">Sign in</Link></div>}
              {error && <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>}
              <Button type="submit" disabled={isLoading || (!token && (!email || code.length !== 6)) || Boolean(message)} className="w-full bg-violet-600 hover:bg-violet-500 text-white h-11">{isLoading ? <><AetherSpinner className="w-4 h-4 mr-2" />Updating...</> : 'Reset password'}</Button>
              <Link to="/login" className="flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft className="w-4 h-4" />Back to sign in</Link>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
