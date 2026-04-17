import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { authFetch } from '@/lib/authFetch';
import { notificationService } from '@/services/notificationService';

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
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    unitId: '',
    timeLimit: 60,
    passingScore: 70,
  });

  const [units, setUnits] = useState<Unit[]>([]);
  const [questions, setQuestions] = useState<Question[]>([initialQuestion]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [expandedQuestion, setExpandedQuestion] = useState<string>('1');

  useEffect(() => {
    loadUnits();
  }, []);

  const loadUnits = async () => {
    try {
      setLoading(true);
      const response = await authFetch('http://localhost:3001/api/units');
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
    if (!formData.title.trim() || !formData.unitId || questions.length === 0) {
      alert('Please fill in all required fields');
      return;
    }
    try {
      setSubmitting(true);
      const response = await authFetch('http://localhost:3001/api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          unitId: formData.unitId,
          timeLimit: formData.timeLimit,
          passingScore: formData.passingScore,
          questions: questions,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to create quiz');
      }
      notificationService.notifyUnitAdded(formData.title);
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
            <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
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
                    <Select value={formData.unitId} onValueChange={(value) => setFormData({ ...formData, unitId: value })}>
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
