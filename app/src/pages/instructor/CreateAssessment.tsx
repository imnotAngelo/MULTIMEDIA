import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { AetherSpinner } from '@/components/AetherSpinner';
import { AetherLoader } from '@/components/AetherLoader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { authFetch } from '@/lib/authFetch';
import { notificationService } from '@/services/notificationService';
import { SectionYearTargetPicker } from '@/components/SectionYearTargetPicker';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';

interface Unit {
  id: string;
  title: string;
}

export function CreateAssessment() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
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
  const [targetYearLevels, setTargetYearLevels] = useState<number[]>([]);
  const [targetSections, setTargetSections] = useState<string[]>([]);
  const [sectionInput, setSectionInput] = useState('');

  useEffect(() => {
    loadUnits();
  }, []);

  const loadUnits = async () => {
    try {
      setLoading(true);
      const response = await authFetch('/units');
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
      toast.error('Please fill in all required fields');
      return;
    }
    try {
      setSubmitting(true);
      const response = await authFetch('/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          unitId: formData.unitId,
          type: formData.type,
          dueDate: formData.dueDate,
          targetSections,
          targetYearLevels,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to create assessment');
      }
      toast.success('Assessment created successfully');
      notificationService.notifyAssignmentAdded(formData.title);
      navigate('/instructor/assessments');
    } catch (err: any) {
      toast.error('Failed to create assessment: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Create Assessment</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Create a new assessment for your students</p>
        </div>
        {loading ? (
          <div className="py-6">
            <AetherLoader variant="cards" count={2} label="Loading units..." />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card className="p-6 bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800/60 shadow-sm">
              <div className="space-y-4">
                <div>
                  <Label className="text-slate-700 dark:text-slate-300 font-medium">Assessment Title</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Enter assessment title"
                    className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-700 dark:text-slate-300 font-medium">Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Enter assessment description"
                    className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 mt-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-700 dark:text-slate-300 font-medium">Unit</Label>
                    <Select value={formData.unitId} onValueChange={(value) => setFormData({ ...formData, unitId: value })}>
                      <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white mt-1">
                        <SelectValue placeholder="Select a unit" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                        {units.map(unit => (
                          <SelectItem key={unit.id} value={unit.id} className="text-slate-900 dark:text-white">
                            {unit.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-slate-700 dark:text-slate-300 font-medium">Type</Label>
                    <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                      <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                        <SelectItem value="assignment" className="text-slate-900 dark:text-white">Assignment</SelectItem>
                        <SelectItem value="quiz" className="text-slate-900 dark:text-white">Quiz</SelectItem>
                        <SelectItem value="lab" className="text-slate-900 dark:text-white">Lab</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-slate-700 dark:text-slate-300 font-medium">Due Date</Label>
                  <Input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white mt-1"
                  />
                </div>
                <SectionYearTargetPicker
                  yearLevels={targetYearLevels}
                  onYearLevelsChange={setTargetYearLevels}
                  sections={targetSections}
                  onSectionsChange={setTargetSections}
                  sectionInput={sectionInput}
                  onSectionInputChange={setSectionInput}
                  sectionOptions={user?.teaching_sections ?? []}
                />
              </div>
            </Card>
            <div className="flex gap-3 justify-end pt-4">
              <Button type="button" onClick={() => navigate('/instructor/assessments')} variant="outline" className="border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
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
