import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
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

interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

interface Question {
  id: string;
  text?: string;  // From backend
  title?: string;  // From form generation
  type: 'multiple-choice' | 'short-answer' | 'essay';
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
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [studentAnswers, setStudentAnswers] = useState<StudentAnswer[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [quizStartTime] = useState<Date>(new Date());

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

      const response = await authFetch(`http://localhost:3001/api/assessments/${id}`);

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

    let totalPoints = 0;
    let earnedPoints = 0;

    quiz.questions_data.forEach(question => {
      totalPoints += question.points;
      const studentAnswer = studentAnswers.find(a => a.questionId === question.id);

      if (studentAnswer && studentAnswer.answer === question.correctAnswer) {
        earnedPoints += question.points;
      }
    });

    return totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
  };

  const handleSubmit = async () => {
    try {
      const calculatedScore = calculateScore();
      setScore(calculatedScore);
      setSubmitted(true);

      // Send submission to backend
      const timeSpent = Math.floor(
        (new Date().getTime() - quizStartTime.getTime()) / 1000
      );

      await authFetch(`http://localhost:3001/api/assessments/${id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          answers: studentAnswers,
          score: calculatedScore,
          timeSpent,
        }),
      });
    } catch (err) {
      console.error('Failed to submit quiz:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-center">
          <p className="text-slate-400 mb-4">Loading quiz...</p>
          <RefreshCw className="w-8 h-8 text-slate-500 animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 flex items-center justify-center">
        <div className="max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Error Loading Quiz</h1>
          <p className="text-slate-300 mb-6 whitespace-pre-wrap text-sm leading-relaxed">{error || 'Unable to load the quiz.'}</p>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 mb-6 text-left">
            <p className="text-xs text-slate-400 mb-2"><strong>Troubleshooting:</strong></p>
            <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
              <li>Check browser console (F12) for detailed logs</li>
              <li>Ask instructor to create a new quiz</li>
              <li>Refresh the page and try again</li>
            </ul>
          </div>
          <Button
            onClick={() => navigate('/assessments')}
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
      <div className="space-y-6 max-w-2xl mx-auto py-8">
        {/* Results Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Quiz Submitted! 🎉</h1>
            <p className="text-slate-400 mt-2">{quiz.title}</p>
          </div>
          <Button
            onClick={() => navigate('/assessments')}
            variant="outline"
            className="border-slate-700 text-slate-300 hover:bg-slate-800/50"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>

        {/* Score Display */}
        <div className="bg-gradient-to-br from-emerald-600/20 to-emerald-800/20 border border-emerald-500/30 rounded-xl p-8 text-center">
          <div className="text-6xl font-bold text-emerald-400 mb-2">{score.toFixed(1)}%</div>
          <p className="text-slate-300 text-lg">Quiz Score</p>
        </div>

        {/* Results Summary */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Results Summary</h2>
          <div className="space-y-3">
            {quiz.questions_data.map((question, index) => {
              const studentAnswer = studentAnswers.find(
                a => a.questionId === question.id
              );
              const isCorrect = studentAnswer?.answer === question.correctAnswer;

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
                      <p className="text-white font-medium mb-1">
                        Question {index + 1}: {question.text || question.title || 'Question'}
                      </p>
                      <p className="text-slate-400 text-sm mb-2">
                        Your answer: {studentAnswer?.answer || 'No answer'}
                      </p>
                      {!isCorrect && quiz.show_correct_answers && (
                        <p className="text-emerald-400 text-sm">
                          Correct answer: {question.correctAnswer}
                        </p>
                      )}
                      <p className="text-slate-500 text-xs mt-2">
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
            onClick={() => navigate('/assessments')}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            Back to Assessments
          </Button>
          <Button
            onClick={() => navigate('/dashboard')}
            variant="outline"
            className="border-slate-700 text-slate-300 hover:bg-slate-800/50"
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
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">No Questions Available</h2>
          <p className="text-slate-400 mb-6">This quiz does not have any questions.</p>
          <Button
            onClick={() => navigate('/assessments')}
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
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-white">{quiz.title}</h1>
            <p className="text-slate-400 mt-1">
              Question {currentQuestionIndex + 1} of {quiz.questions_data.length}
            </p>
          </div>
          {timeRemaining !== null && (
            <div
              className={`text-center px-4 py-2 rounded-lg border ${
                timeRemaining < 300
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-slate-800 border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2 justify-center">
                <Clock className="w-4 h-4" />
                <div className="text-right">
                  <p className="text-xs text-slate-400">Time</p>
                  <p
                    className={`font-semibold ${
                      timeRemaining < 300 ? 'text-red-400' : 'text-white'
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
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-600 to-violet-400 transition-all duration-300"
              style={{
                width: `${((currentQuestionIndex + 1) / quiz.questions_data.length) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-gradient-to-br from-slate-900/60 to-slate-900/30 border border-slate-800 rounded-xl p-8 mb-8">
          {/* Question */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="px-3 py-1 rounded-full bg-violet-600/20 border border-violet-500/30">
                <p className="text-sm font-medium text-violet-300">
                  {question.type === 'multiple-choice'
                    ? 'Multiple Choice'
                    : question.type === 'short-answer'
                      ? 'Short Answer'
                      : 'Essay'}
                </p>
              </div>
              <p className="text-slate-400 text-sm">{question.points} points</p>
            </div>
            <h2 className="text-2xl font-semibold text-white">{question.text || question.title || 'Question text not available'}</h2>
          </div>

          {/* Answer Input */}
          <div className="space-y-3">
            {question.type === 'multiple-choice' && question.options ? (
              Array.isArray(question.options) && question.options.length > 0 ? (
                question.options.map((option, index) => {
                  // Handle both string arrays and object arrays with text property
                  const optionText = typeof option === 'string' ? option : (option as any).text || '';
                  return (
                    <label
                      key={index}
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        studentAnswer?.answer === optionText
                          ? 'bg-violet-600/20 border-violet-500/50'
                          : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
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
                        <span className="text-white">{optionText}</span>
                      </div>
                    </label>
                  );
                })
              ) : (
                <div className="text-slate-400">No options available for this question</div>
              )
            ) : question.type === 'short-answer' ? (
              <input
                type="text"
                placeholder="Enter your short answer here..."
                value={studentAnswer?.answer || ''}
                onChange={e => handleAnswerChange(question.id, e.target.value)}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
              />
            ) : (
              <textarea
                placeholder="Enter your essay answer here..."
                value={studentAnswer?.answer || ''}
                onChange={e => handleAnswerChange(question.id, e.target.value)}
                rows={6}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 resize-none"
              />
            )}
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex gap-4 justify-between">
          <Button
            onClick={() =>
              setCurrentQuestionIndex(prev =>
                Math.max(0, prev - 1)
              )
            }
            disabled={currentQuestionIndex === 0}
            variant="outline"
            className="border-slate-700 text-slate-300 hover:bg-slate-800/50 disabled:opacity-50"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>

          {currentQuestionIndex === quiz.questions_data.length - 1 ? (
            <Button
              onClick={handleSubmit}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Send className="w-4 h-4 mr-2" />
              Submit Quiz
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
        <div className="mt-8 p-6 bg-slate-900/60 border border-slate-800 rounded-xl">
          <h3 className="text-sm font-semibold text-white mb-4">Question Navigation</h3>
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
