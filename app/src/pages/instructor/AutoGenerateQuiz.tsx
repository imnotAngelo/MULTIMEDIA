    import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '@/lib/authFetch';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trash2, Sparkles, Settings2, BookOpen, Wand2, CheckCircle2 } from 'lucide-react';
import { AetherSpinner } from '@/components/AetherSpinner';
import { SectionYearTargetPicker } from '@/components/SectionYearTargetPicker';
import { useAuthStore } from '@/stores/authStore';

interface Unit {
  id: string;
  title: string;
}

interface Lesson {
  id: string;
  title: string;
}

type QuizType = 'multiple-choice' | 'enumeration' | 'true-false' | 'identification' | 'essay';
type PointsByType = Record<QuizType, number>;

interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

interface Question {
  id: string;
  title: string;
  type: 'multiple-choice' | 'short-answer' | 'essay' | 'true-false' | 'enumeration' | 'identification';
  points: number;
  options: QuestionOption[];
  correctAnswer?: string;
}

export function AutoGenerateQuiz() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(true);
  const [selectedUnit, setSelectedUnit] = useState('');
  const [selectedLessons, setSelectedLessons] = useState<string[]>([]);
  const [lessonScope, setLessonScope] = useState<'all' | 'selected'>('selected');
  const [generatedQuestions, setGeneratedQuestions] = useState<Question[]>([]);
  const [questionsGenerated, setQuestionsGenerated] = useState(false);
  const [targetSections, setTargetSections] = useState<string[]>([]);
  const [sectionInput, setSectionInput] = useState('');
  const [generationError, setGenerationError] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    dueDate: '',
    allowLateSubmissions: false,
    timeLimit: 30,
    shuffleQuestions: true,
    showCorrectAnswers: false,
    visibility: 'public' as 'public' | 'private',
    quizCategory: 'short' as 'short' | 'long' | 'exam',
    quizTypes: ['multiple-choice'] as QuizType[],
    pointsByType: {
      'multiple-choice': 1,
      enumeration: 2,
      'true-false': 2,
      identification: 2,
      essay: 5,
    } as PointsByType,
    questionCountsByType: {
      'multiple-choice': 10,
      'true-false': 10,
    } as Partial<Record<QuizType, number>>,
    numberOfQuestions: 5,
  });

  const getQuizCategoryRange = (category: 'short' | 'long' | 'exam') => ({
    short: { min: 5, max: 10 },
    long: { min: 20, max: 30 },
    exam: { min: 70, max: 100 },
  }[category]);

  const updateCategory = (quizCategory: 'short' | 'long' | 'exam') => {
    const range = getQuizCategoryRange(quizCategory);
    const quizTypes: QuizType[] = quizCategory === 'short'
      ? [formData.quizTypes[0] || 'multiple-choice']
      : quizCategory === 'long'
        ? ['multiple-choice', formData.quizTypes.find(type => type !== 'multiple-choice') || 'true-false']
        : ['multiple-choice', 'enumeration', 'true-false', 'identification', 'essay'] as QuizType[];
    const questionCountsByType: Partial<Record<QuizType, number>> = quizCategory === 'short'
      ? { [quizTypes[0]]: 5 }
      : quizCategory === 'long'
        ? { 'multiple-choice': 10, [quizTypes[1]]: 10 }
        : Object.fromEntries(quizTypes.map(type => [type, 20]));
    setFormData(prev => ({
      ...prev,
      quizCategory,
      quizTypes,
      questionCountsByType,
      numberOfQuestions: Math.min(Math.max(prev.numberOfQuestions, range.min), range.max),
    }));
    if (quizCategory === 'exam') {
      setLessonScope('all');
      setSelectedLessons(lessons.map(lesson => lesson.id));
    }
  };

  const toggleQuizType = (type: QuizType) => {
    if (formData.quizCategory === 'long' && type === 'multiple-choice') return;
    const maxTypes = formData.quizCategory === 'short' ? 1 : formData.quizCategory === 'long' ? 2 : 5;
    const selected = formData.quizCategory === 'long'
      ? formData.quizTypes.includes(type)
        ? ['multiple-choice'] as QuizType[]
        : ['multiple-choice', type] as QuizType[]
      : formData.quizTypes.includes(type)
      ? formData.quizTypes.filter(item => item !== type)
      : [...formData.quizTypes, type].slice(0, maxTypes);
    if (selected.length > 0) setFormData(prev => ({
      ...prev,
      quizTypes: selected,
      questionCountsByType: selected.reduce((counts, selectedType) => ({ ...counts, [selectedType]: prev.questionCountsByType[selectedType] || 10 }), {}),
    }));
  };

  const configuredQuestionTotal = () => formData.quizCategory === 'short'
    ? formData.numberOfQuestions
    : Object.values(formData.questionCountsByType).reduce((sum, count) => sum + (count || 0), 0);

  useEffect(() => {
    fetchUnits();
  }, []);

  useEffect(() => {
    if (selectedUnit) {
      fetchLessons(selectedUnit);
    } else {
      setLessons([]);
      setSelectedLessons([]);
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
          if (lessonScope === 'all' && formData.quizCategory === 'exam') {
            setSelectedLessons(data.data.map((lesson: Lesson) => lesson.id));
          }
        }
      }
    } catch {
      // silently fail — lessons will remain empty
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const isNumericField = ['timeLimit', 'numberOfQuestions'].includes(name);
    const numericValue = value === '' ? 1 : Number.parseInt(value, 10);
    setFormData(prev => ({
      ...prev,
      [name]: isNumericField && Number.isFinite(numericValue) ? numericValue : value,
    }));
  };

  const generateQuestions = async () => {
    const requiredTypeCount = formData.quizCategory === 'short' ? 1 : formData.quizCategory === 'long' ? 2 : 5;
    if (!selectedUnit || selectedLessons.length === 0 || !formData.title || formData.quizTypes.length !== requiredTypeCount) {
      alert('Please fill in all required fields');
      return;
    }
    const categoryRange = getQuizCategoryRange(formData.quizCategory);
    const requestedQuestionTotal = configuredQuestionTotal();
    if (requestedQuestionTotal < categoryRange.min || requestedQuestionTotal > categoryRange.max) {
      alert(`This category requires ${categoryRange.min}-${categoryRange.max} questions.`);
      return;
    }

    try {
      setGenerating(true);
      setGenerationError('');

      // Generate in small quota-aware batches so long exams do not get truncated
      // by one oversized AI response.
      const generatedData: any[] = [];
      const fallbackGeneratedData: any[] = [];
      const seenGeneratedQuestions = new Set<string>();
      const allocation = formData.quizTypes.flatMap(type => Array.from({ length: formData.questionCountsByType[type] || 0 }, () => type));
      let batchStart = 0;
      let attempts = 0;

      while (batchStart < requestedQuestionTotal && attempts < 12) {
        const batchTypes = allocation.slice(batchStart, Math.min(batchStart + 10, requestedQuestionTotal));
        const batchCounts = batchTypes.reduce((counts, type) => ({ ...counts, [type]: (counts[type] || 0) + 1 }), {} as Record<string, number>);
        const responses = await Promise.all(selectedLessons.map(lessonId => authFetch(`http://localhost:3001/api/lessons/${lessonId}/generate-questions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            numberOfQuestions: batchTypes.length,
            quizTypes: formData.quizTypes,
            pointsByType: formData.pointsByType,
            questionCountsByType: batchCounts,
            quizCategory: formData.quizCategory,
            generationAttempt: attempts,
          }),
        })));
        const responseData = await Promise.all(responses.map(async item => item.ok ? item.json() : null));
        const batchQuestions = responseData.flatMap(data => data?.success && Array.isArray(data.data) ? data.data : []);

        for (const question of batchQuestions) {
          const key = String(question.text || question.title || '').replace(/\s+/g, ' ').trim().toLowerCase();
          fallbackGeneratedData.push(question);
          if (key && !seenGeneratedQuestions.has(key)) {
            seenGeneratedQuestions.add(key);
            generatedData.push(question);
          }
        }

        batchStart = generatedData.length;
        attempts += 1;
        if (batchQuestions.length === 0) break;
      }

      if (generatedData.length === 0) throw new Error('No questions were generated');

      // If the source has fewer unique concepts than the requested exam size,
      // reuse valid source questions as a final fallback instead of failing.
      let fallbackIndex = 0;
      while (generatedData.length < requestedQuestionTotal && fallbackGeneratedData.length > 0) {
        generatedData.push({
          ...fallbackGeneratedData[fallbackIndex % fallbackGeneratedData.length],
          id: `fallback-${generatedData.length + 1}`,
          text: `${fallbackGeneratedData[fallbackIndex % fallbackGeneratedData.length].text || fallbackGeneratedData[fallbackIndex % fallbackGeneratedData.length].title} (${formData.quizTypes[generatedData.length % formData.quizTypes.length]})`,
        });
        fallbackIndex += 1;
      }

      const aiQuestions: Question[] = generatedData
        .map((q: any, idx: number) => {
          const type = allocation[idx] || formData.quizTypes[idx % formData.quizTypes.length];
          const title = (q.text || q.title || '').trim();
          const answer = String(q.correctAnswer || q.answer || '').trim();
          const sourceOptions = Array.isArray(q.options)
            ? q.options.map((option: any) => String(typeof option === 'string' ? option : option?.text || '').trim()).filter(Boolean)
            : [];
          const options = type === 'multiple-choice'
            ? [...new Set([answer || 'Correct answer', ...sourceOptions])]
                .concat([
                  `A different answer about ${title.slice(0, 30) || 'the lesson'}`,
                  'A related but incorrect answer',
                  'An answer not supported by the lesson',
                ])
                .slice(0, 4)
                .map((text, optionIndex) => ({ id: String(optionIndex + 1), text, isCorrect: text === (answer || 'Correct answer') }))
            : type === 'true-false'
              ? ['True', 'False'].map((text, optionIndex) => ({ id: String(optionIndex + 1), text, isCorrect: text.toLowerCase() === answer.toLowerCase() }))
              : [];

          return {
            id: String(idx + 1),
            title,
            type,
            points: formData.pointsByType[type],
            correctAnswer: type === 'multiple-choice' ? options.find(option => option.isCorrect)?.text || options[0]?.text : type === 'true-false' ? (answer.toLowerCase() === 'false' ? 'False' : 'True') : answer,
            options,
          };
        })
        .filter((q: { title: string | any[]; }) => q.title.length > 0)
        .slice(0, requestedQuestionTotal);

      const cleanedQuestions = normalizeQuestionSet(aiQuestions, true);
      if (cleanedQuestions.length === 0) {
        throw new Error('The generated content did not produce valid unique questions. Please regenerate.');
      }
      if (cleanedQuestions.length < requestedQuestionTotal) {
        throw new Error(`Only ${cleanedQuestions.length} of ${requestedQuestionTotal} questions were generated. Please try again or select more lessons.`);
      }

      setGeneratedQuestions(cleanedQuestions);
      setQuestionsGenerated(true);
    } catch (error: any) {
      const message = error?.name === 'AbortError'
        ? 'Quiz generation timed out. Please try again or reduce the number of questions.'
        : error?.message || 'Unable to generate questions.';
      setGenerationError(`Failed to generate questions: ${message}`);
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

  const normalizeQuestionSet = (questions: Question[], allowDuplicateQuestions = false) => {
    const seen = new Set<string>();
    return questions.filter((question) => {
      const text = question.title.trim();
      const key = text.toLowerCase();
      if (!text || (!allowDuplicateQuestions && seen.has(key))) return false;
      seen.add(key);
      return true;
    }).map((question) => {
      const normalizedQuestion = { ...question, title: question.title.trim() };

      if (normalizedQuestion.type === 'multiple-choice') {
        const options = normalizedQuestion.options
          .map((option) => ({ ...option, text: option.text.trim() }))
          .filter((option) => option.text.length > 0)
          .filter((option, idx, arr) => arr.findIndex((candidate) => candidate.text.toLowerCase() === option.text.toLowerCase()) === idx)
          .slice(0, 4);

        if (options.length < 4) {
          return null;
        }

        const hasCorrectAnswer = options.some((option) => option.isCorrect);
        const correctedOptions = options.map((option, idx) => ({
          ...option,
          isCorrect: hasCorrectAnswer ? option.isCorrect : idx === 0,
        }));

        return { ...normalizedQuestion, options: correctedOptions, correctAnswer: correctedOptions.find((option) => option.isCorrect)?.text || '' };
      }

      return normalizedQuestion;
    }).filter(Boolean) as Question[];
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

    const cleanedQuestions = normalizeQuestionSet(generatedQuestions);
    if (cleanedQuestions.length !== generatedQuestions.length) {
      alert('Please remove duplicate or incomplete questions before creating the quiz.');
      setGeneratedQuestions(cleanedQuestions);
      return;
    }

    try {
      setLoading(true);

      const transformedQuestions = cleanedQuestions.map(q => ({
        id: q.id,
        text: q.title,
        type: q.type,
        points: q.points,
        options: q.type === 'multiple-choice' ? q.options.map(o => o.text) : [],
        correctAnswer: q.type === 'multiple-choice'
          ? q.options.find(o => o.isCorrect)?.text
          : q.correctAnswer || undefined,
      }));

      const payload = {
        title: formData.title,
        description: formData.description,
        type: 'quiz',
        unitId: selectedUnit,
        lessonIds: selectedLessons,
        dueDate: formData.dueDate,
        allowLateSubmissions: formData.allowLateSubmissions,
        totalPoints: transformedQuestions.reduce((sum, q) => sum + q.points, 0),
        timeLimit: formData.timeLimit,
        shuffleQuestions: formData.shuffleQuestions,
        showCorrectAnswers: formData.showCorrectAnswers,
        questions: transformedQuestions,
        generatedAutomatically: true,
        visibility: formData.visibility,
        quizCategory: formData.quizCategory,
        quizType: formData.quizTypes.length === 1 ? formData.quizTypes[0] : undefined,
        quizTypes: formData.quizTypes,
        questionCountsByType: formData.questionCountsByType,
        pointsByType: formData.pointsByType,
        targetSections,
      };

      const createQuiz = (allowDuplicate = false) => authFetch('http://localhost:3001/api/assessments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...payload, allowDuplicate }),
      });

      let response = await createQuiz();

      if (response.status === 409) {
        const duplicateData = await response.json().catch(() => null);
        const existingTitle = duplicateData?.error?.existingQuiz?.title || 'a quiz';
        const addAnother = window.confirm(
          `This lesson already has ${existingTitle}. Do you want to add another quiz?`
        );

        if (!addAnother) {
          return;
        }

        response = await createQuiz(true);
      }

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
                    <AetherSpinner className="w-4 h-4" />
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Select Lessons *</label>
                {formData.quizCategory === 'exam' && (
                  <div className="mb-2 flex gap-4 text-sm text-slate-300">
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={lessonScope === 'all'} onChange={() => { setLessonScope('all'); setSelectedLessons(lessons.map(lesson => lesson.id)); }} />
                      All lessons in this unit
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={lessonScope === 'selected'} onChange={() => setLessonScope('selected')} />
                      Choose lessons
                    </label>
                  </div>
                )}
                <select
                  value={selectedLessons}
                  onChange={(e) => {
                    setSelectedLessons(Array.from(e.target.selectedOptions, option => option.value));
                    setQuestionsGenerated(false);
                  }}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-violet-500 focus:outline-none"
                  disabled={!selectedUnit || (formData.quizCategory === 'exam' && lessonScope === 'all')}
                  multiple
                  size={Math.min(Math.max(lessons.length, 3), 6)}
                >
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
                  value={formData.quizCategory === 'short' ? formData.numberOfQuestions : configuredQuestionTotal()}
                  onChange={handleInputChange}
                  min={getQuizCategoryRange(formData.quizCategory).min}
                  max={getQuizCategoryRange(formData.quizCategory).max}
                  disabled={formData.quizCategory !== 'short'}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-violet-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Quiz Category</label>
                <select
                  value={formData.quizCategory}
                  onChange={(e) => updateCategory(e.target.value as 'short' | 'long' | 'exam')}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-violet-500 focus:outline-none"
                >
                  <option value="short">Short Quiz (5-10 questions)</option>
                  <option value="long">Long Quiz (20-30 questions)</option>
                  <option value="exam">Exam (70-100 questions)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Question Types</label>
                <div className="grid grid-cols-2 gap-2 rounded-md border border-slate-700 bg-slate-800 p-3">
                  {(['multiple-choice', 'enumeration', 'true-false', 'identification', 'essay'] as QuizType[]).map((type) => (
                    <label key={type} className="flex items-center gap-2 text-xs text-slate-300">
                      <input type="checkbox" checked={formData.quizTypes.includes(type)} disabled={formData.quizCategory === 'long' && type === 'multiple-choice'} onChange={() => toggleQuizType(type)} />
                      {type === 'multiple-choice' ? 'Multiple Choice' : type === 'true-false' ? 'True or False' : type.charAt(0).toUpperCase() + type.slice(1)}
                    </label>
                  ))}
                </div>
                {formData.quizCategory !== 'short' && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {formData.quizTypes.map((type) => (
                      <label key={`${type}-count`} className="text-xs text-slate-400">
                        {type === 'multiple-choice' ? 'Multiple Choice' : type === 'true-false' ? 'True or False' : type.charAt(0).toUpperCase() + type.slice(1)} questions
                        <input
                          type="number"
                          min="1"
                          value={formData.questionCountsByType[type] || 0}
                          onChange={(e) => setFormData(prev => ({ ...prev, questionCountsByType: { ...prev.questionCountsByType, [type]: Math.max(1, parseInt(e.target.value) || 1) } }))}
                          className="mt-1 w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white"
                        />
                      </label>
                    ))}
                  </div>
                )}
                {formData.quizCategory !== 'short' && (
                  <p className="mt-2 text-xs text-slate-500">Total configured questions: {configuredQuestionTotal()}</p>
                )}
                <p className="text-xs text-slate-500 mt-1">{formData.quizCategory === 'short' ? 'Choose 1 type.' : formData.quizCategory === 'long' ? 'Choose 2 types.' : 'All 5 types are required.'}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {formData.quizTypes.map((type) => (
                    <label key={`${type}-points`} className="text-xs text-slate-400">
                      {type === 'multiple-choice' ? 'Multiple Choice' : type === 'true-false' ? 'True or False' : type.charAt(0).toUpperCase() + type.slice(1)} points
                      <input
                        type="number"
                        min="1"
                        value={formData.pointsByType[type]}
                        onChange={(e) => setFormData(prev => ({ ...prev, pointsByType: { ...prev.pointsByType, [type]: Math.max(1, parseInt(e.target.value) || 1) } }))}
                        className="mt-1 w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white"
                      />
                    </label>
                  ))}
                </div>
                {formData.quizCategory === 'exam' && (
                  <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
                    <label className="block text-xs font-medium text-amber-200 mb-1">Exam Visibility</label>
                    <select
                      value={formData.visibility}
                      onChange={(e) => setFormData(prev => ({ ...prev, visibility: e.target.value as 'public' | 'private' }))}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
                    >
                      <option value="public">Public - students can see it</option>
                      <option value="private">Private - save as draft</option>
                    </select>
                  </div>
                )}
              </div>
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
              <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={formData.allowLateSubmissions}
                  onChange={(e) => setFormData(prev => ({ ...prev, allowLateSubmissions: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-violet-500"
                />
                Allow late submissions
              </label>

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

            <SectionYearTargetPicker
              yearLevels={[]}
              onYearLevelsChange={() => undefined}
              sections={targetSections}
              onSectionsChange={setTargetSections}
              sectionInput={sectionInput}
              onSectionInputChange={setSectionInput}
              showYearLevels={false}
              sectionOptions={user?.teaching_sections || []}
            />

            {/* Generate Button */}
            {!questionsGenerated && (
              <div className="pt-4">
                {generationError && (
                  <div role="alert" className="mb-3 rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">
                    {generationError}
                  </div>
                )}
                <Button
                  type="button"
                  onClick={generateQuestions}
                  disabled={generating || !selectedUnit || selectedLessons.length === 0 || !formData.title}
                  className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white h-12 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
                >
                  {generating ? (
                    <>
                      <AetherSpinner className="w-4 h-4" />
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
                        {formData.quizTypes.filter((type) => type !== 'multiple-choice').map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => handleQuestionChange(qIndex, 'type', type)}
                            className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-all ${question.type === type ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                          >
                            {type === 'true-false' ? 'True or False' : type.charAt(0).toUpperCase() + type.slice(1)}
                          </button>
                        ))}
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
                    {question.type !== 'multiple-choice' && (
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Model Answer</label>
                        <input
                          type="text"
                          value={question.correctAnswer || ''}
                          onChange={(e) => handleQuestionChange(qIndex, 'correctAnswer', e.target.value)}
                          placeholder={question.type === 'essay' ? 'Enter a model answer for AI-assisted grading' : 'Enter the expected answer'}
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm placeholder:text-slate-600 focus:border-violet-500 focus:outline-none"
                        />
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
                    <AetherSpinner className="w-4 h-4" />
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
