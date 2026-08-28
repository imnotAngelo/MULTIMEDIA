import { useEffect, useState } from 'react';
import { Check, RefreshCw, UserCheck, Users } from 'lucide-react';
import { AetherSpinner } from '@/components/AetherSpinner';
import { authFetch } from '@/lib/authFetch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AetherLoader } from '@/components/AetherLoader';

interface StudentRequest {
  student_approved: boolean;
  id: string;
  email: string;
  full_name: string;
  year_level: number;
  section: string;
  created_at: string;
}

export function StudentApprovals() {
  const [requests, setRequests] = useState<StudentRequest[]>([]);
  const [students, setStudents] = useState<StudentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const loadRequests = async () => {
    setLoading(true);
    setError('');
    try {
      const [requestsResponse, studentsResponse] = await Promise.all([
        authFetch('/instructor/student-requests'),
        authFetch('/instructor/student-requests?includeAll=true'),
      ]);
      const payload = await requestsResponse.json();
      const studentsPayload = await studentsResponse.json();
      if (!requestsResponse.ok || !payload.success) {
        throw new Error(payload.error?.message || 'Could not load student requests');
      }
      if (!studentsResponse.ok || !studentsPayload.success) {
        throw new Error(studentsPayload.error?.message || 'Could not load students');
      }
      setRequests(payload.data || []);
      setStudents(studentsPayload.data || []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not load student requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const approveRequest = async (id: string) => {
    setApprovingId(id);
    try {
      const response = await authFetch(`/instructor/student-requests/${id}/approve`, { method: 'PATCH' });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || 'Could not approve student');
      }
      setRequests((current) => current.filter((request) => request.id !== id));
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : 'Could not approve student');
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-violet-400">Access control</p>
          <h1 className="mt-1 text-3xl font-bold text-white">Student approvals</h1>
          <p className="mt-2 text-slate-400">Review students who registered for your section before they can sign in.</p>
        </div>
        <Button variant="outline" onClick={loadRequests} disabled={loading} className="border-slate-700 text-slate-200">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</p>}

      <Card className="border-slate-800 bg-slate-900/70">
        <CardHeader className="border-b border-slate-800">
          <CardTitle className="flex items-center gap-3 text-white">
            <Users className="h-5 w-5 text-violet-400" />
            Pending requests
            <span className="rounded-full bg-violet-500/15 px-2.5 py-0.5 text-sm text-violet-300">{requests.length}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <AetherLoader compact label="Scanning student requests" />
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-14 text-center">
              <UserCheck className="h-10 w-10 text-emerald-400" />
              <h2 className="mt-4 text-lg font-semibold text-white">All caught up</h2>
              <p className="mt-1 text-sm text-slate-400">There are no students waiting for approval in your section.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {requests.map((request) => (
                <div key={request.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-semibold text-white">{request.full_name}</h2>
                    <p className="text-sm text-slate-400">{request.email}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Year {request.year_level} · Section {request.section} · Requested {new Date(request.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button onClick={() => approveRequest(request.id)} disabled={approvingId === request.id} className="bg-emerald-600 text-white hover:bg-emerald-500">
                    {approvingId === request.id ? <AetherSpinner className="mr-2 h-4 w-4" /> : <Check className="mr-2 h-4 w-4" />}
                    Approve student
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-900/70">
        <CardHeader className="border-b border-slate-800">
          <CardTitle className="flex items-center gap-3 text-white">
            <Users className="h-5 w-5 text-emerald-400" />
            All students in your section
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-sm text-emerald-300">{students.length}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {students.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-400">No students found in your assigned section.</p>
          ) : (
            <div className="divide-y divide-slate-800">
              {students.map((student) => (
                <div key={student.id} className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-semibold text-white">{student.full_name}</h2>
                    <p className="text-sm text-slate-400">{student.email}</p>
                    <p className="mt-1 text-xs text-slate-500">Year {student.year_level} · Section {student.section}</p>
                  </div>
                  <span className={`w-fit rounded-full border px-2.5 py-1 text-xs ${student.student_approved === false ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'}`}>
                    {student.student_approved === false ? 'Pending approval' : 'Approved'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
