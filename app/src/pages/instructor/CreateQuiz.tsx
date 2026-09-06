import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { AetherSpinner } from '@/components/AetherSpinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { authFetch } from '@/lib/authFetch';
import { API_BASE_URL } from '@/lib/apiConfig';
import { notificationService } from '@/services/notificationService';
import { useAuthStore } from '@/stores/authStore';

interface Question {
  id: string;
  text: string;
  type: 'multiple-choice' | 'short-answer' | 'essay' | 'true-false' | 'enumeration' | 'identification';
  options?: string[];
  correctAnswer?: string | string[];
  points: number;
}

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

const initialQuestion: Question = {
  id: '1',
  text: '',
  type: 'multiple-choice',
  options: ['', '', '', ''],
  correctAnswer: '',
  points: 1,
};

function createAutomaticChoices(question: Question): string[] {
  const answer = String(question.correctAnswer || '').trim() || 'Correct answer';
  const base = answer.replace(/[.!?]+$/, '').trim();
  const distractors = [
    `An unrelated idea about ${question.text.trim().slice(0, 35) || 'the topic'}`,
    `A common misunderstanding of ${base}`,
    `A detail that is not supported by the lesson`,
  ];
  return [answer, ...distractors];
}

function adaptQuestionTextForType(text: string, type: Question['type']): string {
  const multipleChoiceStem = text.match(/^Which statement best explains\s+(.+?)\??$/i);
  if (!multipleChoiceStem) return text;

  const topic = multipleChoiceStem[1].trim();
  if (type === 'true-false') {
    return `True or False: The lesson states that ${topic}.`;
  }
  if (type === 'short-answer' || type === 'identification' || type === 'enumeration') {
    return `What is the key idea about ${topic}?`;
  }
  if (type === 'essay') {
    return `Explain the importance of ${topic}.`;
  }
  return text;
}

