import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { authFetch } from '@/lib/authFetch';
import { notificationService } from '@/services/notificationService';

interface Unit {
  id: string;
  title: string;
}

export function CreateAssessment() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    unitId: '',
    type: 'assignment',
    dueDate: '',
  });
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.unitId) {
      alert('Please fill in all required fields');
      return;
    }
    try {
      setSubmitting(true);
      const response = await authFetch('http://localhost:3001/api/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          unitId: formData.unitId,
          type: formData.type,
          dueDate: formData.dueDate,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to create assessment');
      }
      notificationService.notifyAssignmentAdded(formData.title);
      navigate('/instructor/assessments');
    } catch (err: any) {
      alert('Failed to create assessment: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-white">Create Assessment</h1>
          <p className="text-sm text-slate-400 mt-1">Create a new assessment for your students</p>
        </div>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
            <p className="text-slate-400">Loading units...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card className="p-6 bg-slate-900/60 border-slate-800/60">
              <div className="space-y-4">
                <div>
                  <Label className="text-slate-300">Assessment Title</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Enter assessment title"
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Enter assessment description"
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
                    <Label className="text-slate-300">Type</Label>
                    <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="assignment">Assignment</SelectItem>
                        <SelectItem value="quiz">Quiz</SelectItem>
                        <SelectItem value="lab">Lab</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-slate-300">Due Date</Label>
                  <Input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="bg-slate-800 border-slate-700 text-white mt-1"
                  />
                </div>
              </div>
            </Card>
            <div className="flex gap-3 justify-end pt-4">
              <Button type="button" onClick={() => navigate('/instructor/assessments')} variant="outline" className="border-slate-700 text-slate-300">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-violet-600 hover:bg-violet-700 text-white">
                {submitting ? 'Creating...' : 'Create Assessment'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
