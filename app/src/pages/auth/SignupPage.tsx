import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, EyeOff, Mail, Lock, User, Loader2, GraduationCap, Presentation } from 'lucide-react';

export function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'student' | 'instructor'>('student');
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

    const success = await registerAsync(email, password, fullName, role);
    if (success) {
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/4 w-[800px] h-[800px] rounded-full bg-fuchsia-500/5 blur-3xl" />
        <div className="absolute -bottom-1/2 -right-1/4 w-[600px] h-[600px] rounded-full bg-violet-500/5 blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 mb-4 shadow-lg shadow-violet-500/20">
            <span className="text-white font-bold text-2xl">M</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Join the Community</h1>
          <p className="text-slate-400 text-sm mt-1">Create your learning account</p>
        </div>

        <Card className="border-slate-800 bg-slate-900/80 backdrop-blur-xl shadow-2xl shadow-black/20">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl text-white">Create Account</CardTitle>
            <CardDescription className="text-slate-400">
              Fill in your details to get started
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
                    placeholder="Juan Dela Cruz"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="pl-10 bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-violet-500/50 focus-visible:border-violet-500/50 h-11"
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
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-10 bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-violet-500/50 focus-visible:border-violet-500/50 h-11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role" className="text-slate-300 text-sm">
                  I am a
                </Label>
                <Select value={role} onValueChange={(value: any) => setRole(value)}>
                  <SelectTrigger className="bg-slate-800/60 border-slate-700 text-white h-11 focus:ring-violet-500/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="student">
                      <span className="flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-violet-400" />
                        Student
                      </span>
                    </SelectItem>
                    <SelectItem value="instructor">
                      <span className="flex items-center gap-2">
                        <Presentation className="w-4 h-4 text-fuchsia-400" />
                        Instructor
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
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
                    placeholder="Min. 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pl-10 pr-10 bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-violet-500/50 focus-visible:border-violet-500/50 h-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
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
                    placeholder="Repeat your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="pl-10 bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-violet-500/50 focus-visible:border-violet-500/50 h-11"
                  />
                </div>
              </div>

              {validationError && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-sm text-amber-400 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                  {validationError}
                </div>
              )}

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white h-11 font-medium shadow-lg shadow-violet-500/20 transition-all"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  'Create Account'
                )}
              </Button>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-800"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3 bg-slate-900/80 text-slate-500">already have an account?</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/login')}
                className="w-full border-slate-700 text-slate-300 hover:bg-slate-800/50 hover:text-white h-11 transition-all"
              >
                Sign In
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
