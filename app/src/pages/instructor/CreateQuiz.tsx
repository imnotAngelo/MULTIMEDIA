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
  type: 'multiple-choice' | 'short-answer' | 'essay';
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

const initialQuestion: Question = {
  id: '1',
  text: '',
  type: 'multiple-choice',
  options: ['', '', '', ''],
  correctAnswer: '',
  points: 1,
};

export function CreateQuiz() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    unitId: '',
    lessonId: '',
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
        setLessons(response.ok && Array.isArray(data.data) ? data.data : []);
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

  const handleAddQuestion = () => {
    const newQuestion: Question = {
      id: Date.now().toString(),
      text: '',
      type: 'multiple-choice',
      options: ['', '', '', ''],
      correctAnswer: '',
      points: 1,
    };
    setQuestions([...questions, newQuestion]);
    setExpandedQuestion(newQuestion.id);
  };

  const handleRemoveQuestion = (id: string) => {
    if (questions.length > 1) {
      setQuestions(questions.filter(q => q.id !== id));
    }
  };

  const handleUpdateQuestion = (id: string, updates: Partial<Question>) => {
    setQuestions(questions.map(q => (q.id === id ? { ...q, ...updates } : q)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.unitId || !formData.lessonId || questions.length === 0) {
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
          lessonId: formData.lessonId,
          allowLateSubmissions: formData.allowLateSubmissions,
          type: 'quiz',
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
                    <Label className="text-slate-300">Unit</Label>
                    <Select value={formData.unitId} onValueChange={(value) => setFormData({ ...formData, unitId: value, lessonId: '' })}>
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
                  <Label className="text-slate-300">Lesson</Label>
                  <Select
                    value={formData.lessonId}
                    onValueChange={(value) => setFormData({ ...formData, lessonId: value })}
                    disabled={!formData.unitId || loadingLessons || lessons.length === 0}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1">
                      <SelectValue placeholder={loadingLessons ? 'Loading lessons...' : formData.unitId ? 'Select a lesson' : 'Select a unit first'} />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {lessons.map(lesson => (
                        <SelectItem key={lesson.id} value={lesson.id} className="text-white">
                          {lesson.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                            <Select value={question.type} onValueChange={(value) => handleUpdateQuestion(question.id, { type: value as any })}>
                              <SelectTrigger className="mt-1 bg-slate-800 border-slate-700 text-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-slate-800 border-slate-700">
                                <SelectItem value="multiple-choice" className="text-white">Multiple Choice</SelectItem>
                                <SelectItem value="short-answer" className="text-white">Short Answer</SelectItem>
                                <SelectItem value="essay" className="text-white">Essay</SelectItem>
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
