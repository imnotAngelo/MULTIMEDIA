import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { authFetch } from '@/lib/authFetch';
import {
  getSubmissions,
  updateSubmission,
  type CanvaSubmission,
} from '@/lib/canvaSubmissionService';
import { ExternalLink, Loader2, Save } from 'lucide-react';

type Unit = { id: string; title?: string; name?: string };

export function CanvaSubmissions() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [loadingUnits, setLoadingUnits] = useState(true);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<CanvaSubmission[]>([]);

  const selectedUnit = useMemo(
    () => units.find((u) => u.id === selectedUnitId) ?? null,
    [units, selectedUnitId]
  );

  useEffect(() => {
    const loadUnits = async () => {
      try {
        setLoadingUnits(true);
        setError(null);
        const res = await authFetch('/units');
        if (!res.ok) throw new Error('Failed to load units');
        const data: unknown = await res.json();
        const list = Array.isArray(data) ? (data as Unit[]) : [];
        setUnits(list);
        setSelectedUnitId(list[0]?.id ?? '');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load units');
      } finally {
        setLoadingUnits(false);
      }
    };
    loadUnits();
  }, []);

  useEffect(() => {
    const loadSubmissions = async () => {
      if (!selectedUnitId) return;
      try {
        setLoadingSubs(true);
        setError(null);
        const data = await getSubmissions(selectedUnitId);
        setSubmissions(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load submissions');
      } finally {
        setLoadingSubs(false);
      }
    };
    loadSubmissions();
  }, [selectedUnitId]);

  const handleSave = async (submissionId: string, patch: { grade?: number; instructorFeedback?: string; status?: string }) => {
    try {
      setError(null);
      const updated = await updateSubmission(submissionId, patch);
      setSubmissions((prev) => prev.map((s) => (s.id === submissionId ? updated : s)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save grade');
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-slate-900/60 border-slate-800 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-100">Canva Submissions</h1>
            <p className="text-sm text-slate-400">
              Review and grade student Canva project links per laboratory/unit.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-300">Unit</label>
            <select
              className="bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-200"
              value={selectedUnitId}
              onChange={(e) => setSelectedUnitId(e.target.value)}
              disabled={loadingUnits}
            >
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.title ?? u.name ?? u.id}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="mt-4 text-sm text-red-300">
            {error}
          </div>
        )}
      </Card>

      <Card className="bg-slate-900/60 border-slate-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-100">
            {selectedUnit ? (selectedUnit.title ?? selectedUnit.name ?? 'Selected Unit') : 'Submissions'}
          </h2>
          {loadingSubs && (
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading…
            </div>
          )}
        </div>

        {!loadingSubs && submissions.length === 0 && (
          <div className="text-sm text-slate-400">No submissions yet.</div>
        )}

        <div className="space-y-4">
          {submissions.map((s) => (
            <SubmissionCard key={s.id} submission={s} onSave={handleSave} />
          ))}
        </div>
      </Card>
    </div>
  );
}

function SubmissionCard({
  submission,
  onSave,
}: {
  submission: CanvaSubmission;
  onSave: (id: string, patch: { grade?: number; instructorFeedback?: string; status?: string }) => Promise<void>;
}) {
  const [grade, setGrade] = useState<number>(submission.grade ?? 0);
  const [feedback, setFeedback] = useState<string>(submission.instructor_feedback ?? '');
  const [status, setStatus] = useState<string>(submission.status ?? 'submitted');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setGrade(submission.grade ?? 0);
    setFeedback(submission.instructor_feedback ?? '');
    setStatus(submission.status ?? 'submitted');
  }, [submission.id, submission.grade, submission.instructor_feedback, submission.status]);

  const canvaUrl = submission.canva_url;

  return (
    <div className="border border-slate-800 rounded-xl p-4 bg-slate-950/40">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-slate-100 font-medium truncate">
            {submission.project_title || 'Untitled Project'}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Student: {submission.student?.email ?? submission.student_id}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Status: {status}
          </div>
        </div>

        {canvaUrl ? (
          <Button asChild variant="outline" className="border-slate-700 text-slate-200">
            <a href={canvaUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="w-4 h-4 mr-2" />
              Open design
            </a>
          </Button>
        ) : (
          <div className="text-xs text-slate-500">No Canva link</div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Grade (0-100)</label>
          <input
            type="number"
            min={0}
            max={100}
            value={Number.isFinite(grade) ? grade : 0}
            onChange={(e) => setGrade(Number(e.target.value))}
            className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100"
          >
            <option value="submitted">submitted</option>
            <option value="reviewed">reviewed</option>
            <option value="approved">approved</option>
            <option value="rejected">rejected</option>
          </select>
        </div>
        <div className="flex items-end">
          <Button
            onClick={async () => {
              setSaving(true);
              try {
                await onSave(submission.id, {
                  grade,
                  instructorFeedback: feedback,
                  status,
                });
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
            className="w-full"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save grade
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="mt-3">
        <label className="block text-xs text-slate-400 mb-1">Instructor feedback</label>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={3}
          className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100"
          placeholder="Feedback for the student…"
        />
      </div>
    </div>
  );
}

