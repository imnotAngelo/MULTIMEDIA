    import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '@/lib/authFetch';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trash2, Loader2, Sparkles, Settings2, BookOpen, Wand2, CheckCircle2 } from 'lucide-react';

interface Unit {
  id: string;
  title: string;
}

interface Lesson {
  id: string;
  title: string;
}

interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

interface Question {
  id: string;
  title: string;
  type: 'multiple-choice' | 'short-answer';
  points: number;
  options: QuestionOption[];
}

export function AutoGenerateQuiz() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(true);
  const [selectedUnit, setSelectedUnit] = useState('');
  const [selectedLesson, setSelectedLesson] = useState('');
  const [generatedQuestions, setGeneratedQuestions] = useState<Question[]>([]);
  const [questionsGenerated, setQuestionsGenerated] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    dueDate: '',
    timeLimit: 30,
    shuffleQuestions: true,
    showCorrectAnswers: false,
    numberOfQuestions: 5,
  });

  useEffect(() => {
    fetchUnits();
  }, []);

  useEffect(() => {
    if (selectedUnit) {
      fetchLessons(selectedUnit);
    } else {
      setLessons([]);
      setSelectedLesson('');
    }
  }, [selectedUnit]);

  const fetchUnits = async () => {
    try {
      setLoadingUnits(true);
      const response = await authFetch('http://localhost:3001/api/units');

      if (response.ok) {
        const data = await response.json();
        const unitsList = Array.isArray(data.data) ? data.data : [];
        setUnits(unitsList);
      }
    } catch {
      // silently fail — units will remain empty
    } finally {
      setLoadingUnits(false);
    }
  };

  const fetchLessons = async (unitId: string) => {
    try {
      const response = await authFetch(`http://localhost:3001/api/units/${unitId}/lessons`);

      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.data)) {
          setLessons(data.data);
        }
      }
    } catch {
      // silently fail — lessons will remain empty
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'timeLimit' || name === 'numberOfQuestions' ? parseInt(value) : value,
    }));
  };

  const generateQuestions = async () => {
    if (!selectedUnit || !selectedLesson || !formData.title) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setGenerating(true);

      // Call the AI-powered question generation endpoint
      const response = await authFetch(`http://localhost:3001/api/lessons/${selectedLesson}/generate-questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          numberOfQuestions: formData.numberOfQuestions,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMsg = errorData?.error?.message || `HTTP ${response.status}`;
        throw new Error(errorMsg);
      }

      const data = await response.json();

      if (!data.success || !Array.isArray(data.data) || data.data.length === 0) {
        throw new Error('No questions were generated');
      }

      const aiQuestions: Question[] = data.data.map((q: any, idx: number) => ({
        id: String(idx + 1),
        title: q.text || q.title || '',
        type: q.type === 'short-answer' ? 'short-answer' : 'multiple-choice',
        points: q.points || 2,
        options: q.type === 'multiple-choice' && Array.isArray(q.options)
          ? q.options.map((opt: string, i: number) => ({
              id: String(i + 1),
              text: opt,
              isCorrect: opt === q.correctAnswer,
            }))
          : [],
      }));

      setGeneratedQuestions(aiQuestions);
      setQuestionsGenerated(true);
    } catch (error: any) {
      alert('Failed to generate questions: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleQuestionChange = (index: number, field: string, value: any) => {
    const updated = [...generatedQuestions];
    (updated[index] as any)[field] = value;
    setGeneratedQuestions(updated);
  };

  const handleOptionChange = (questionIndex: number, optionIndex: number, field: string, value: any) => {
    const updated = [...generatedQuestions];
    (updated[questionIndex].options[optionIndex] as any)[field] = value;
    setGeneratedQuestions(updated);
  };

  const removeQuestion = (index: number) => {
    if (generatedQuestions.length > 1) {
      setGeneratedQuestions(generatedQuestions.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.description || !formData.dueDate) {
      alert('Please fill in all required fields');
      return;
    }

    if (generatedQuestions.length === 0) {
      alert('Please generate questions first');
      return;
    }

    try {
      setLoading(true);

      const transformedQuestions = generatedQuestions.map(q => ({
        id: q.id,
        text: q.title,
        type: q.type,
        points: q.points,
        options: q.type === 'multiple-choice' ? q.options.map(o => o.text) : [],
        correctAnswer: q.type === 'multiple-choice'
          ? q.options.find(o => o.isCorrect)?.text
          : undefined,
      }));

      const payload = {
        title: formData.title,
        description: formData.description,
        type: 'quiz',
        unitId: selectedUnit,
        lessonName: selectedLesson,
        dueDate: formData.dueDate,
        totalPoints: transformedQuestions.reduce((sum, q) => sum + q.points, 0),
        timeLimit: formData.timeLimit,
        shuffleQuestions: formData.shuffleQuestions,
        showCorrectAnswers: formData.showCorrectAnswers,
        questions: transformedQuestions,
        generatedAutomatically: true,
      };

      const response = await authFetch('http://localhost:3001/api/assessments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();

        if (response.status === 401) {
          alert('Your session has expired. Please log in again.');
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('auth-storage');
          navigate('/login');
          return;
        }

        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      if (data.success) {
        navigate('/instructor/quizzes');
      } else {
        alert('Failed to create quiz: ' + data.message);
      }
    } catch (error) {
      alert('Error creating quiz: ' + String(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-violet-400 hover:text-violet-300 mb-6 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="mb-8 flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20">
            <Wand2 className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Auto-Generate Quiz</h1>
            <p className="text-slate-400 mt-0.5 text-sm">Create a quiz from lesson content using AI</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Configuration Section */}
          <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-2.5">
              <Settings2 className="w-5 h-5 text-slate-400" />
              <h2 className="text-lg font-semibold text-white">Quiz Configuration</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Quiz Title *</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="e.g., Chapter 5 Quiz"
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder:text-slate-600 focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Select Unit *</label>
                {loadingUnits ? (
                  <div className="flex items-center gap-2 text-slate-400 py-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Loading units...</span>
                  </div>
                ) : (
                  <select
                    value={selectedUnit}
                    onChange={(e) => {
                      setSelectedUnit(e.target.value);
                      setQuestionsGenerated(false);
                    }}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-violet-500 focus:outline-none"
                  >
                    <option value="">-- Select Unit --</option>
                    {units.map(unit => (
                      <option key={unit.id} value={unit.id}>{unit.title}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Select Lesson *</label>
                <select
                  value={selectedLesson}
                  onChange={(e) => {
                    setSelectedLesson(e.target.value);
                    setQuestionsGenerated(false);
                  }}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-violet-500 focus:outline-none"
                  disabled={!selectedUnit}
                >
                  <option value="">-- Select Lesson --</option>
                  {lessons.map(lesson => (
                    <option key={lesson.id} value={lesson.id}>{lesson.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Number of Questions</label>
                <input
                  type="number"
                  name="numberOfQuestions"
                  value={formData.numberOfQuestions}
                  onChange={handleInputChange}
                  min="1"
                  max="20"
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-violet-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Description *</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Describe the quiz purpose and content..."
                rows={2}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder:text-slate-600 focus:border-violet-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Due Date *</label>
                <input
                  type="datetime-local"
                  name="dueDate"
                  value={formData.dueDate}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Time Limit (minutes)</label>
                <input
                  type="number"
                  name="timeLimit"
                  value={formData.timeLimit}
                  onChange={handleInputChange}
                  min="1"
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-4">
                <label className="flex items-center gap-2 cursor-pointer mt-7">
                  <input
                    type="checkbox"
                    name="shuffleQuestions"
                    checked={formData.shuffleQuestions}
                    onChange={(e) => setFormData(prev => ({ ...prev, shuffleQuestions: e.target.checked }))}
                    className="w-4 h-4"
                  />
                  <span className="text-slate-300 text-sm">Shuffle questions</span>
                </label>
              </div>
            </div>

            {/* Generate Button */}
            {!questionsGenerated && (
              <div className="pt-4">
                <Button
                  type="button"
                  onClick={generateQuestions}
                  disabled={generating || !selectedUnit || !selectedLesson || !formData.title}
                  className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white h-12 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating Questions...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate Questions
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Generated Questions Section */}
          {questionsGenerated && (
            <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <BookOpen className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-lg font-semibold text-white">Generated Questions</h2>
                  <span className="text-xs font-medium text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">{generatedQuestions.length}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setQuestionsGenerated(false);
                    setGeneratedQuestions([]);
                  }}
                  className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
                >
                  Regenerate
                </button>
              </div>

              <div className="space-y-4">
                {generatedQuestions.map((question, qIndex) => (
                  <div key={question.id} className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">Question {qIndex + 1}</label>
                        <textarea
                          value={question.title}
                          onChange={(e) => handleQuestionChange(qIndex, 'title', e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-violet-500 focus:outline-none"
                        />
                      </div>
                      {generatedQuestions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeQuestion(qIndex)}
                          className="text-red-400 hover:text-red-300 mt-8"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Points</label>
                      <input
                        type="number"
                        value={question.points}
                        onChange={(e) => handleQuestionChange(qIndex, 'points', parseInt(e.target.value))}
                        min="1"
                        max="20"
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:border-violet-500 focus:outline-none"
                      />
                    </div>

                    <div className="rounded-lg p-3 space-y-2">
                      <label className="block text-xs font-medium text-slate-400">Question Type</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleQuestionChange(qIndex, 'type', 'multiple-choice')}
                          className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-all ${
                            question.type === 'multiple-choice'
                              ? 'bg-violet-600 text-white'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          }`}
                        >
                          Multiple Choice
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuestionChange(qIndex, 'type', 'short-answer')}
                          className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-all ${
                            question.type === 'short-answer'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          }`}
                        >
                          Short Answer
                        </button>
                      </div>
                    </div>

                    {question.type === 'multiple-choice' && (
                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-slate-400">Options (Select Correct Answer)</label>
                        {question.options.map((option, oIndex) => (
                          <div key={option.id} className="flex gap-2 items-center">
                            <input
                              type="radio"
                              name={`correct-${qIndex}`}
                              checked={option.isCorrect}
                              onChange={() => {
                                question.options.forEach((o, i) => {
                                  o.isCorrect = i === oIndex;
                                });
                                handleQuestionChange(qIndex, 'options', question.options);
                                setGeneratedQuestions([...generatedQuestions]);
                              }}
                              className="w-4 h-4"
                            />
                            <input
                              type="text"
                              value={option.text}
                              onChange={(e) => handleOptionChange(qIndex, oIndex, 'text', e.target.value)}
                              placeholder={`Option ${oIndex + 1}`}
                              className="flex-1 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm placeholder:text-slate-600 focus:border-violet-500 focus:outline-none"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submit Buttons */}
          {questionsGenerated && (
            <div className="flex gap-4">
              <Button
                type="button"
                onClick={() => navigate(-1)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating Quiz...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Create Quiz
                  </>
                )}
              </Button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
