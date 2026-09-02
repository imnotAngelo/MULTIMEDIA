import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff, Mail, Lock, User, GraduationCap, Presentation, X } from 'lucide-react';
import { AetherSpinner } from '@/components/AetherSpinner';

const ACADEMIC_YEAR_OPTIONS: Array<{ value: 1 | 2 | 3; label: string }> = [
  { value: 1, label: '1st Sem' },
  { value: 2, label: '2nd Sem' },
  { value: 3, label: 'Summer' },
];

export function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'student' | 'instructor'>('student');
  const [yearLevel, setYearLevel] = useState<1 | 2 | 3>(1);
  const [section, setSection] = useState('');
  const [teachingYearLevels, setTeachingYearLevels] = useState<(1 | 2 | 3)[]>([]);
  const [teachingSections, setTeachingSections] = useState<string[]>([]);
  const [sectionInput, setSectionInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState('');
  const { registerAsync, isLoading, error } = useAuthStore();
  const navigate = useNavigate();

  const toggleTeachingYear = (level: 1 | 2 | 3) => {
    setTeachingYearLevels((current) =>
      current.includes(level) ? current.filter((l) => l !== level) : [...current, level].sort()
    );
  };

  const addTeachingSection = () => {
    const trimmed = sectionInput.trim();
    if (!trimmed) return;
    setTeachingSections((current) => (current.includes(trimmed) ? current : [...current, trimmed]));
    setSectionInput('');
  };

  const removeTeachingSection = (value: string) => {
    setTeachingSections((current) => current.filter((s) => s !== value));
  };

  const handleSectionInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTeachingSection();
    }
  };

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

    if (role === 'instructor') {
      if (teachingYearLevels.length === 0) {
        setValidationError('Select at least one academic semester/term you teach');
        return;
      }
      if (teachingSections.length === 0) {
        setValidationError('Add at least one section you handle');
        return;
      }
    } else if (!section.trim()) {
      setValidationError('Section is required');
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const success = role === 'instructor'
      ? await registerAsync(
          normalizedEmail,
          password,
          fullName.trim(),
          role,
          teachingYearLevels[0],
          teachingSections[0],
          teachingYearLevels,
          teachingSections
        )
      : await registerAsync(normalizedEmail, password, fullName.trim(), role, yearLevel, section.trim());
    if (success) {
      navigate('/check-email', { state: { email: normalizedEmail } });
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
                <Label htmlFor="role" className="text-slate-300 text-sm">
                  I am a
                </Label>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Account type">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={role === 'student'}
                    onClick={() => setRole('student')}
                    className={`flex items-center justify-center gap-2 h-11 rounded-md border text-sm font-medium transition-all ${
                      role === 'student'
                        ? 'border-violet-500/60 bg-violet-500/10 text-white shadow-sm shadow-violet-500/20'
                        : 'border-slate-700 bg-slate-800/40 text-slate-300 hover:bg-slate-800/70 hover:text-white'
                    }`}
                  >
                    <GraduationCap className="w-4 h-4 text-violet-400" />
                    Student
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={role === 'instructor'}
                    onClick={() => setRole('instructor')}
                    className={`flex items-center justify-center gap-2 h-11 rounded-md border text-sm font-medium transition-all ${
                      role === 'instructor'
                        ? 'border-fuchsia-500/60 bg-fuchsia-500/10 text-white shadow-sm shadow-fuchsia-500/20'
                        : 'border-slate-700 bg-slate-800/40 text-slate-300 hover:bg-slate-800/70 hover:text-white'
                    }`}
                  >
                    <Presentation className="w-4 h-4 text-fuchsia-400" />
                    Instructor
                  </button>
                </div>
              </div>

              {role === 'student' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="yearLevel" className="text-slate-300 text-sm">
                      Academic School Year
                    </Label>
                    <select
                      id="yearLevel"
                      value={yearLevel}
                      onChange={(e) => setYearLevel(Number(e.target.value) as 1 | 2 | 3)}
                      className="h-11 w-full rounded-md border border-slate-700 bg-slate-800/60 px-3 text-sm text-white focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                    >
                      <option value={1}>1st Sem</option>
                      <option value={2}>2nd Sem</option>
                      <option value={3}>Summer</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="section" className="text-slate-300 text-sm">
                      Section
                    </Label>
                    <Input
                      id="section"
                      type="text"
                      placeholder="e.g. A"
                      value={section}
                      onChange={(e) => setSection(e.target.value)}
                      maxLength={50}
                      required
                      className="bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-violet-500/50 focus-visible:border-violet-500/50 h-11"
                    />
                    <p className="text-xs text-slate-500">
                      Your account will need approval from the instructor assigned to this section and term before you can sign in.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300 text-sm">Academic Semesters You Teach</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {ACADEMIC_YEAR_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          aria-pressed={teachingYearLevels.includes(opt.value)}
                          onClick={() => toggleTeachingYear(opt.value)}
                          className={`h-11 rounded-md border text-sm font-medium transition-all ${
                            teachingYearLevels.includes(opt.value)
                              ? 'border-fuchsia-500/60 bg-fuchsia-500/10 text-white shadow-sm shadow-fuchsia-500/20'
                              : 'border-slate-700 bg-slate-800/40 text-slate-300 hover:bg-slate-800/70 hover:text-white'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500">Select every academic term/semester you handle.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="teachingSections" className="text-slate-300 text-sm">
                      Sections You Handle
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="teachingSections"
                        type="text"
                        placeholder="e.g. A, then press Enter"
                        value={sectionInput}
                        onChange={(e) => setSectionInput(e.target.value)}
                        onKeyDown={handleSectionInputKeyDown}
                        maxLength={50}
                        className="bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-violet-500/50 focus-visible:border-violet-500/50 h-11"
                      />
                      <Button
                        type="button"
                        onClick={addTeachingSection}
                        variant="outline"
                        className="h-11 border-slate-700 text-slate-200 hover:bg-slate-800/70"
                      >
                        Add
                      </Button>
                    </div>
                    {teachingSections.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {teachingSections.map((s) => (
                          <span
                            key={s}
                            className="flex items-center gap-1 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1 text-xs text-fuchsia-200"
                          >
                            {s}
                            <button
                              type="button"
                              onClick={() => removeTeachingSection(s)}
                              aria-label={`Remove section ${s}`}
                              className="text-fuchsia-300 hover:text-white"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-slate-500">
                      Add every section you handle. Students in these sections and terms will need your approval.
                    </p>
                  </div>
                </div>
              )}

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
                    <AetherSpinner className="w-4 h-4 mr-2" />
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
