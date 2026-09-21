import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '@/lib/authFetch';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Trash2,
  Sparkles,
  Settings2,
  BookOpen,
  Wand2,
  CheckCircle2,
  Clock,
  Award,
  Layers,
  HelpCircle,
  PlusCircle,
  RotateCcw,
  AlertTriangle,
  ChevronRight,
  ListOrdered,
  FileText,
  Calendar,
  Eye,
  Check,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { AetherSpinner } from '@/components/AetherSpinner';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';

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

const QUESTION_TYPE_LABELS: Record<QuizType, string> = {
  'multiple-choice': 'Multiple Choice',
  'true-false': 'True or False',
  identification: 'Identification',
  enumeration: 'Enumeration',
  essay: 'Essay / Analysis',
};

const QUESTION_TYPE_COLORS: Record<QuizType, { bg: string; text: string; border: string }> = {
  'multiple-choice': { bg: 'bg-violet-500/10', text: 'text-violet-500', border: 'border-violet-500/30' },
  'true-false': { bg: 'bg-sky-500/10', text: 'text-sky-500', border: 'border-sky-500/30' },
  identification: { bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/30' },
  enumeration: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/30' },
  essay: { bg: 'bg-rose-500/10', text: 'text-rose-500', border: 'border-rose-500/30' },
};

export function AutoGenerateQuiz() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const theme = useThemeStore((state) => state.theme);
  const isLightMode = theme === 'light';

  // Step state: 1 = Curriculum Scope, 2 = Blueprint & Rules, 3 = Review & Finalize
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Styles
  const shellClass = isLightMode
    ? 'min-h-screen bg-slate-100 text-slate-900 p-6'
    : 'min-h-screen bg-slate-950 text-white p-6';
  const panelClass = isLightMode
    ? 'bg-white border border-slate-200 rounded-xl p-6 space-y-6 shadow-sm'
    : 'bg-slate-900/70 border border-slate-800 rounded-xl p-6 space-y-6';
  const nestedCardClass = isLightMode
    ? 'bg-slate-50 border border-slate-200 rounded-lg p-4'
    : 'bg-slate-800/50 border border-slate-700/60 rounded-lg p-4';
  const fieldClass = isLightMode
    ? 'w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 focus:outline-none transition-all'
    : 'w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 focus:outline-none transition-all';
  const labelTextClass = isLightMode ? 'text-slate-700 font-medium' : 'text-slate-300 font-medium';
  const mutedTextClass = isLightMode ? 'text-slate-500' : 'text-slate-400';

  // Form State
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingPhase, setGeneratingPhase] = useState<string>('');
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);

  const [units, setUnits] = useState<Unit[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(true);
  const [selectedUnit, setSelectedUnit] = useState('');
  const [selectedLessons, setSelectedLessons] = useState<string[]>([]);
  const [lessonScope, setLessonScope] = useState<'all' | 'selected'>('selected');
  const [generatedQuestions, setGeneratedQuestions] = useState<Question[]>([]);
  const [targetSections, setTargetSections] = useState<string[]>([]);

  // Duplicate Assessment Dialog
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateTitle, setDuplicateTitle] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    dueDate: '',
    allowLateSubmissions: false,
    timeLimit: 30,
    passingPercentage: 75,
    shuffleQuestions: true,
    showCorrectAnswers: false,
    visibility: 'public' as 'public' | 'private',
    quizCategory: 'short' as 'short' | 'long' | 'exam',
    quizTypes: ['multiple-choice'] as QuizType[],
    pointsByType: {
      'multiple-choice': 1,
      enumeration: 2,
      'true-false': 1,
      identification: 2,
      essay: 5,
    } as PointsByType,
    questionCountsByType: {
      'multiple-choice': 5,
      'true-false': 0,
      identification: 0,
      enumeration: 0,
      essay: 0,
    } as Partial<Record<QuizType, number>>,
    numberOfQuestions: 5,
  });

  const getQuizCategoryRange = (category: 'short' | 'long' | 'exam') => ({
    short: { min: 5, max: 10, defaultCount: 5 },
    long: { min: 20, max: 30, defaultCount: 20 },
    exam: { min: 70, max: 100, defaultCount: 70 },
  }[category]);

  const updateCategory = (category: 'short' | 'long' | 'exam') => {
    const range = getQuizCategoryRange(category);
    let nextTypes: QuizType[] = ['multiple-choice'];
    if (category === 'long') nextTypes = ['multiple-choice', 'true-false'];
    if (category === 'exam') nextTypes = ['multiple-choice', 'true-false', 'identification', 'enumeration', 'essay'];

    const perTypeCount = Math.floor(range.defaultCount / nextTypes.length);
    const newCounts: Partial<Record<QuizType, number>> = {};
    nextTypes.forEach((t, i) => {
      newCounts[t] = i === 0 ? range.defaultCount - (perTypeCount * (nextTypes.length - 1)) : perTypeCount;
    });

    setFormData((prev) => ({
      ...prev,
      quizCategory: category,
      quizTypes: nextTypes,
      questionCountsByType: newCounts,
      numberOfQuestions: range.defaultCount,
      timeLimit: category === 'short' ? 20 : category === 'long' ? 45 : 90,
    }));

    if (category === 'exam') {
      setLessonScope('all');
      setSelectedLessons(lessons.map((l) => l.id));
    }
  };

  const toggleQuizType = (type: QuizType) => {
    const isSelected = formData.quizTypes.includes(type);
    let nextTypes: QuizType[] = [];

    if (isSelected) {
      if (formData.quizTypes.length === 1) {
        toast.warning('At least one question type must be selected.');
        return;
      }
      nextTypes = formData.quizTypes.filter((t) => t !== type);
    } else {
      nextTypes = [...formData.quizTypes, type];
    }

    const currentTotal = configuredQuestionTotal();
    const perTypeCount = Math.max(1, Math.floor(currentTotal / nextTypes.length));
    const newCounts: Partial<Record<QuizType, number>> = {};
    nextTypes.forEach((t) => {
      newCounts[t] = formData.questionCountsByType[t] || perTypeCount;
    });

    setFormData((prev) => ({
      ...prev,
      quizTypes: nextTypes,
      questionCountsByType: newCounts,
    }));
  };

  const configuredQuestionTotal = () =>
    Object.entries(formData.questionCountsByType).reduce(
      (sum, [type, count]) => (formData.quizTypes.includes(type as QuizType) ? sum + (Number(count) || 0) : sum),
      0
    );

  const calculatedTotalPoints = () => {
    if (generatedQuestions.length > 0) {
      return generatedQuestions.reduce((sum, q) => sum + (Number(q.points) || 1), 0);
    }
    return Object.entries(formData.questionCountsByType).reduce((sum, [type, count]) => {
      if (!formData.quizTypes.includes(type as QuizType)) return sum;
      const pts = formData.pointsByType[type as QuizType] || 1;
      return sum + (Number(count) || 0) * pts;
    }, 0);
  };

  // Load Units for Instructor
  useEffect(() => {
    fetchUnits();
  }, [user?.id]);

  // Load Lessons when selectedUnit changes
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
      const response = await authFetch('/units', { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        const unitsList = Array.isArray(data.data) ? data.data : [];
        setUnits(unitsList);
      }
    } catch {
      toast.error('Could not load course units. Please check connection.');
    } finally {
      setLoadingUnits(false);
    }
  };

  const fetchLessons = async (unitId: string) => {
    try {
      const response = await authFetch(`/units/${unitId}/lessons`, { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.data)) {
          const loadedLessons = data.data as Lesson[];
          setLessons(loadedLessons);
          if (lessonScope === 'all') {
            setSelectedLessons(loadedLessons.map((l) => l.id));
          }
        }
      }
    } catch {
      toast.error('Failed to load lessons for selected unit.');
    }
  };

  const autoSuggestTitle = () => {
    const unitObj = units.find((u) => u.id === selectedUnit);
    const categoryLabel =
      formData.quizCategory === 'short'
        ? 'Short Quiz'
        : formData.quizCategory === 'long'
        ? 'Comprehensive Quiz'
        : 'Major Examination';

    if (unitObj) {
      setFormData((prev) => ({
        ...prev,
        title: `${unitObj.title} - ${categoryLabel}`,
        description: `Assessment covering curriculum concepts from ${unitObj.title}.`,
      }));
      toast.success('Title auto-suggested based on curriculum scope.');
    } else {
      toast.info('Select a Unit first to generate an contextual title.');
    }
  };

  // Step 1 Validation
  const handleProceedToStep2 = () => {
    if (!selectedUnit) {
      toast.error('Please select an instructional unit.');
      return;
    }
    if (selectedLessons.length === 0) {
      toast.error('Please select at least one lesson to source questions from.');
      return;
    }
    if (!formData.title.trim()) {
      toast.error('Please provide a title for the assessment.');
      return;
    }
    setCurrentStep(2);
  };

  // Step 2 Validation & AI Generation Trigger
  const handleGenerateQuestions = async () => {
    const categoryRange = getQuizCategoryRange(formData.quizCategory);
    const totalCount = configuredQuestionTotal();

    if (totalCount < categoryRange.min || totalCount > categoryRange.max) {
      toast.error(
        `${formData.quizCategory.toUpperCase()} category requires between ${categoryRange.min} and ${categoryRange.max} questions (current: ${totalCount}).`
      );
      return;
    }

    try {
      setGenerating(true);
      setGeneratingPhase('Analyzing instructional documents and extracting core concepts...');

      const primaryLessonId = selectedLessons[0];
      const batchSize = Math.min(totalCount, 15);
      const batchesNeeded = Math.ceil(totalCount / batchSize);
      const maxBatches = batchesNeeded + 3;
      let accumulatedQuestions: Question[] = [];

      for (let batch = 0; batch < maxBatches && accumulatedQuestions.length < totalCount; batch++) {
        setGeneratingPhase(`Synthesizing assessment items (Batch ${batch + 1} of up to ${maxBatches})...`);

        const questionsForThisBatch = Math.min(batchSize, totalCount - accumulatedQuestions.length);
        const batchQuestionCounts: Partial<Record<QuizType, number>> = {};

        formData.quizTypes.forEach((type) => {
          const totalForType = formData.questionCountsByType[type] || 0;
          batchQuestionCounts[type] = Math.max(1, Math.ceil(totalForType / batchesNeeded));
        });

        const res = await authFetch(`/lessons/${primaryLessonId}/generate-questions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lessonIds: selectedLessons,
            numberOfQuestions: questionsForThisBatch,
            quizCategory: formData.quizCategory,
            quizTypes: formData.quizTypes,
            questionCountsByType: batchQuestionCounts,
            pointsByType: formData.pointsByType,
            generationAttempt: batch,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const errMsg = errData?.error?.message || errData?.message || `HTTP ${res.status}`;
          throw new Error(errMsg);
        }

        const data = await res.json();
        const batchItems: any[] = Array.isArray(data.data) ? data.data : [];

        const normalizedBatch: Question[] = batchItems.map((item, idx) => {
          const qType: Question['type'] = item.type || 'multiple-choice';
          const options: QuestionOption[] = Array.isArray(item.options)
            ? item.options.map((opt: any, optIdx: number) => ({
                id: `opt-${batch}-${idx}-${optIdx}`,
                text: typeof opt === 'string' ? opt : opt.text || '',
                isCorrect: typeof opt === 'object' ? Boolean(opt.isCorrect) : String(opt) === String(item.correctAnswer),
              }))
            : [];

          return {
            id: `gen-${Date.now()}-${batch}-${idx}`,
            title: item.text || item.title || 'Untitled Question',
            type: qType,
            points: Number(item.points) || formData.pointsByType[qType as QuizType] || 1,
            options,
            correctAnswer: item.correctAnswer || (options.find((o) => o.isCorrect)?.text ?? ''),
          };
        });

        accumulatedQuestions = [...accumulatedQuestions, ...normalizedBatch].slice(0, totalCount);
      }

      if (accumulatedQuestions.length < totalCount) {
        throw new Error(`AI generated ${accumulatedQuestions.length} of ${totalCount} valid questions after multiple attempts. Please try again.`);
      }

      setGeneratedQuestions(accumulatedQuestions);
      setCurrentStep(3);
      toast.success(`Successfully generated ${accumulatedQuestions.length} assessment questions!`);
    } catch (err: any) {
      toast.error(`Generation error: ${err.message || 'Failed to synthesize questions'}`);
    } finally {
      setGenerating(false);
      setGeneratingPhase('');
    }
  };

  // Single Question Re-Roll (Regenerate 1 Item)
  const regenerateSingleQuestion = async (index: number) => {
    const targetQ = generatedQuestions[index];
    if (!targetQ) return;

    try {
      setRegeneratingIndex(index);
      toast.info(`Regenerating question ${index + 1}...`);

      const primaryLessonId = selectedLessons[0];
      const res = await authFetch(`/lessons/${primaryLessonId}/generate-questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonIds: selectedLessons,
          numberOfQuestions: 1,
          quizCategory: 'short',
          quizTypes: [targetQ.type],
          questionCountsByType: { [targetQ.type]: 1 },
          pointsByType: { [targetQ.type]: targetQ.points },
          generationAttempt: Date.now() % 10,
        }),
      });

      if (!res.ok) throw new Error('Could not regenerate item');
      const data = await res.json();
      const newItems = Array.isArray(data.data) ? data.data : [];
      if (newItems.length === 0) throw new Error('AI did not return a replacement item.');

      const item = newItems[0];
      const options: QuestionOption[] = Array.isArray(item.options)
        ? item.options.map((opt: any, optIdx: number) => ({
            id: `opt-reroll-${Date.now()}-${optIdx}`,
            text: typeof opt === 'string' ? opt : opt.text || '',
            isCorrect: typeof opt === 'object' ? Boolean(opt.isCorrect) : String(opt) === String(item.correctAnswer),
          }))
        : [];

      const updatedQuestion: Question = {
        id: `reroll-${Date.now()}`,
        title: item.text || item.title || 'Untitled Question',
        type: targetQ.type,
        points: targetQ.points,
        options,
        correctAnswer: item.correctAnswer || (options.find((o) => o.isCorrect)?.text ?? ''),
      };

      setGeneratedQuestions((prev) => {
        const copy = [...prev];
        copy[index] = updatedQuestion;
        return copy;
      });

      toast.success(`Question ${index + 1} updated with a fresh AI question!`);
    } catch (err: any) {
      toast.error(`Re-roll failed: ${err.message}`);
    } finally {
      setRegeneratingIndex(null);
    }
  };

  // Add a manual question in Review
  const addManualQuestion = () => {
    const newQ: Question = {
      id: `manual-${Date.now()}`,
      title: 'Enter question text here...',
      type: 'multiple-choice',
      points: 1,
      options: [
        { id: `opt-1-${Date.now()}`, text: 'Option A', isCorrect: true },
        { id: `opt-2-${Date.now()}`, text: 'Option B', isCorrect: false },
        { id: `opt-3-${Date.now()}`, text: 'Option C', isCorrect: false },
        { id: `opt-4-${Date.now()}`, text: 'Option D', isCorrect: false },
      ],
      correctAnswer: 'Option A',
    };
    setGeneratedQuestions((prev) => [...prev, newQ]);
    toast.success('Added new manual question at the end.');
  };

  const removeQuestion = (index: number) => {
    if (generatedQuestions.length <= 1) {
      toast.warning('Quiz must contain at least 1 question.');
      return;
    }
    setGeneratedQuestions((prev) => prev.filter((_, i) => i !== index));
    toast.info(`Question ${index + 1} removed.`);
  };

  // Final Submission to /assessments
  const handlePublishAssessment = async (allowDuplicate = false) => {
    if (generatedQuestions.length === 0) {
      toast.error('No questions available to publish.');
      return;
    }

    try {
      setLoading(true);

      const transformedQuestions = generatedQuestions.map((q) => ({
        id: q.id,
        text: q.title,
        type: q.type,
        points: q.points,
        options: q.type === 'multiple-choice' ? q.options.map((o) => o.text) : [],
        correctAnswer:
          q.type === 'multiple-choice'
            ? q.options.find((o) => o.isCorrect)?.text || q.options[0]?.text
            : q.correctAnswer || undefined,
      }));

      const payload = {
        title: formData.title,
        description: formData.description,
        type: 'quiz',
        unitId: selectedUnit,
        lessonIds: selectedLessons,
        dueDate: formData.dueDate || undefined,
        allowLateSubmissions: formData.allowLateSubmissions,
        totalPoints: transformedQuestions.reduce((sum, q) => sum + q.points, 0),
        timeLimit: formData.timeLimit,
        shuffleQuestions: formData.shuffleQuestions,
        showCorrectAnswers: formData.showCorrectAnswers,
        questions: transformedQuestions,
        generatedAutomatically: true,
        visibility: formData.visibility,
        quizCategory: formData.quizCategory,
        quizTypes: formData.quizTypes,
        questionCountsByType: formData.questionCountsByType,
        pointsByType: formData.pointsByType,
        targetSections,
        allowDuplicate,
      };

      const res = await authFetch('/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.status === 409) {
        const dupData = await res.json().catch(() => ({}));
        setDuplicateTitle(dupData?.error?.existingQuiz?.title || 'an existing assessment');
        setDuplicateDialogOpen(true);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Server error ${res.status}`);
      }

      toast.success(formData.visibility === 'private' ? 'Private exam saved for instructor review.' : 'Assessment created and published successfully!');
      navigate('/instructor/quizzes');
    } catch (err: any) {
      toast.error(`Failed to publish: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={shellClass}>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-violet-500 hover:text-violet-400 transition-colors text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Assessments
          </button>
          <div className="text-xs px-2.5 py-1 rounded-full bg-violet-500/10 text-violet-500 font-medium border border-violet-500/20">
            Instructional AI Assessment Studio
          </div>
        </div>

        {/* Wizard Steps Indicator */}
        <div className={panelClass + ' py-4'}>
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${
                  currentStep >= 1
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30'
                    : isLightMode
                    ? 'bg-slate-200 text-slate-500'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                1
              </div>
              <span className={`text-sm font-semibold ${currentStep === 1 ? 'text-violet-500' : mutedTextClass}`}>
                Curriculum Scope
              </span>
            </div>

            <ChevronRight className={`w-5 h-5 ${mutedTextClass}`} />

            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${
                  currentStep >= 2
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30'
                    : isLightMode
                    ? 'bg-slate-200 text-slate-500'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                2
              </div>
              <span className={`text-sm font-semibold ${currentStep === 2 ? 'text-violet-500' : mutedTextClass}`}>
                Blueprint & Rules
              </span>
            </div>

            <ChevronRight className={`w-5 h-5 ${mutedTextClass}`} />

            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${
                  currentStep >= 3
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30'
                    : isLightMode
                    ? 'bg-slate-200 text-slate-500'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                3
              </div>
              <span className={`text-sm font-semibold ${currentStep === 3 ? 'text-violet-500' : mutedTextClass}`}>
                Review & Finalize
              </span>
            </div>
          </div>
        </div>

        {/* STEP 1: CURRICULUM SCOPE */}
        {currentStep === 1 && (
          <div className={panelClass}>
            <div className="flex items-center gap-3 border-b pb-4 border-slate-200 dark:border-slate-800">
              <div className="p-2.5 rounded-lg bg-violet-500/10 text-violet-500">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Step 1: Define Curriculum Scope</h2>
                <p className={`text-xs ${mutedTextClass}`}>
                  Select the course unit and specific lessons from which AI will synthesize questions.
                </p>
              </div>
            </div>

            {loadingUnits ? (
              <div className="flex items-center justify-center py-12 gap-3">
                <AetherSpinner className="w-6 h-6 text-violet-500" />
                <span className={mutedTextClass}>Loading curriculum units...</span>
              </div>
            ) : units.length === 0 ? (
              <div className={nestedCardClass + ' text-center py-8 space-y-3'}>
                <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
                <h3 className="font-semibold text-base">No Instructional Units Found</h3>
                <p className={`text-sm max-w-md mx-auto ${mutedTextClass}`}>
                  You don't have any units or uploaded learning materials yet. Please create a unit and upload lesson slides before generating an automated quiz.
                </p>
                <Button onClick={() => navigate('/instructor/courses')} className="bg-violet-600 hover:bg-violet-700 text-white">
                  Go to Courses & Units
                </Button>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Unit Picker */}
                <div>
                  <label className={`block text-sm mb-2 ${labelTextClass}`}>Select Instructional Unit *</label>
                  <select
                    value={selectedUnit}
                    onChange={(e) => {
                      setSelectedUnit(e.target.value);
                      setSelectedLessons([]);
                    }}
                    className={fieldClass}
                  >
                    <option value="">-- Choose Unit --</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Lessons Picker */}
                {selectedUnit && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className={`text-sm ${labelTextClass}`}>
                        Lessons in Scope ({selectedLessons.length} selected) *
                      </label>
                      <button
                        type="button"
                        onClick={() => setSelectedLessons(lessons.map((l) => l.id))}
                        className="text-xs text-violet-500 hover:underline font-medium"
                      >
                        Select All Lessons
                      </button>
                    </div>

                    {lessons.length === 0 ? (
                      <div className={nestedCardClass + ' text-sm text-center py-4 text-amber-500'}>
                        This unit currently has no uploaded lessons. Please upload a lesson or select another unit.
                      </div>
                    ) : (
                      <div className={`grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto p-2 rounded-lg border ${isLightMode ? 'border-slate-200 bg-slate-50/50' : 'border-slate-800 bg-slate-900/30'}`}>
                        {lessons.map((lesson) => {
                          const isChecked = selectedLessons.includes(lesson.id);
                          return (
                            <label
                              key={lesson.id}
                              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                isChecked
                                  ? 'border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-300 font-medium'
                                  : isLightMode
                                  ? 'border-slate-200 bg-white hover:border-slate-300'
                                  : 'border-slate-800 bg-slate-800/40 hover:border-slate-700'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedLessons((prev) => [...prev, lesson.id]);
                                  } else {
                                    setSelectedLessons((prev) => prev.filter((id) => id !== lesson.id));
                                  }
                                }}
                                className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500"
                              />
                              <span className="text-sm truncate">{lesson.title}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Target Audience */}
                <div>
                  <label className={`block text-sm mb-2 ${labelTextClass}`}>Target Sections</label>
                  <p className={`mb-3 text-xs ${mutedTextClass}`}>Choose the sections you handle. Leave all unchecked to show this quiz to all of your sections.</p>
                  {(() => {
                    const handledSections = Array.from(new Set([
                      ...(user?.teaching_sections ?? []),
                      ...(user?.section ? [user.section] : []),
                    ].map((section) => section.trim()).filter(Boolean)));

                    if (handledSections.length === 0) {
                      return <p className={`rounded-lg border border-dashed p-3 text-sm ${isLightMode ? 'border-slate-300 text-slate-500' : 'border-slate-700 text-slate-400'}`}>No handled sections found.</p>;
                    }

                    return (
                      <div className={`grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-2 ${isLightMode ? 'border-slate-200 bg-slate-50' : 'border-slate-800 bg-slate-900/30'}`}>
                        {handledSections.map((section) => {
                          const isChecked = targetSections.includes(section);
                          return (
                            <label key={section} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors ${isChecked ? 'border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-300' : isLightMode ? 'border-slate-200 bg-white hover:border-slate-300' : 'border-slate-800 bg-slate-800/40 hover:border-slate-700'}`}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(event) => setTargetSections((current) => event.target.checked ? [...current, section] : current.filter((item) => item !== section))}
                                className="h-4 w-4 rounded text-violet-600 focus:ring-violet-500"
                              />
                              <span>{section}</span>
                            </label>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                {/* Title & Description with A
                uto-Suggest */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className={`text-sm ${labelTextClass}`}>Assessment Title *</label>
                      <button
                        type="button"
                        onClick={autoSuggestTitle}
                        className="flex items-center gap-1 text-xs text-violet-500 hover:text-violet-400 font-medium"
                      >
                        <Sparkles className="w-3 h-3" />
                        Auto-Suggest
                      </button>
                    </div>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="e.g. Unit 3: Database Architectures - Quiz"
                      className={fieldClass}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className={`text-sm ${labelTextClass}`}>Description & Instructions</label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Brief instructions for students..."
                      className={fieldClass}
                    />
                  </div>
                </div>

                {/* Next Button */}
                <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
                  <Button
                    onClick={handleProceedToStep2}
                    className="bg-violet-600 hover:bg-violet-700 text-white flex items-center gap-2 px-6"
                  >
                    Next: Blueprint & Rules
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: BLUEPRINT & RULES */}
        {currentStep === 2 && (
          <div className={panelClass}>
            <div className="flex items-center gap-3 border-b pb-4 border-slate-200 dark:border-slate-800">
              <div className="p-2.5 rounded-lg bg-violet-500/10 text-violet-500">
                <Settings2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Step 2: Assessment Blueprint & Rules</h2>
                <p className={`text-xs ${mutedTextClass}`}>
                  Configure test categories, question type distribution, point weighting, and timing.
                </p>
              </div>
            </div>

            {/* Assessment Category Selector */}
            <div>
              <label className={`block text-sm mb-3 ${labelTextClass}`}>Assessment Category</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(['short', 'long', 'exam'] as const).map((cat) => {
                  const isSelected = formData.quizCategory === cat;
                  const details = {
                    short: { label: 'Short Quiz', range: '5 – 10 Items', time: '15–20 mins', desc: 'Quick formative check' },
                    long: { label: 'Long Quiz', range: '20 – 30 Items', time: '30–45 mins', desc: 'Summative unit review' },
                    exam: { label: 'Major Examination', range: '70 – 100 Items', time: '60–90 mins', desc: 'Comprehensive midterm/final' },
                  }[cat];

                  return (
                    <div
                      key={cat}
                      onClick={() => updateCategory(cat)}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-violet-600 bg-violet-500/10'
                          : isLightMode
                          ? 'border-slate-200 bg-white hover:border-slate-300'
                          : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-base">{details.label}</span>
                        {isSelected && <CheckCircle2 className="w-5 h-5 text-violet-500" />}
                      </div>
                      <p className="text-xs text-violet-500 font-semibold mb-2">{details.range}</p>
                      <p className={`text-xs ${mutedTextClass}`}>{details.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Time Limit & Passing Score */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className={`text-sm ${labelTextClass}`}>Time Limit (minutes)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="5"
                    max="180"
                    value={formData.timeLimit}
                    onChange={(e) => setFormData({ ...formData, timeLimit: Number(e.target.value) || 15 })}
                    className={fieldClass}
                  />
                  {[15, 30, 45, 60].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFormData({ ...formData, timeLimit: t })}
                      className={`px-3 py-2 text-xs rounded-lg border font-semibold ${
                        formData.timeLimit === t
                          ? 'bg-violet-600 text-white border-violet-600'
                          : isLightMode
                          ? 'border-slate-300 hover:bg-slate-100'
                          : 'border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      {t}m
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className={`text-sm ${labelTextClass}`}>Passing Threshold (%)</label>
                <input
                  type="number"
                  min="50"
                  max="100"
                  value={formData.passingPercentage}
                  onChange={(e) => setFormData({ ...formData, passingPercentage: Number(e.target.value) || 75 })}
                  className={fieldClass}
                />
              </div>
            </div>

            {/* Question Types Distribution Matrix */}
            <div className="space-y-3">
              <label className={`block text-sm ${labelTextClass}`}>
                Question Types & Distribution Matrix
              </label>
              <div className="space-y-2.5">
                {(['multiple-choice', 'true-false', 'identification', 'enumeration', 'essay'] as QuizType[]).map(
                  (type) => {
                    const isSelected = formData.quizTypes.includes(type);
                    const color = QUESTION_TYPE_COLORS[type];
                    return (
                      <div
                        key={type}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-lg border gap-3 transition-all ${
                          isSelected
                            ? `${color.bg} ${color.border} border`
                            : isLightMode
                            ? 'bg-slate-50 border-slate-200 opacity-60'
                            : 'bg-slate-800/30 border-slate-800 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleQuizType(type)}
                            className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500"
                          />
                          <span className={`font-semibold text-sm ${isSelected ? color.text : ''}`}>
                            {QUESTION_TYPE_LABELS[type]}
                          </span>
                        </div>

                        {isSelected && (
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs ${mutedTextClass}`}>Count:</span>
                              <input
                                type="number"
                                min="1"
                                max="100"
                                value={formData.questionCountsByType[type] || 0}
                                onChange={(e) => {
                                  const val = Math.max(0, Number(e.target.value) || 0);
                                  setFormData((prev) => ({
                                    ...prev,
                                    questionCountsByType: {
                                      ...prev.questionCountsByType,
                                      [type]: val,
                                    },
                                  }));
                                }}
                                className="w-16 px-2 py-1 text-xs text-center border rounded bg-white dark:bg-slate-800 font-bold"
                              />
                            </div>

                            <div className="flex items-center gap-2">
                              <span className={`text-xs ${mutedTextClass}`}>Pts/item:</span>
                              <input
                                type="number"
                                min="1"
                                max="20"
                                value={formData.pointsByType[type] || 1}
                                onChange={(e) => {
                                  const val = Math.max(1, Number(e.target.value) || 1);
                                  setFormData((prev) => ({
                                    ...prev,
                                    pointsByType: {
                                      ...prev.pointsByType,
                                      [type]: val,
                                    },
                                  }));
                                }}
                                className="w-14 px-2 py-1 text-xs text-center border rounded bg-white dark:bg-slate-800 font-bold"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }
                )}
              </div>
            </div>

            {/* Live Blueprint Summary Bar */}
            <div className={`p-4 rounded-xl flex items-center justify-around border ${isLightMode ? 'bg-violet-50 border-violet-200' : 'bg-violet-950/20 border-violet-900/40'}`}>
              <div className="text-center">
                <p className={`text-xs ${mutedTextClass}`}>Total Items</p>
                <p className="text-xl font-bold text-violet-500">{configuredQuestionTotal()}</p>
              </div>
              <div className="h-8 w-px bg-violet-300 dark:bg-violet-800" />
              <div className="text-center">
                <p className={`text-xs ${mutedTextClass}`}>Total Points</p>
                <p className="text-xl font-bold text-violet-500">{calculatedTotalPoints()}</p>
              </div>
              <div className="h-8 w-px bg-violet-300 dark:bg-violet-800" />
              <div className="text-center">
                <p className={`text-xs ${mutedTextClass}`}>Est. Time</p>
                <p className="text-xl font-bold text-violet-500">{formData.timeLimit}m</p>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(1)}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Scope
              </Button>
              <Button
                onClick={handleGenerateQuestions}
                disabled={generating}
                className="bg-violet-600 hover:bg-violet-700 text-white flex items-center gap-2 px-6 shadow-lg shadow-violet-600/30"
              >
                {generating ? (
                  <>
                    <AetherSpinner className="w-4 h-4 text-white" />
                    Generating Assessment...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate Assessment with AI
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: REVIEW, EDIT & FINALIZE */}
        {currentStep === 3 && (
          <div className="space-y-6">
            {/* KPI Statistics Header */}
            <div className={panelClass + ' py-4'}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold">{formData.title}</h2>
                  <p className={`text-xs ${mutedTextClass}`}>
                    Review and fine-tune questions. You can edit text, re-roll single questions, or add manual items.
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-center px-3 py-1 rounded bg-violet-500/10 border border-violet-500/20">
                    <span className="text-xs text-violet-500 block">Total Items</span>
                    <span className="text-lg font-bold">{generatedQuestions.length}</span>
                  </div>
                  <div className="text-center px-3 py-1 rounded bg-emerald-500/10 border border-emerald-500/20">
                    <span className="text-xs text-emerald-500 block">Total Points</span>
                    <span className="text-lg font-bold text-emerald-500">{calculatedTotalPoints()}</span>
                  </div>
                  <div className="text-center px-3 py-1 rounded bg-sky-500/10 border border-sky-500/20">
                    <span className="text-xs text-sky-500 block">Time Limit</span>
                    <span className="text-lg font-bold text-sky-500">{formData.timeLimit}m</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentStep(2)}
                  className="flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Edit Blueprint
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateQuestions}
                  disabled={generating}
                  className="flex items-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  Regenerate All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addManualQuestion}
                  className="flex items-center gap-1.5 text-violet-500 hover:text-violet-600"
                >
                  <PlusCircle className="w-4 h-4" />
                  Add Manual Item
                </Button>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3">
                {formData.quizCategory === 'exam' && (
                  <div className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-xs ${isLightMode ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-900'}`}>
                    <span className={`font-semibold ${labelTextClass}`}>Student access</span>
                    <label className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        name="generated-exam-visibility"
                        checked={formData.visibility === 'public'}
                        onChange={() => setFormData((prev) => ({ ...prev, visibility: 'public' }))}
                      />
                      Public
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        name="generated-exam-visibility"
                        checked={formData.visibility === 'private'}
                        onChange={() => setFormData((prev) => ({ ...prev, visibility: 'private' }))}
                      />
                      Private
                    </label>
                  </div>
                )}
                <Button
                  onClick={() => handlePublishAssessment(false)}
                  disabled={loading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 px-6 shadow-lg shadow-emerald-600/30"
                >
                  {loading ? <AetherSpinner className="w-4 h-4 text-white" /> : <Check className="w-4 h-4" />}
                  {formData.visibility === 'private' ? 'Save Private Exam' : 'Publish Assessment'}
                </Button>
              </div>
            </div>

            {/* Generated Question Cards */}
            <div className="space-y-4">
              {generatedQuestions.map((q, qIndex) => {
                const typeColor = QUESTION_TYPE_COLORS[q.type as QuizType] || {
                  bg: 'bg-slate-500/10',
                  text: 'text-slate-400',
                  border: 'border-slate-500/20',
                };

                return (
                  <div key={q.id || qIndex} className={panelClass + ' relative'}>
                    {/* Header: Number, Type Badge, Points, Action buttons */}
                    <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center">
                          {qIndex + 1}
                        </span>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${typeColor.bg} ${typeColor.text} ${typeColor.border}`}>
                          {QUESTION_TYPE_LABELS[q.type as QuizType] || q.type}
                        </span>
                        <div className="flex items-center gap-1 text-xs">
                          <span className={mutedTextClass}>Points:</span>
                          <input
                            type="number"
                            min="1"
                            max="20"
                            value={q.points}
                            onChange={(e) => {
                              const val = Math.max(1, Number(e.target.value) || 1);
                              setGeneratedQuestions((prev) => {
                                const copy = [...prev];
                                copy[qIndex].points = val;
                                return copy;
                              });
                            }}
                            className="w-12 px-1.5 py-0.5 text-xs text-center border rounded bg-white dark:bg-slate-800 font-bold"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => regenerateSingleQuestion(qIndex)}
                          disabled={regeneratingIndex === qIndex}
                          className="text-xs text-violet-500 hover:bg-violet-500/10 flex items-center gap-1"
                        >
                          {regeneratingIndex === qIndex ? (
                            <AetherSpinner className="w-3.5 h-3.5 text-violet-500" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5" />
                          )}
                          Re-roll Item
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeQuestion(qIndex)}
                          className="text-xs text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Question Stem */}
                    <div className="space-y-2">
                      <label className={`text-xs ${mutedTextClass}`}>Question Stem:</label>
                      <textarea
                        value={q.title}
                        rows={2}
                        onChange={(e) => {
                          const val = e.target.value;
                          setGeneratedQuestions((prev) => {
                            const copy = [...prev];
                            copy[qIndex].title = val;
                            return copy;
                          });
                        }}
                        className={fieldClass}
                      />
                    </div>

                    {/* Multiple Choice Options */}
                    {q.type === 'multiple-choice' && (
                      <div className="space-y-2 pt-2">
                        <label className={`text-xs ${mutedTextClass}`}>
                          Answer Options (Select the radio button to set the correct answer key):
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {q.options.map((opt, optIndex) => {
                            const optionLetters = ['A', 'B', 'C', 'D', 'E'];
                            return (
                              <div
                                key={opt.id || optIndex}
                                className={`flex items-center gap-2.5 p-2.5 rounded-lg border transition-all ${
                                  opt.isCorrect
                                    ? 'border-emerald-500 bg-emerald-500/10'
                                    : isLightMode
                                    ? 'border-slate-200 bg-slate-50'
                                    : 'border-slate-800 bg-slate-800/40'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={`correct-${qIndex}`}
                                  checked={opt.isCorrect}
                                  onChange={() => {
                                    setGeneratedQuestions((prev) => {
                                      const copy = [...prev];
                                      copy[qIndex].options = copy[qIndex].options.map((o, idx) => ({
                                        ...o,
                                        isCorrect: idx === optIndex,
                                      }));
                                      copy[qIndex].correctAnswer = opt.text;
                                      return copy;
                                    });
                                  }}
                                  className="text-emerald-600 focus:ring-emerald-500"
                                />
                                <span className="font-bold text-xs w-4 text-violet-500">
                                  {optionLetters[optIndex]}.
                                </span>
                                <input
                                  type="text"
                                  value={opt.text}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setGeneratedQuestions((prev) => {
                                      const copy = [...prev];
                                      copy[qIndex].options[optIndex].text = val;
                                      if (opt.isCorrect) copy[qIndex].correctAnswer = val;
                                      return copy;
                                    });
                                  }}
                                  className="w-full bg-transparent border-none text-xs focus:outline-none"
                                />
                                {opt.isCorrect && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500 text-white font-bold shrink-0">
                                    CORRECT
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* True or False Options */}
                    {q.type === 'true-false' && (
                      <div className="space-y-2 pt-2">
                        <label className={`text-xs ${mutedTextClass}`}>Correct Answer Key:</label>
                        <div className="flex gap-4">
                          {['True', 'False'].map((tf) => {
                            const isSelected =
                              String(q.correctAnswer).toLowerCase() === tf.toLowerCase();
                            return (
                              <button
                                key={tf}
                                type="button"
                                onClick={() => {
                                  setGeneratedQuestions((prev) => {
                                    const copy = [...prev];
                                    copy[qIndex].correctAnswer = tf;
                                    return copy;
                                  });
                                }}
                                className={`flex-1 py-2 px-4 rounded-lg font-bold text-sm border transition-all ${
                                  isSelected
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/30'
                                    : isLightMode
                                    ? 'bg-slate-100 border-slate-300 text-slate-700'
                                    : 'bg-slate-800 border-slate-700 text-slate-300'
                                }`}
                              >
                                {tf}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Identification / Enumeration / Essay Model Answer */}
                    {['identification', 'enumeration', 'essay'].includes(q.type) && (
                      <div className="space-y-2 pt-2">
                        <label className={`text-xs ${mutedTextClass}`}>
                          {q.type === 'essay' ? 'Evaluation Rubric / Model Answer:' : 'Expected Correct Answer:'}
                        </label>
                        <textarea
                          rows={q.type === 'essay' ? 3 : 1}
                          value={q.correctAnswer || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setGeneratedQuestions((prev) => {
                              const copy = [...prev];
                              copy[qIndex].correctAnswer = val;
                              return copy;
                            });
                          }}
                          className={fieldClass}
                          placeholder="Provide the exact expected response or scoring rubric..."
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom Finalize CTA */}
            <div className="flex justify-end pt-4">
              <Button
                onClick={() => handlePublishAssessment(false)}
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 px-8 py-3 text-base shadow-lg shadow-emerald-600/30"
              >
                {loading ? <AetherSpinner className="w-5 h-5 text-white" /> : <CheckCircle2 className="w-5 h-5" />}
                {formData.visibility === 'private' ? 'Confirm Private Exam' : 'Confirm & Publish Assessment'}
              </Button>
            </div>
          </div>
        )}

        {/* In-Progress AI Overlay */}
        {generating && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 max-w-md w-full text-center space-y-4 shadow-2xl">
              <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-violet-500/20 border-t-violet-500 animate-spin" />
                <Sparkles className="w-8 h-8 text-violet-500 animate-pulse" />
              </div>
              <h3 className="text-xl font-bold">Instructional AI Synthesis</h3>
              <p className={`text-sm ${mutedTextClass}`}>{generatingPhase}</p>
              <div className="text-xs text-violet-500 bg-violet-500/10 py-1.5 px-3 rounded-full inline-block font-semibold">
                Applying Bloom's Taxonomy & Anti-Recall Filters
              </div>
            </div>
          </div>
        )}

        {/* Duplicate Assessment Modal */}
        <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assessment Already Exists</DialogTitle>
              <DialogDescription>
                An assessment titled &quot;{duplicateTitle}&quot; is already associated with the selected lesson. Would you like to create another quiz alongside it?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setDuplicateDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setDuplicateDialogOpen(false);
                  handlePublishAssessment(true);
                }}
                className="bg-violet-600 hover:bg-violet-700 text-white"
              >
                Create As Duplicate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
export default AutoGenerateQuiz;
