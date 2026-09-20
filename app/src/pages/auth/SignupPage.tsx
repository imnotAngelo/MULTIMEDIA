import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Eye, EyeOff, Mail, Lock, User, GraduationCap, Presentation, X, BookOpen, FlaskConical, BarChart3, CheckCircle2 } from 'lucide-react';
import { AetherSpinner } from '@/components/AetherSpinner';
import { AetherLogo } from '@/components/AetherLogo';
import { ThemeToggle } from '@/components/ThemeToggle';

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
  const [isSemesterAutoAssigned, setIsSemesterAutoAssigned] = useState(false);
  const [availableSemesters, setAvailableSemesters] = useState<(1 | 2 | 3)[]>([]);
  const [semesterLookupError, setSemesterLookupError] = useState('');
  const [isLookingUpSemester, setIsLookingUpSemester] = useState(false);
  const [teachingYearLevels, setTeachingYearLevels] = useState<(1 | 2 | 3)[]>([]);
  const [teachingSections, setTeachingSections] = useState<string[]>([]);
  const [sectionInput, setSectionInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState('');
  const { registerAsync, isLoading, error } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (role !== 'student') {
      setIsSemesterAutoAssigned(false);
      setAvailableSemesters([]);
      setSemesterLookupError('');
      setIsLookingUpSemester(false);
      return;
    }

    const trimmedSection = section.trim();
    if (!trimmedSection) {
      setIsSemesterAutoAssigned(false);
      setAvailableSemesters([]);
      setSemesterLookupError('');
      setIsLookingUpSemester(false);
      return;
    }

    let cancelled = false;
    const lookupSemester = async () => {
      setIsLookingUpSemester(true);
      setIsSemesterAutoAssigned(false);
      setSemesterLookupError('');
      const response = await api.getSectionSemester(trimmedSection);
      if (cancelled) return;

      if (response.success && response.data?.primarySemester) {
        const semesters = (response.data.semesters || [])
          .map((value) => Number(value))
          .filter((value): value is 1 | 2 | 3 => Number.isInteger(value) && value >= 1 && value <= 3)
          .sort();
        const selectedSemester = Number(response.data.primarySemester) as 1 | 2 | 3;
        setAvailableSemesters(semesters);
        setYearLevel(selectedSemester);
        setIsSemesterAutoAssigned(true);
      } else {
        setAvailableSemesters([]);
        setIsSemesterAutoAssigned(false);
        setSemesterLookupError(response.error?.message || 'Could not auto-assign semester for this section.');
      }

      setIsLookingUpSemester(false);
    };

    lookupSemester();
    return () => {
      cancelled = true;
    };
  }, [role, section]);

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
    } else {
      if (!section.trim()) {
        setValidationError('Section is required');
        return;
      }
      if (!isSemesterAutoAssigned) {
        setValidationError('Semester is auto-assigned from your section. Enter a valid section handled by an instructor.');
        return;
      }
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
    <div className="auth-aether-page min-h-screen flex relative overflow-hidden">
      <div className="absolute right-5 top-5 z-30"><ThemeToggle /></div>
      {/* Left Branding Hero Panel */}
      <section className="auth-hero-panel relative hidden md:flex md:w-[46%] lg:w-1/2 min-h-screen overflow-hidden px-8 py-10 lg:px-14 lg:py-12">
        <div className="absolute -right-24 top-16 h-72 w-72 rounded-full auth-hero-ring animate-pulse" />
        <div className="absolute -bottom-32 -left-20 h-80 w-80 rounded-full auth-hero-ring--secondary" />
        <div className="absolute inset-x-10 bottom-10 h-px auth-hero-line" />
        
        <div className="relative z-10 flex w-full flex-col justify-between">
          <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/80">
            <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)]" />
            Interactive Multimedia Learning
          </div>

          <div className="py-6 space-y-6">
            <div className="login-aether-logo w-full max-w-[560px] animate-fade-in">
              <AetherLogo />
            </div>

            <div className="space-y-3 max-w-md pt-2" />
          </div>

          <div className="max-w-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-300/70">Create. Explore. Master.</p>
            <h2 className="mt-2 text-2xl font-semibold leading-tight text-white lg:text-3xl">Join your creative classroom.</h2>
          </div>
        </div>
      </section>

      {/* Right Signup Form */}
      <main className="relative z-10 flex min-h-screen w-full items-center justify-center overflow-y-auto px-5 py-10 sm:px-10 md:w-[54%] lg:w-1/2 lg:px-16">
        <div className="w-full max-w-[500px] animate-fade-in my-auto">
          <div className="mb-8 md:hidden text-center">
            <div className="mx-auto mb-4 w-44"><AetherLogo compact /></div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-400">Interactive learning</p>
          </div>

          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-400">Join the community</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Create your account</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">Set up your learning space and start exploring multimedia courseware.</p>
          </div>

          <Card className="auth-form-surface border border-slate-800/80 bg-slate-900/50 backdrop-blur-xl shadow-2xl shadow-black/40 rounded-2xl">
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-slate-300 text-sm font-medium">
                    Full Name
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Juan Dela Cruz"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      className="pl-10 bg-slate-950/70 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-2 focus-visible:ring-violet-500/30 focus-visible:border-violet-500 h-11 rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role" className="text-slate-300 text-sm font-medium">
                    I am a
                  </Label>
                  <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Account type">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={role === 'student'}
                      onClick={() => setRole('student')}
                      className={`flex items-center justify-center gap-2 h-11 rounded-xl border text-sm font-medium transition-all ${
                        role === 'student'
                          ? 'border-violet-500/80 bg-violet-500/15 text-white shadow-sm shadow-violet-500/30'
                          : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                      }`}
                    >
                      <GraduationCap className={`w-4 h-4 ${role === 'student' ? 'text-violet-400' : 'text-slate-500'}`} />
                      Student
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={role === 'instructor'}
                      onClick={() => setRole('instructor')}
                      className={`flex items-center justify-center gap-2 h-11 rounded-xl border text-sm font-medium transition-all ${
                        role === 'instructor'
                          ? 'border-fuchsia-500/80 bg-fuchsia-500/15 text-white shadow-sm shadow-fuchsia-500/30'
                          : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                      }`}
                    >
                      <Presentation className={`w-4 h-4 ${role === 'instructor' ? 'text-fuchsia-400' : 'text-slate-500'}`} />
                      Instructor
                    </button>
                  </div>
                </div>

                {role === 'student' ? (
                  <div className="space-y-3 rounded-xl border border-slate-800/80 bg-slate-950/40 p-3.5">
                    <div className="space-y-2">
                      <Label htmlFor="section" className="text-slate-300 text-sm font-medium">
                        Section
                      </Label>
                      <Input
                        id="section"
                        type="text"
                        placeholder="e.g. A, Section 1"
                        value={section}
                        onChange={(e) => setSection(e.target.value)}
                        maxLength={50}
                        required
                        className="bg-slate-950/70 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-2 focus-visible:ring-violet-500/30 focus-visible:border-violet-500 h-11 rounded-xl"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="yearLevel" className="text-slate-300 text-sm font-medium">
                          Academic Semester
                        </Label>
                        {isSemesterAutoAssigned && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" /> Auto-assigned
                          </span>
                        )}
                      </div>
                      <Input
                        id="yearLevel"
                        type="text"
                        readOnly
                        value={isSemesterAutoAssigned
                          ? (ACADEMIC_YEAR_OPTIONS.find((option) => option.value === yearLevel)?.label ?? 'Not assigned')
                          : 'Waiting for section...'}
                        className="h-11 bg-slate-950/70 border-slate-800 text-slate-300 rounded-xl"
                      />
                    </div>

                    <p className="text-xs text-slate-400">
                      Your semester is automatically assigned based on your section&apos;s instructor.
                      {isLookingUpSemester ? ' Checking instructor assignment...' : ''}
                    </p>

                    {availableSemesters.length > 1 && (
                      <p className="text-xs text-slate-400">
                        Your instructor handles: {availableSemesters.map((value) => ACADEMIC_YEAR_OPTIONS.find((option) => option.value === value)?.label).filter(Boolean).join(', ')}.
                      </p>
                    )}

                    {semesterLookupError && (
                      <p className="text-xs text-amber-400">{semesterLookupError}</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3 rounded-xl border border-slate-800/80 bg-slate-950/40 p-3.5">
                    <div className="space-y-2">
                      <Label className="text-slate-300 text-sm font-medium">Academic Semesters You Teach</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {ACADEMIC_YEAR_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            aria-pressed={teachingYearLevels.includes(opt.value)}
                            onClick={() => toggleTeachingYear(opt.value)}
                            className={`h-11 rounded-xl border text-sm font-medium transition-all ${
                              teachingYearLevels.includes(opt.value)
                                ? 'border-fuchsia-500/80 bg-fuchsia-500/15 text-white shadow-sm shadow-fuchsia-500/30'
                                : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-slate-400">Select every academic term/semester you handle.</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="teachingSections" className="text-slate-300 text-sm font-medium">
                        Sections You Handle
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id="teachingSections"
                          type="text"
                          placeholder="e.g. A, then click Add"
                          value={sectionInput}
                          onChange={(e) => setSectionInput(e.target.value)}
                          onKeyDown={handleSectionInputKeyDown}
                          maxLength={50}
                          className="bg-slate-950/70 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-2 focus-visible:ring-violet-500/30 focus-visible:border-violet-500 h-11 rounded-xl"
                        />
                        <Button
                          type="button"
                          onClick={addTeachingSection}
                          variant="outline"
                          className="h-11 border-slate-800 bg-slate-950/60 text-slate-200 hover:bg-slate-800/60 rounded-xl px-4"
                        >
                          Add
                        </Button>
                      </div>

                      {teachingSections.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {teachingSections.map((s) => (
                            <span
                              key={s}
                              className="flex items-center gap-1.5 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1 text-xs text-fuchsia-200 font-medium"
                            >
                              {s}
                              <button
                                type="button"
                                onClick={() => removeTeachingSection(s)}
                                aria-label={`Remove section ${s}`}
                                className="text-fuchsia-400 hover:text-white transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-slate-400">
                        Add every section you handle. Students in these sections will automatically map to your semester.
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-300 text-sm font-medium">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="pl-10 bg-slate-950/70 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-2 focus-visible:ring-violet-500/30 focus-visible:border-violet-500 h-11 rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-300 text-sm font-medium">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Min. 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="pl-10 pr-10 bg-slate-950/70 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-2 focus-visible:ring-violet-500/30 focus-visible:border-violet-500 h-11 rounded-xl"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-slate-300 text-sm font-medium">
                    Confirm Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      id="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Repeat your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="pl-10 bg-slate-950/70 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-2 focus-visible:ring-violet-500/30 focus-visible:border-violet-500 h-11 rounded-xl"
                    />
                  </div>
                </div>

                {validationError && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-sm text-amber-400 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                    {validationError}
                  </div>
                )}

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full h-11 rounded-xl font-medium shadow-lg transition-all ${
                    role === 'student'
                      ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-violet-500/25'
                      : 'bg-gradient-to-r from-fuchsia-600 to-violet-600 hover:from-fuchsia-500 hover:to-violet-500 text-white shadow-fuchsia-500/25'
                  }`}
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
                    <span className="px-3 bg-slate-900/90 text-slate-500 font-medium">already have an account?</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/login')}
                  className="w-full border-slate-800 bg-slate-950/60 text-slate-300 hover:bg-slate-800/60 hover:text-white h-11 rounded-xl transition-all"
                >
                  Sign In
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

