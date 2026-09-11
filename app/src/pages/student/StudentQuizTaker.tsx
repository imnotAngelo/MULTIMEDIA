import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { authFetch } from '@/lib/authFetch';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Send,
  RefreshCw,
} from 'lucide-react';
import { AetherLoader } from '@/components/AetherLoader';

interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

interface Question {
  id: string;
  text?: string;  // From backend
  title?: string;  // From form generation
  type: 'multiple-choice' | 'short-answer' | 'essay' | 'true-false' | 'enumeration' | 'identification';
  options?: QuestionOption[] | string[];
  correctAnswer?: string;
  points: number;
}

interface Quiz {
  id: string;
  title: string;
  description: string;
  questions_data: Question[];
  time_limit?: number;
  shuffle_questions?: boolean;
  show_correct_answers?: boolean;
  due_date?: string;
  allow_late_submissions?: boolean;
  dueDate: string;
  createdAt: string;
}

interface StudentAnswer {
  questionId: string;
  answer: string;
}

export function StudentQuizTaker() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const theme = useThemeStore((state) => state.theme);
  const isLightMode = theme === 'light';

  const pageBackgroundClass = isLightMode
    ? 'bg-gradient-to-b from-slate-100 via-white to-slate-200'
    : 'bg-gradient-to-b from-slate-950 to-slate-900';
  const panelClass = isLightMode
    ? 'bg-white border border-slate-200 shadow-sm'
    : 'bg-slate-900/60 border border-slate-800 shadow-lg';
  const softPanelClass = isLightMode
    ? 'bg-slate-50 border border-slate-200'
    : 'bg-slate-800/50 border border-slate-700';
  const headingTextClass = isLightMode ? 'text-slate-900' : 'text-white';
  const secondaryTextClass = isLightMode ? 'text-slate-600' : 'text-slate-400';
  const subtleTextClass = isLightMode ? 'text-slate-500' : 'text-slate-500';
  const inputClass = isLightMode
    ? 'w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100'
    : 'w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20';
  const headerCardClass = isLightMode
    ? 'rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm'
    : 'rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg';
  const chipClass = isLightMode
    ? 'px-3 py-1 rounded-full bg-violet-50 border border-violet-200'
    : 'px-3 py-1 rounded-full bg-violet-600/20 border border-violet-500/30';
  const timerClass = isLightMode
    ? 'rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm'
    : 'rounded-xl border border-slate-700 bg-slate-800 px-4 py-3';
  const optionBaseClass = isLightMode
    ? 'p-4 rounded-xl border cursor-pointer transition-all bg-slate-50 border-slate-200 hover:border-violet-300 hover:bg-violet-50'
    : 'p-4 rounded-xl border cursor-pointer transition-all bg-slate-800/50 border-slate-700 hover:border-slate-600';

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [studentAnswers, setStudentAnswers] = useState<StudentAnswer[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [score, setScore] = useState(0);
  const [gradingResults, setGradingResults] = useState<Record<string, boolean>>({});
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [quizStartTime] = useState<Date>(new Date());

  const normalizeShortAnswer = (value: string) => value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const getShortAnswerSimilarity = (studentAnswer: string, expectedAnswer: string) => {
    const normalizedStudent = normalizeShortAnswer(studentAnswer);
    const normalizedExpected = normalizeShortAnswer(expectedAnswer);

    if (!normalizedStudent || !normalizedExpected) return 0;
    if (normalizedStudent === normalizedExpected) return 1;

    const studentTokens = normalizedStudent.split(' ').filter(Boolean);
    const expectedTokens = normalizedExpected.split(' ').filter(Boolean);
    const overlap = studentTokens.filter(token => expectedTokens.includes(token)).length;
    const keywordSimilarity = overlap / Math.max(studentTokens.length, expectedTokens.length);

    const minLength = Math.min(studentTokens.length, expectedTokens.length);
    const matchingOrder = studentTokens.slice(0, minLength).filter((token, index) => token === expectedTokens[index]).length;
    const sequenceSimilarity = minLength > 0 ? matchingOrder / minLength : 0;

    return Math.max(keywordSimilarity, sequenceSimilarity);
  };

  const isShortAnswerCorrect = (studentAnswer: string, correctAnswer: string) => {
    const normalizedStudent = normalizeShortAnswer(studentAnswer);
    const normalizedExpected = normalizeShortAnswer(correctAnswer);
    if (!normalizedStudent || !normalizedExpected) return false;
    const similarity = getShortAnswerSimilarity(studentAnswer, correctAnswer);
    return similarity >= 0.5 || normalizedStudent === normalizedExpected;
  };

  const getRawScoreBreakdown = (questions: Question[], answers: StudentAnswer[]) => {
    let earnedPoints = 0;
    let possiblePoints = 0;

    questions.forEach((question) => {
      const points = Number(question.points) || 0;
      possiblePoints += points;
      const studentAnswer = answers.find(a => a.questionId === question.id);

      if (!studentAnswer) return;

      const isCorrect = question.type === 'short-answer'
        ? isShortAnswerCorrect(studentAnswer.answer, question.correctAnswer || '')
        : studentAnswer.answer === question.correctAnswer;

      if (isCorrect) {
        earnedPoints += points;
      }
    });

    return { earnedPoints, possiblePoints };
  };

  const formatRawScore = (earnedPoints: number, possiblePoints: number) => {
    if (possiblePoints > 0) return `${earnedPoints}/${possiblePoints}`;
    return String(earnedPoints);
  };

  useEffect(() => {
    loadQuiz();
  }, [id]);

  // Timer effect
  useEffect(() => {
    if (!quiz?.time_limit || submitted || !timeRemaining) return;

    if (timeRemaining <= 0) {
      handleSubmit();
      return;
    }

    const timer = setTimeout(() => {
      setTimeRemaining(timeRemaining - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [timeRemaining, quiz, submitted]);

  const loadQuiz = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await authFetch(`/assessments/${id}`);

      if (!response.ok) {
        throw new Error(`Failed to load quiz: ${response.status}`);
      }

      const data = await response.json();
      console.log('📋 Full quiz API response:', JSON.stringify(data, null, 2));
      console.log('🔍 Response top-level keys:', Object.keys(data));
      
      if (data.success && data.data) {
        const quizData = data.data;
        console.log('📝 Quiz data keys:', Object.keys(quizData));
        console.log('📝 questions_data field exists?', 'questions_data' in quizData);
        console.log('📝 questions_data value:', quizData.questions_data);
        console.log('📝 questions_data type:', typeof quizData.questions_data);
        console.log('📝 questions_data is array?', Array.isArray(quizData.questions_data));
        console.log('📝 questions_data length:', Array.isArray(quizData.questions_data) ? quizData.questions_data.length : 'N/A');
        
        // Check alternative field names
        console.log('📝 questions field:', (quizData as any).questions);
        console.log('📝 assessment_questions field:', (quizData as any).assessment_questions);
        
        // Ensure questions_data exists - check both possible field names
        const questionsData = quizData.questions_data || (quizData as any).questions || (quizData as any).assessment_questions;
        
        if (!questionsData || (Array.isArray(questionsData) && questionsData.length === 0)) {
          console.error('❌ No questions found!');
          console.error('  - All available fields:', Object.keys(quizData));
          console.error('  - questions_data:', quizData.questions_data);
          console.error('  - questions:', (quizData as any).questions);
          console.error('  - assessment_questions:', (quizData as any).assessment_questions);
          console.error('  - Full quiz object:', quizData);
          console.error('\n⚠️  POSSIBLE SOLUTIONS:');
          console.error('  1. Check if MIGRATION_QUIZ_SUPPORT.sql has been run in Supabase');
          console.error('  2. Create a new quiz to ensure questions_data column exists');
          console.error('  3. This quiz may have been created before migration was applied');
          setError('Quiz has no questions. This may mean:\n1. The database migration hasn\'t been run yet\n2. The quiz was created before the migration\n\nPlease create a new quiz or contact your administrator.');
          setLoading(false);
          return;
        }
        
        // Validate questions_data is an array
        if (!Array.isArray(questionsData)) {
          console.error('❌ questions_data is not an array:', questionsData);
          setError('Invalid quiz data format. Please contact instructor.');
          setLoading(false);
          return;
        }
        
        // Use questions_data or questions field, whichever exists
        const finalQuiz = {
          ...quizData,
          questions_data: questionsData,
        } as Quiz;
        console.log('✅ Final quiz to set:', finalQuiz);
        console.log('✅ Questions loaded:', finalQuiz.questions_data.length, 'questions');
        setQuiz(finalQuiz);

        let savedSubmission: any = null;
        try {
          const submissionResponse = await authFetch(`/assessments/${id}/my-submission`);
          if (submissionResponse.ok) {
            const submissionData = await submissionResponse.json();
            savedSubmission = submissionData?.data || null;
          }
        } catch (submissionError) {
          console.warn('Unable to load student submission endpoint; using quiz data fallback.', submissionError);
        }

        // Older backend deployments include submissions in the quiz response.
        // Use only the current student's submission as a review fallback.
        if (!savedSubmission && Array.isArray((quizData as any).submissions)) {
          savedSubmission = (quizData as any).submissions.find(
            (submission: any) => String(submission.user_id) === String(user?.id)
          ) || null;
        }

        if (savedSubmission) {
            const savedAnswers = Array.isArray(savedSubmission.answers)
              ? savedSubmission.answers
              : Object.entries(savedSubmission.answers || {}).map(([questionId, answer]) => ({ questionId, answer }));
            setStudentAnswers(savedAnswers as StudentAnswer[]);
            const savedAnswerMap = new Map<string, string>(
              savedAnswers.map((answer: StudentAnswer) => [
                String(answer.questionId),
                String(answer.answer ?? '').trim(),
              ])
            );
            setGradingResults(Object.fromEntries(finalQuiz.questions_data.map((question) => {
              const answer = savedAnswerMap.get(String(question.id)) ?? '';
              const expected = String(question.correctAnswer ?? '').trim();
              const isCorrect = Boolean(answer) && (
                question.type === 'short-answer' || question.type === 'enumeration' || question.type === 'identification' || question.type === 'essay'
                  ? isShortAnswerCorrect(answer, expected)
                  : question.type === 'true-false'
                    ? normalizeShortAnswer(answer) === normalizeShortAnswer(expected)
                    : answer === expected
              );
              return [String(question.id), isCorrect];
            })));

            const possiblePoints = finalQuiz.questions_data.reduce((sum, question) => sum + (Number(question.points) || 0), 0);
            const savedScoreValue = Number(savedSubmission.score);
            const savedEarnedPoints = Number.isFinite(Number(savedSubmission.earned_points))
              ? Number(savedSubmission.earned_points)
              : null;
            const savedPossiblePoints = Number.isFinite(Number(savedSubmission.possible_points))
              ? Number(savedSubmission.possible_points)
              : possiblePoints;

            let earnedPoints = savedEarnedPoints;

            if (earnedPoints === null && Number.isFinite(savedScoreValue)) {
              if (savedPossiblePoints > 0 && savedScoreValue <= savedPossiblePoints) {
                earnedPoints = savedScoreValue;
              } else if (savedScoreValue <= 100 && possiblePoints > 0) {
                earnedPoints = (savedScoreValue / 100) * possiblePoints;
              }
            }

            if (earnedPoints === null) {
              earnedPoints = getRawScoreBreakdown(finalQuiz.questions_data, savedAnswers as StudentAnswer[]).earnedPoints;
            }

            setScore(earnedPoints || 0);
            setSubmitted(true);
        }

        const dueDate = quizData.due_date || quizData.dueDate;
        const dueTime = dueDate ? new Date(dueDate).getTime() : NaN;
        if (!savedSubmission && Number.isFinite(dueTime) && dueTime <= Date.now() && !quizData.allow_late_submissions) {
          setQuiz(null);
          setError('This quiz is closed because its due date has passed.');
          return;
        }
        
        // Initialize time remaining
        if (quizData.time_limit) {
          setTimeRemaining(quizData.time_limit * 60); // Convert minutes to seconds
        }

        // Shuffle questions if needed
        if (quizData.shuffle_questions && questionsData) {
          const shuffledQuestions = [...questionsData].sort(
            () => Math.random() - 0.5
          );
          console.log('🔀 Questions shuffled'); // DEBUG LOG
          setQuiz(prevQuiz => ({
            ...(prevQuiz as Quiz),
            questions_data: shuffledQuestions,
          }));
        }
      } else {
        console.error('❌ Invalid quiz response:', data); // DEBUG LOG
        throw new Error('Invalid quiz data');
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(`Failed to load quiz: ${err.message}`);
      } else {
        setError('Failed to load quiz. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId: string, answer: string) => {
    setStudentAnswers(prev => {
      const existing = prev.find(a => a.questionId === questionId);
      if (existing) {
        return prev.map(a =>
          a.questionId === questionId ? { ...a, answer } : a
        );
      }
      return [...prev, { questionId, answer }];
    });
  };

  const calculateScore = () => {
    if (!quiz) return 0;
    return getRawScoreBreakdown(quiz.questions_data, studentAnswers).earnedPoints;
  };

  const handleSubmit = async () => {
    if (submitted || submitting || !quiz) return;
    const dueDate = quiz?.due_date || quiz?.dueDate;
    const dueTime = dueDate ? new Date(dueDate).getTime() : NaN;
    if (Number.isFinite(dueTime) && dueTime <= Date.now() && !quiz?.allow_late_submissions) {
      setError('This quiz is closed because its due date has passed.');
      return;
    }
    setSubmitting(true);
    try {
      // Send submission to backend
      const timeSpent = Math.floor(
        (new Date().getTime() - quizStartTime.getTime()) / 1000
      );

      const response = await authFetch(`/assessments/${id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          answers: studentAnswers,
          timeSpent,
        }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.error?.message || `Submission failed (${response.status})`);
      }

      const rawBreakdown = getRawScoreBreakdown(quiz.questions_data, studentAnswers);
      const derivedEarnedPoints = Array.isArray(result.results)
        ? result.results.reduce((sum: number, item: any) => sum + (Number(item.earnedPoints) || 0), 0)
        : null;
      const earnedPoints = Number.isFinite(derivedEarnedPoints)
        ? derivedEarnedPoints
        : Number(result.data?.earned_points ?? result.earned_points ?? result.data?.score ?? result.score ?? calculateScore());
      const possiblePoints = Number(result.data?.possible_points ?? result.possible_points ?? rawBreakdown.possiblePoints);
      const normalizedEarnedPoints = Number.isFinite(earnedPoints) && possiblePoints > 0 && earnedPoints <= possiblePoints
        ? earnedPoints
        : rawBreakdown.earnedPoints;

      setScore(normalizedEarnedPoints || 0);
      if (user?.id && id) {
        localStorage.setItem(`quiz-submission:${user.id}:${id}`, JSON.stringify({
          score: Number(result.score ?? result.data?.score ?? 0),
          earned_points: normalizedEarnedPoints,
          possible_points: possiblePoints || rawBreakdown.possiblePoints,
          status: result.data?.status || 'submitted',
          submitted_at: result.data?.submitted_at || new Date().toISOString(),
        }));
      }
      if (Array.isArray(result.results)) {
        setGradingResults(Object.fromEntries(result.results.map((item: any) => [String(item.questionId), Boolean(item.isCorrect)])));
      }
      setSubmitted(true);
    } catch (err) {
      console.error('Failed to submit quiz:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit quiz. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center min-h-screen ${pageBackgroundClass}`}>
        <AetherLoader label="Loading your quiz" />
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className={`min-h-screen ${pageBackgroundClass} p-6 flex items-center justify-center`}>
        <div className="max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className={`text-2xl font-bold ${headingTextClass} mb-2`}>Error Loading Quiz</h1>
          <p className={`${secondaryTextClass} mb-6 whitespace-pre-wrap text-sm leading-relaxed`}>{error || 'Unable to load the quiz.'}</p>
          <div className={`${softPanelClass} rounded-lg p-4 mb-6 text-left`}>
            <p className={`text-xs ${secondaryTextClass} mb-2`}><strong>Troubleshooting:</strong></p>
            <ul className={`text-xs ${secondaryTextClass} space-y-1 list-disc list-inside`}>
              <li>Check browser console (F12) for detailed logs</li>
              <li>Ask instructor to create a new quiz</li>
              <li>Refresh the page and try again</li>
            </ul>
          </div>
          <Button
            onClick={() => navigate('/quizzes')}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Assessments
          </Button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className={`space-y-6 max-w-2xl mx-auto py-8 ${pageBackgroundClass}`}>
        {/* Results Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className={`text-3xl font-bold ${headingTextClass}`}>Quiz Submitted!</h1>
            <p className={`${secondaryTextClass} mt-2`}>{quiz.title}</p>
          </div>
          <Button
            onClick={() => navigate('/quizzes')}
            variant="outline"
            className={isLightMode ? 'border-slate-300 text-slate-700 hover:bg-slate-100' : 'border-slate-700 text-slate-300 hover:bg-slate-800/50'}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>

        {/* Score Display */}
        <div className="bg-gradient-to-br from-emerald-600/20 to-emerald-800/20 border border-emerald-500/30 rounded-xl p-8 text-center">
          <div className="text-6xl font-bold text-emerald-400 mb-2">{formatRawScore(score, quiz.questions_data.reduce((sum, question) => sum + (Number(question.points) || 0), 0))}</div>
          <p className={`${secondaryTextClass} text-lg`}>Quiz Score</p>
        </div>

        {/* Results Summary */}
        <div className={`${panelClass} rounded-xl p-6`}>
          <h2 className={`text-xl font-semibold ${headingTextClass} mb-4`}>Results Summary</h2>
          <div className="space-y-3">
            {quiz.questions_data.map((question, index) => {
              const studentAnswer = studentAnswers.find(
                a => a.questionId === question.id
              );
              const isCorrect = Object.prototype.hasOwnProperty.call(gradingResults, question.id)
                ? gradingResults[question.id]
                : studentAnswer?.answer === question.correctAnswer;

              return (
                <div
                  key={question.id}
                  className={`p-4 rounded-lg border ${
                    isCorrect
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : 'bg-red-500/10 border-red-500/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {isCorrect ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`${headingTextClass} font-medium mb-1`}>
                        Question {index + 1}: {question.text || question.title || 'Question'}
                      </p>
                      <p className={`${secondaryTextClass} text-sm mb-2`}>
                        Your answer: {studentAnswer?.answer || 'No answer'}
                      </p>
                      {!isCorrect && quiz.show_correct_answers && (
                        <p className="text-emerald-400 text-sm">
                          Correct answer: {question.correctAnswer}
                        </p>
                      )}
                      <p className={`${subtleTextClass} text-xs mt-2`}>
                        {question.points} point{question.points !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-center">
          <Button
            onClick={() => navigate('/quizzes')}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            Back to Assessments
          </Button>
          <Button
            onClick={() => navigate('/dashboard')}
            variant="outline"
            className={isLightMode ? 'border-slate-300 text-slate-700 hover:bg-slate-100' : 'border-slate-700 text-slate-300 hover:bg-slate-800/50'}
          >
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Quiz Taking View
  if (!quiz || !quiz.questions_data || quiz.questions_data.length === 0) {
    return (
      <div className={`flex items-center justify-center min-h-screen ${pageBackgroundClass}`}>
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className={`text-xl font-bold ${headingTextClass} mb-2`}>No Questions Available</h2>
          <p className={`${secondaryTextClass} mb-6`}>This quiz does not have any questions.</p>
          <Button
            onClick={() => navigate('/quizzes')}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Assessments
          </Button>
        </div>
      </div>
    );
  }

  const question = quiz.questions_data[currentQuestionIndex];
  const studentAnswer = studentAnswers.find(a => a.questionId === question.id);

  return (
    <div className={`min-h-screen ${pageBackgroundClass} py-8`}>
      <div className="max-w-3xl mx-auto px-4">
        {/* Header */}
        <div className={`${headerCardClass} flex items-center justify-between mb-8`}>
          <div className="flex-1">
            <h1 className={`text-2xl md:text-3xl font-bold ${headingTextClass}`}>{quiz.title}</h1>
            <p className={`${secondaryTextClass} mt-1`}>
              Question {currentQuestionIndex + 1} of {quiz.questions_data.length}
            </p>
          </div>
          {timeRemaining !== null && (
            <div
              className={`${timerClass} text-center ${
                timeRemaining < 300 ? 'bg-red-500/10 border-red-500/30' : ''
              }`}
            >
              <div className="flex items-center gap-2 justify-center">
                <Clock className="w-4 h-4" />
                <div className="text-right">
                  <p className={`text-xs ${secondaryTextClass}`}>Time</p>
                  <p
                    className={`font-semibold ${
                      timeRemaining < 300 ? 'text-red-400' : headingTextClass
                    }`}
                  >
                    {Math.floor(timeRemaining / 60)}:
                    {(timeRemaining % 60).toString().padStart(2, '0')}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className={`h-2 ${isLightMode ? 'bg-slate-200' : 'bg-slate-800'} rounded-full overflow-hidden`}>
            <div
              className="h-full bg-gradient-to-r from-violet-600 to-violet-400 transition-all duration-300"
              style={{
                width: `${((currentQuestionIndex + 1) / quiz.questions_data.length) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Question Card */}
        <div className={`${panelClass} rounded-2xl p-6 md:p-8 mb-8`}>
          {/* Question */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className={chipClass}>
                <p className="text-sm font-medium text-violet-600 dark:text-violet-300">
                  {question.type === 'multiple-choice'
                    ? 'Multiple Choice'
                    : question.type === 'short-answer'
                      ? 'Short Answer'
                      : question.type === 'enumeration'
                        ? 'Enumeration'
                        : question.type === 'true-false'
                          ? 'True or False'
                          : question.type === 'identification'
                            ? 'Identification'
                            : 'Essay'}
                </p>
              </div>
              <p className={`${secondaryTextClass} text-sm`}>{question.points} points</p>
            </div>
            <h2 className={`text-2xl font-semibold ${headingTextClass}`}>
              {currentQuestionIndex + 1}. {question.text || question.title || 'Question text not available'}
            </h2>
          </div>

          {/* Answer Input */}
          <div className="space-y-3">
            {question.type === 'multiple-choice' && question.options ? (
              Array.isArray(question.options) && question.options.length > 0 ? (
                question.options.map((option, index) => {
                  const optionText = typeof option === 'string' ? option : (option as any).text || '';
                  const optionLabel = String.fromCharCode(65 + index);
                  return (
                    <label
                      key={index}
                      className={`${optionBaseClass} ${
                        studentAnswer?.answer === optionText
                          ? 'bg-violet-600/10 border-violet-500/50 shadow-sm'
                          : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name={`question-${question.id}`}
                          value={optionText}
                          checked={studentAnswer?.answer === optionText}
                          onChange={e => handleAnswerChange(question.id, e.target.value)}
                          className="w-4 h-4 accent-violet-600"
                        />
                        <span className={`w-7 h-7 rounded-full border ${isLightMode ? 'border-slate-300 text-violet-600' : 'border-slate-600 text-violet-300'} flex items-center justify-center text-xs font-semibold shrink-0`}>
                          {optionLabel}
                        </span>
                        <span className={headingTextClass}>{optionText}</span>
                      </div>
                    </label>
                  );
                })
              ) : (
                <div className={secondaryTextClass}>No options available for this question</div>
              )
            ) : question.type === 'true-false' ? (
              ['True', 'False'].map((option) => (
                <label
                  key={option}
                  className={`${optionBaseClass} ${
                    studentAnswer?.answer === option
                      ? 'bg-violet-600/10 border-violet-500/50 shadow-sm'
                      : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name={`question-${question.id}`}
                      value={option}
                      checked={studentAnswer?.answer === option}
                      onChange={e => handleAnswerChange(question.id, e.target.value)}
                      className="w-4 h-4 accent-violet-600"
                    />
                    <span className={headingTextClass}>{option}</span>
                  </div>
                </label>
              ))
            ) : question.type === 'short-answer' || question.type === 'enumeration' || question.type === 'identification' ? (
              <input
                type="text"
                placeholder={question.type === 'enumeration' ? 'Enter your enumerated answer...' : question.type === 'identification' ? 'Enter the identification...' : 'Enter your short answer here...'}
                value={studentAnswer?.answer || ''}
                onChange={e => handleAnswerChange(question.id, e.target.value)}
                className={inputClass}
              />
            ) : (
              <textarea
                placeholder="Enter your essay answer here..."
                value={studentAnswer?.answer || ''}
                onChange={e => handleAnswerChange(question.id, e.target.value)}
                rows={6}
                className={`${inputClass} resize-none`}
              />
            )}
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex gap-4 justify-between items-center">
          <Button
            onClick={() =>
              setCurrentQuestionIndex(prev =>
                Math.max(0, prev - 1)
              )
            }
            disabled={currentQuestionIndex === 0}
            variant="outline"
            className={isLightMode ? 'border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50' : 'border-slate-700 text-slate-300 hover:bg-slate-800/50 disabled:opacity-50'}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>

          {currentQuestionIndex === quiz.questions_data.length - 1 ? (
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {submitting ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              {submitting ? 'Submitting...' : 'Submit Quiz'}
            </Button>
          ) : (
            <Button
              onClick={() =>
                setCurrentQuestionIndex(prev =>
                  Math.min(quiz.questions_data.length - 1, prev + 1)
                )
              }
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              Next
              <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
            </Button>
          )}
        </div>

        {/* Questions List - Optional Quick Navigation */}
        <div className={`${panelClass} mt-8 p-6 rounded-2xl`}>
          <h3 className={`text-sm font-semibold ${headingTextClass} mb-4`}>Question Navigation</h3>
          <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
            {quiz.questions_data.map((_, index) => {
              const answered = studentAnswers.some(
                a => a.questionId === quiz.questions_data[index].id
              );

              return (
                <button
                  key={index}
                  onClick={() => setCurrentQuestionIndex(index)}
                  className={`w-8 h-8 rounded-lg font-medium transition-all text-xs ${
                    index === currentQuestionIndex
                      ? 'bg-violet-600 text-white'
                      : answered
                        ? 'bg-emerald-600/20 border border-emerald-500/30 text-emerald-300'
                        : isLightMode
                          ? 'bg-slate-100 border border-slate-300 text-slate-600 hover:border-slate-400'
                          : 'bg-slate-800 border border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
