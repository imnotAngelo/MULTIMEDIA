import { useEffect, useState } from 'react';
import { BarChart3, RefreshCw, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AetherLoader } from '@/components/AetherLoader';
import { authFetch } from '@/lib/authFetch';

interface Student {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string | null;
  year_level?: number;
  section?: string;
}

interface Score {
  title: string;
  score: number | null;
  possible?: number | null;
}

interface StudentPerformance extends Student {
  quizzes: Score[];
  laboratories: Score[];
}

function scoreLabel(score: Score, isQuiz: boolean) {
  if (score.score === null || !Number.isFinite(score.score)) return 'Not graded';
  if (isQuiz && score.possible !== null && score.possible !== undefined && Number.isFinite(score.possible)) {
    return `${score.score}/${score.possible}`;
  }
  return String(score.score);
}

export function StudentPerformance() {
  const [students, setStudents] = useState<StudentPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPerformance = async () => {
    setLoading(true);
    setError('');
    try {
      const [studentsResponse, quizzesResponse, labsResponse] = await Promise.all([
        authFetch('/instructor/student-requests?includeAll=true'),
        authFetch('/assessments/instructor/all?filter=quiz&limit=100'),
        authFetch('/laboratory-submissions/all-files'),
      ]);
      const studentsPayload = await studentsResponse.json();
      const quizzesPayload = await quizzesResponse.json();
      const labsPayload = await labsResponse.json();
      if (!studentsResponse.ok || !studentsPayload.success) throw new Error(studentsPayload.error?.message || 'Could not load students');
      if (!quizzesResponse.ok || !quizzesPayload.success) throw new Error(quizzesPayload.error?.message || 'Could not load quizzes');
      if (!labsResponse.ok || !Array.isArray(labsPayload)) {
        throw new Error(labsPayload.error || 'Could not load laboratory submissions');
      }

      const studentMap = new Map<string, StudentPerformance>(
        (studentsPayload.data || []).map((student: Student) => [student.id, { ...student, quizzes: [], laboratories: [] }])
      );
      const quizzes = quizzesPayload.data || [];
      const quizSubmissions = await Promise.all(quizzes.map(async (quiz: any) => {
        const response = await authFetch(`/assessments/${quiz.id}/submissions`);
        if (!response.ok) return [];
        const payload = await response.json();
        const possiblePoints = Array.isArray(quiz.questions_data)
          ? quiz.questions_data.reduce((total: number, question: any) => total + (Number(question.points) || 0), 0)
          : Number(quiz.total_points) || null;
        return (payload.success ? payload.data || [] : []).map((submission: any) => {
          const storedEarned = submission.earned_points === null || submission.earned_points === undefined
            ? NaN
            : Number(submission.earned_points);
          const percentageScore = submission.score === null || submission.score === undefined
            ? NaN
            : Number(submission.score);
          const earnedPoints = Number.isFinite(storedEarned)
            ? storedEarned
            : Number.isFinite(percentageScore) && possiblePoints
              ? Math.round((percentageScore / 100) * possiblePoints * 100) / 100
              : null;
          return {
          studentId: submission.student?.id || submission.user_id,
          score: earnedPoints,
          possible: possiblePoints,
          title: quiz.title,
          };
        });
      }));

      for (const submission of quizSubmissions.flat()) {
        const student = studentMap.get(submission.studentId);
        if (student) student.quizzes.push({ title: submission.title, score: submission.score, possible: submission.possible });
      }
      for (const submission of labsPayload) {
        const student = studentMap.get(submission.studentId);
        if (student) student.laboratories.push({
          title: submission.labTitle,
          score: submission.grade === null || submission.grade === undefined ? null : Number(submission.grade),
        });
      }
      setStudents([...studentMap.values()]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load student performance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPerformance();
  }, []);

  const studentsBySection = students.reduce<Record<string, StudentPerformance[]>>((groups, student) => {
    const section = student.section?.trim() || 'Unassigned section';
    (groups[section] ??= []).push(student);
    return groups;
  }, {});

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-violet-400">Instructor overview</p>
          <h1 className="mt-1 text-3xl font-bold text-white">Students I Handle</h1>
          <p className="mt-2 text-slate-400">Review laboratory and quiz scores for your students.</p>
        </div>
        <Button variant="outline" onClick={loadPerformance} disabled={loading} className="border-slate-700 text-slate-200">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</p>}
      {loading ? <AetherLoader label="Loading student performance" /> : students.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-12 text-center">
          <Users className="mx-auto h-10 w-10 text-slate-600" />
          <p className="mt-3 text-slate-400">No students found in your assigned sections.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(studentsBySection).sort(([first], [second]) => first.localeCompare(second)).map(([section, sectionStudents]) => (
            <section key={section} className="space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                <div className="h-2 w-2 rounded-full bg-lime-400 shadow-[0_0_12px_rgba(163,230,53,0.7)]" />
                <h2 className="text-lg font-semibold text-white">Section {section}</h2>
                <span className="rounded-full bg-violet-500/15 px-2.5 py-1 text-xs text-violet-300">
                  {sectionStudents.length} student{sectionStudents.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {sectionStudents.map((student) => (
                  <article key={student.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
                    <div className="flex items-start gap-3 border-b border-slate-800 pb-4">
                      {student.avatar_url ? (
                        <img
                          src={student.avatar_url}
                          alt={`${student.full_name} profile`}
                          className="h-10 w-10 shrink-0 rounded-full border border-violet-400/30 bg-slate-800 object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-violet-300">
                          {(student.full_name || student.email).charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="font-semibold text-white">{student.full_name}</h3>
                        <p className="truncate text-sm text-slate-400">{student.email}</p>
                        <p className="mt-1 text-xs text-slate-500">Year {student.year_level ?? '-'}</p>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-cyan-300"><BarChart3 className="h-4 w-4" /> Quizzes</h4>
                        {student.quizzes.length === 0 ? <p className="text-xs text-slate-500">No quiz submissions</p> : student.quizzes.map((score, index) => <div key={`${score.title}-${index}`} className="flex justify-between gap-2 py-1 text-xs"><span className="truncate text-slate-400">{score.title}</span><span className="shrink-0 text-white">{scoreLabel(score, true)}</span></div>)}
                      </div>
                      <div>
                        <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-300"><BarChart3 className="h-4 w-4" /> Laboratories</h4>
                        {student.laboratories.length === 0 ? <p className="text-xs text-slate-500">No laboratory submissions</p> : student.laboratories.map((score, index) => <div key={`${score.title}-${index}`} className="flex justify-between gap-2 py-1 text-xs"><span className="truncate text-slate-400">{score.title}</span><span className="shrink-0 text-white">{scoreLabel(score, false)}</span></div>)}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