export function CreateQuiz() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    unitId: '',
    lessonIds: [] as string[],
    lessonScope: 'selected' as 'all' | 'selected',
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
    allowLateSubmissions: false,
    timeLimit: 60,
    passingScore: 70,
  });

  const [units, setUnits] = useState<Unit[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([initialQuestion]);
  const [targetSections, setTargetSections] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [expandedQuestion, setExpandedQuestion] = useState<string>('1');

  useEffect(() => {
    loadUnits();
  }, []);

  useEffect(() => {
    if (!formData.unitId) {
      setLessons([]);
      return;
    }

    const loadLessons = async () => {
      try {
        setLoadingLessons(true);
        const response = await authFetch(`${API_BASE_URL}/units/${formData.unitId}/lessons`);
        const data = await response.json();
        const loadedLessons = response.ok && Array.isArray(data.data) ? data.data : [];
        setLessons(loadedLessons);
        if (formData.lessonScope === 'all' && formData.quizCategory === 'exam') {
          setFormData(prev => ({ ...prev, lessonIds: loadedLessons.map((lesson: Lesson) => lesson.id) }));
        }
      } catch {
        setLessons([]);
      } finally {
        setLoadingLessons(false);
      }
    };

    loadLessons();
  }, [formData.unitId]);

  const loadUnits = async () => {
    try {
      setLoading(true);
      const response = await authFetch(`${API_BASE_URL}/units`);
      const data = await response.json();
      setUnits(data.data || []);
    } catch (err) {
      setUnits([]);
    } finally {
      setLoading(false);
    }
  };

  const getQuestionTypeDefaults = (type: Question['type']) => {
    if (type === 'true-false') {
      return { options: ['True', 'False'], correctAnswer: 'True' };
    }
    if (type === 'multiple-choice') {
      return { options: ['', '', '', ''], correctAnswer: '' };
    }
    return { options: undefined, correctAnswer: '' };
  };

  const getQuizCategoryRange = (category: 'short' | 'long' | 'exam') => {
    const ranges = {
      short: { min: 5, max: 10, label: 'Short Quiz (5-10 questions)' },
      long: { min: 20, max: 30, label: 'Long Quiz (20-30 questions)' },
      exam: { min: 70, max: 100, label: 'Exam (70-100 questions)' },
    };
    return ranges[category];
  };

  const handleAddQuestion = () => {
    const questionType = getQuestionTypeForIndex(questions.length, formData.quizTypes, formData.quizCategory);
    const defaults = getQuestionTypeDefaults(questionType);
    const newQuestion: Question = {
      id: Date.now().toString(),
      text: '',
      type: questionType,
      ...(defaults.options ? { options: defaults.options } : {}),
      correctAnswer: defaults.correctAnswer,
      points: formData.pointsByType[questionType],
    };
    setQuestions([...questions, newQuestion]);
    setExpandedQuestion(newQuestion.id);
  };

  const getQuestionAllocation = (counts: Partial<Record<QuizType, number>>, types: QuizType[]) =>
    types.flatMap(type => Array.from({ length: Math.max(0, counts[type] || 0) }, () => type));

  const getQuestionTypeForIndex = (index: number, types: QuizType[], category: 'short' | 'long' | 'exam') => {
    const allocation = getQuestionAllocation(formData.questionCountsByType, types);
    return allocation[index] || types[index % types.length];
  };

  const updateQuizCategory = (quizCategory: 'short' | 'long' | 'exam') => {
    const quizTypes: QuizType[] = quizCategory === 'short'
      ? [formData.quizTypes[0] || 'multiple-choice']
      : quizCategory === 'long'
        ? ['multiple-choice', formData.quizTypes.find(type => type !== 'multiple-choice') || 'true-false']
        : ['multiple-choice', 'enumeration', 'true-false', 'identification', 'essay'];
    const questionCountsByType: Partial<Record<QuizType, number>> = quizCategory === 'short'
      ? { [formData.quizTypes[0] || 'multiple-choice']: 5 }
      : quizCategory === 'long'
        ? { 'multiple-choice': 10, [formData.quizTypes.find(type => type !== 'multiple-choice') || 'true-false']: 10 }
        : Object.fromEntries(['multiple-choice', 'enumeration', 'true-false', 'identification', 'essay'].map(type => [type, 20]));
    setFormData(prev => ({
      ...prev,
      quizCategory,
      quizTypes,
      questionCountsByType,
      lessonScope: quizCategory === 'exam' ? 'all' : prev.lessonScope,
      lessonIds: quizCategory === 'exam' ? lessons.map(lesson => lesson.id) : prev.lessonIds,
    }));
    setQuestions(prev => prev.map((question, index) => {
      const type = getQuestionAllocation(questionCountsByType, quizTypes)[index] || quizTypes[index % quizTypes.length];
      const defaults = getQuestionTypeDefaults(type);
      return { ...question, type, points: formData.pointsByType[type], ...(defaults.options ? { options: defaults.options } : { options: undefined }), correctAnswer: defaults.correctAnswer };
    }));
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
    if (selected.length > 0) {
      setFormData(prev => ({ ...prev, quizTypes: selected }));
      setQuestions(prev => prev.map((question, index) => {
        if (selected.includes(question.type as QuizType)) return question;
        const nextType = getQuestionAllocation(formData.questionCountsByType, selected)[index] || selected[index % selected.length];
        const defaults = getQuestionTypeDefaults(nextType);
        return { ...question, type: nextType, points: formData.pointsByType[nextType], ...(defaults.options ? { options: defaults.options } : { options: undefined }), correctAnswer: defaults.correctAnswer };
      }));
    }
  };

  const handleRemoveQuestion = (id: string) => {
    if (questions.length > 1) {
      setQuestions(questions.filter(q => q.id !== id));
    }
  };

  const handleUpdateQuestion = (id: string, updates: Partial<Question>) => {
    setQuestions(questions.map(q => (q.id === id ? { ...q, ...updates } : q)));
  };

  const handleQuestionTypeChange = (question: Question, value: Question['type']) => {
    const text = adaptQuestionTextForType(question.text, value);
    if (value === 'multiple-choice' && question.type !== 'multiple-choice') {
      handleUpdateQuestion(question.id, {
        type: value,
        text,
        options: createAutomaticChoices(question),
        correctAnswer: String(question.correctAnswer || '').trim() || 'Correct answer',
      });
      return;
    }
    if (value === 'true-false') {
      handleUpdateQuestion(question.id, {
        type: value,
        text,
        options: ['True', 'False'],
        correctAnswer: 'True',
      });
      return;
    }
    if (value === 'essay' || value === 'short-answer' || value === 'enumeration' || value === 'identification') {
      handleUpdateQuestion(question.id, {
        type: value,
        text,
        options: undefined,
        correctAnswer: typeof question.correctAnswer === 'string' ? question.correctAnswer : '',
      });
      return;
    }
    handleUpdateQuestion(question.id, { type: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const requiredTypeCount = formData.quizCategory === 'short' ? 1 : formData.quizCategory === 'long' ? 2 : 5;
    const configuredTotal = Object.values(formData.questionCountsByType).reduce((sum, count) => sum + (count || 0), 0);
    const categoryRange = getQuizCategoryRange(formData.quizCategory);
    const actualCounts = questions.reduce((counts, question) => ({ ...counts, [question.type]: (counts[question.type as QuizType] || 0) + 1 }), {} as Record<string, number>);
    const allocationMatches = formData.quizCategory === 'short'
      ? questions.length >= categoryRange.min && questions.length <= categoryRange.max
      : configuredTotal >= categoryRange.min && configuredTotal <= categoryRange.max && formData.quizTypes.every(type => (actualCounts[type] || 0) === (formData.questionCountsByType[type] || 0));
    if (!formData.title.trim() || !formData.unitId || formData.lessonIds.length === 0 || questions.length === 0 || formData.quizTypes.length !== requiredTypeCount || !allocationMatches) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      const response = await authFetch(`${API_BASE_URL}/assessments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          unitId: formData.unitId,
          lessonIds: formData.lessonIds,
          allowLateSubmissions: formData.allowLateSubmissions,
          type: 'quiz',
          quizCategory: formData.quizCategory,
          quizType: formData.quizTypes.length === 1 ? formData.quizTypes[0] : undefined,
          quizTypes: formData.quizTypes,
          questionCountsByType: formData.questionCountsByType,
          totalPoints: questions.reduce((total, question) => total + question.points, 0),
          timeLimit: formData.timeLimit,
          questions: questions,
          targetSections: targetSections.length > 0 ? targetSections : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to create quiz');
      }
      notificationService.notifyQuizAdded(formData.title);
      navigate('/instructor/quizzes');
    } catch (err: any) {
      alert('Failed to create quiz: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-white">Create Quiz</h1>
          <p className="text-sm text-slate-400 mt-1">Create a new quiz for your students</p>
        </div>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <AetherSpinner className="w-6 h-6 text-violet-400" />
            <p className="text-slate-400">Loading units...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card className="p-6 bg-slate-900/60 border-slate-800/60">
              <h2 className="text-lg font-semibold text-white mb-4">Quiz Details</h2>
              <div className="space-y-4">
                <div>
                  <Label className="text-slate-300">Quiz Title</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Enter quiz title"
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Enter quiz description"
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 mt-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-300">Quiz Category</Label>
                    <Select value={formData.quizCategory} onValueChange={(value) => updateQuizCategory(value as 'short' | 'long' | 'exam')}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="short" className="text-white">Short Quiz</SelectItem>
                        <SelectItem value="long" className="text-white">Long Quiz</SelectItem>
                        <SelectItem value="exam" className="text-white">Exam</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-slate-300">Question Types</Label>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {(['multiple-choice', 'enumeration', 'true-false', 'identification', 'essay'] as QuizType[]).map((type) => (
                        <label key={type} className="flex items-center gap-2 text-xs text-slate-300">
                          <input type="checkbox" checked={formData.quizTypes.includes(type)} disabled={formData.quizCategory === 'long' && type === 'multiple-choice'} onChange={() => toggleQuizType(type)} />
                          {type === 'multiple-choice' ? 'Multiple Choice' : type === 'true-false' ? 'True or False' : type.charAt(0).toUpperCase() + type.slice(1)}
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{formData.quizCategory === 'short' ? 'Choose 1 type.' : formData.quizCategory === 'long' ? 'Choose 2 types.' : 'All 5 types are required.'}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {formData.quizTypes.map((type) => (
                        <label key={`${type}-points`} className="text-xs text-slate-400">
                          {type === 'multiple-choice' ? 'Multiple Choice' : type === 'true-false' ? 'True or False' : type.charAt(0).toUpperCase() + type.slice(1)} points
                          <Input
                            type="number"
                            min="1"
                            value={formData.pointsByType[type]}
                            onChange={(e) => setFormData(prev => ({ ...prev, pointsByType: { ...prev.pointsByType, [type]: Math.max(1, parseInt(e.target.value) || 1) } }))}
                            className="mt-1 h-8 bg-slate-800 border-slate-700 text-white"
                          />
                        </label>
                      ))}
                    </div>
                    {formData.quizCategory !== 'short' && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {formData.quizTypes.map((type) => (
                          <label key={`${type}-count`} className="text-xs text-slate-400">
                            {type === 'multiple-choice' ? 'Multiple Choice' : type === 'true-false' ? 'True or False' : type.charAt(0).toUpperCase() + type.slice(1)} questions
                            <Input
                              type="number"
                              min="1"
                              value={formData.questionCountsByType[type] || 0}
                              onChange={(e) => setFormData(prev => ({ ...prev, questionCountsByType: { ...prev.questionCountsByType, [type]: Math.max(1, parseInt(e.target.value) || 1) } }))}
                              className="mt-1 h-8 bg-slate-800 border-slate-700 text-white"
                            />
                          </label>
                        ))}
                      </div>
                    )}
                    {formData.quizCategory !== 'short' && (
                      <p className="mt-2 text-xs text-slate-500">Total configured questions: {Object.values(formData.questionCountsByType).reduce((sum, count) => sum + (count || 0), 0)}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-300">Unit</Label>
                    <Select value={formData.unitId} onValueChange={(value) => setFormData({ ...formData, unitId: value, lessonIds: [] })}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1">
                        <SelectValue placeholder="Select a unit" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        {units.map(unit => (
                          <SelectItem key={unit.id} value={unit.id} className="text-white">
                            {unit.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-slate-300">Time Limit (minutes)</Label>
                    <Input
                      type="number"
                      value={formData.timeLimit}
                      onChange={(e) => setFormData({ ...formData, timeLimit: parseInt(e.target.value) })}
                      min="1"
                      className="bg-slate-800 border-slate-700 text-white mt-1"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-slate-300">Lessons in this unit</Label>
                  {formData.quizCategory === 'exam' && (
                    <div className="mt-2 flex gap-4 text-sm text-slate-300">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={formData.lessonScope === 'all'}
                          onChange={() => setFormData(prev => ({ ...prev, lessonScope: 'all', lessonIds: lessons.map(lesson => lesson.id) }))}
                        />
                        All lessons in this unit
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={formData.lessonScope === 'selected'}
                          onChange={() => setFormData(prev => ({ ...prev, lessonScope: 'selected' }))}
                        />
                        Choose lessons
                      </label>
                    </div>
                  )}
                  <div className="mt-2 space-y-2 rounded-md border border-slate-700 bg-slate-800 p-3">
                    {loadingLessons && <p className="text-xs text-slate-400">Loading lessons...</p>}
                    {!loadingLessons && lessons.map(lesson => (
                      <label key={lesson.id} className="flex items-center gap-2 text-sm text-slate-300">
                        <input
                          type="checkbox"
                          checked={formData.lessonIds.includes(lesson.id)}
                          disabled={formData.quizCategory === 'exam' && formData.lessonScope === 'all'}
                          onChange={() => setFormData(prev => ({ ...prev, lessonIds: prev.lessonIds.includes(lesson.id) ? prev.lessonIds.filter(id => id !== lesson.id) : [...prev.lessonIds, lesson.id] }))}
                        />
                        {lesson.title}
                      </label>
                    ))}
                    {!loadingLessons && formData.unitId && lessons.length === 0 && <p className="text-xs text-amber-300">No lessons are available in this unit.</p>}
                  </div>
                  {formData.unitId && !loadingLessons && lessons.length === 0 && (
                    <p className="mt-1 text-xs text-amber-300">No lessons are available in this unit.</p>
                  )}
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.allowLateSubmissions}
                    onChange={(e) => setFormData({ ...formData, allowLateSubmissions: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-violet-500"
                  />
                  Allow late submissions after the due date
                </label>
                <div>
                  <Label className="text-slate-300">Passing Score (%)</Label>
                  <Input
                    type="number"
                    value={formData.passingScore}
                    onChange={(e) => setFormData({ ...formData, passingScore: parseInt(e.target.value) })}
                    min="0"
                    max="100"
                    className="bg-slate-800 border-slate-700 text-white mt-1"
                  />
                </div>
              </div>
            </Card>

            {/* Teaching Sections Selection */}
            {user?.teaching_sections && user.teaching_sections.length > 0 && (
              <Card className="p-6 bg-slate-900/60 border-slate-800/60">
                <h2 className="text-lg font-semibold text-white mb-4">Assign to Sections</h2>
                <p className="text-sm text-slate-400 mb-4">Select which sections can access this quiz (leave unchecked for all sections)</p>
                <div className="flex flex-wrap gap-3">
                  {user.teaching_sections.map((section) => (
                    <label key={section} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={targetSections.includes(section)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setTargetSections([...targetSections, section]);
                          } else {
                            setTargetSections(targetSections.filter(s => s !== section));
                          }
                        }}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-violet-500 focus:ring-violet-500 cursor-pointer"
                      />
                      <span className="text-sm text-slate-300">{section}</span>
                    </label>
                  ))}
                </div>
              </Card>
            )}

            {/* Questions Section */}
            <Card className="p-6 bg-slate-900/60 border-slate-800/60">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Questions</h2>
                <Button type="button" onClick={handleAddQuestion} size="sm" className="bg-violet-600 hover:bg-violet-700 text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Question
                </Button>
              </div>
              <div className="space-y-3">
                {questions.map((question) => (
                  <div key={question.id} className="border border-slate-700 rounded-lg overflow-hidden bg-slate-800/40">
                    <button
                      type="button"
                      onClick={() => setExpandedQuestion(expandedQuestion === question.id ? '' : question.id)}
                      className="w-full flex items-center justify-between p-4 hover:bg-slate-800/60 transition-colors"
                    >
                      <span className="text-slate-200 font-medium">
                        {question.text || '(Untitled Question)'}
                      </span>
                      {expandedQuestion === question.id ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </button>
                    {expandedQuestion === question.id && (
                      <div className="border-t border-slate-700 p-4 space-y-4 bg-slate-900/40">
                        <div>
                          <Label className="text-slate-300">Question Text</Label>
                          <Textarea
                            value={question.text}
                            onChange={(e) => handleUpdateQuestion(question.id, { text: e.target.value })}
                            placeholder="Enter question text"
                            rows={2}
                            className="mt-1 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-slate-300">Question Type</Label>
                            <Select value={question.type} onValueChange={(value) => handleQuestionTypeChange(question, value as Question['type'])}>
                              <SelectTrigger className="mt-1 bg-slate-800 border-slate-700 text-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-slate-800 border-slate-700">
                                {formData.quizTypes.map((type) => (
                                  <SelectItem key={type} value={type} className="text-white">
                                    {type === 'multiple-choice' ? 'Multiple Choice' : type === 'true-false' ? 'True or False' : type.charAt(0).toUpperCase() + type.slice(1)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-slate-300">Points</Label>
                            <Input
                              type="number"
                              value={question.points}
                              onChange={(e) => handleUpdateQuestion(question.id, { points: parseInt(e.target.value) || 1 })}
                              min="1"
                              className="mt-1 bg-slate-800 border-slate-700 text-white"
                            />
                          </div>
                        </div>
                        {question.type === 'multiple-choice' && (
                          <div className="space-y-3">
                            <Label className="text-slate-300">Answer Choices</Label>
                            {(question.options || ['', '', '', '']).map((option, optionIndex) => (
                              <Input
                                key={`${question.id}-option-${optionIndex}`}
                                value={option}
                                onChange={(e) => {
                                  const options = [...(question.options || ['', '', '', ''])];
                                  const previousAnswer = String(question.correctAnswer || '');
                                  options[optionIndex] = e.target.value;
                                  handleUpdateQuestion(question.id, {
                                    options,
                                    correctAnswer: optionIndex === 0 || previousAnswer === option
                                      ? e.target.value
                                      : question.correctAnswer,
                                  });
                                }}
                                placeholder={`Choice ${String.fromCharCode(65 + optionIndex)}`}
                                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                              />
                            ))}
                            <p className="text-xs text-slate-500">The first choice is automatically marked as correct. Edit the choices as needed.</p>
                          </div>
                        )}
                        {(question.type === 'short-answer' || question.type === 'enumeration' || question.type === 'identification' || question.type === 'essay') && (
                          <div>
                            <Label className="text-slate-300">Correct Answer</Label>
                            <Input
                              value={typeof question.correctAnswer === 'string' ? question.correctAnswer : ''}
                              onChange={(e) => handleUpdateQuestion(question.id, { correctAnswer: e.target.value })}
                              placeholder={question.type === 'essay' ? 'Enter a model answer' : 'Enter the expected answer'}
                              className="mt-1 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                            />
                          </div>
                        )}
                        {question.type === 'true-false' && (
                          <div className="space-y-3">
                            <Label className="text-slate-300">Correct Answer</Label>
                            <div className="flex gap-3">
                              {['True', 'False'].map((option) => (
                                <label key={option} className="flex items-center gap-2 text-slate-300">
                                  <input
                                    type="radio"
                                    name={`true-false-${question.id}`}
                                    checked={String(question.correctAnswer || '') === option}
                                    onChange={() => handleUpdateQuestion(question.id, { correctAnswer: option })}
                                    className="h-4 w-4 accent-violet-500"
                                  />
                                  {option}
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="flex justify-end gap-2">
                          {questions.length > 1 && (
                            <Button
                              type="button"
                              onClick={() => handleRemoveQuestion(question.id)}
                              size="sm"
                              variant="outline"
                              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            <div className="flex gap-3 justify-end pt-4">
              <Button type="button" onClick={() => navigate('/instructor/quizzes')} variant="outline" className="border-slate-700 text-slate-300">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-violet-600 hover:bg-violet-700 text-white">
                {submitting ? 'Creating...' : 'Create Quiz'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
