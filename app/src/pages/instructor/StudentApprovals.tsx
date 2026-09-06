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
  avatar_url?: string | null;
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
  const [sectionFilter, setSectionFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');

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

  const sections = Array.from(new Set([...requests, ...students].map((s) => s.section).filter(Boolean))).sort();
  const years = Array.from(new Set([...requests, ...students].map((s) => s.year_level).filter((year) => year !== null && year !== undefined))).sort((a, b) => a - b);
  const matchesFilters = (student: StudentRequest) =>
    (sectionFilter === 'all' || student.section === sectionFilter) &&
    (yearFilter === 'all' || String(student.year_level) === yearFilter);
  const filteredRequests = requests.filter(matchesFilters);
  const filteredStudents = students.filter(matchesFilters);

  const getAvatarUrl = (student: StudentRequest) =>
    student.avatar_url || `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(student.full_name || student.email)}`;

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
          <p className="mt-2 text-slate-400">Review students registered for your assigned sections before they can sign in.</p>
        </div>
        <Button variant="outline" onClick={loadRequests} disabled={loading} className="border-slate-700 text-slate-200">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {(sections.length > 0 || years.length > 0) && (
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="sectionFilter" className="text-sm text-slate-400">Filter students</label>
          <select
            id="sectionFilter"
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className="h-9 rounded-md border border-slate-700 bg-slate-800/60 px-3 text-sm text-white focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
          >
            <option value="all">All sections</option>
            {sections.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            id="yearFilter"
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="h-9 rounded-md border border-slate-700 bg-slate-800/60 px-3 text-sm text-white focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
          >
            <option value="all">All year levels</option>
            {years.map((year) => (
              <option key={year} value={String(year)}>Year {year}</option>
            ))}
          </select>
        </div>
      )}

      {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</p>}

      <Card className="border-slate-800 bg-slate-900/70">
        <CardHeader className="border-b border-slate-800">
          <CardTitle className="flex items-center gap-3 text-white">
            <Users className="h-5 w-5 text-violet-400" />
            Pending requests
            <span className="rounded-full bg-violet-500/15 px-2.5 py-0.5 text-sm text-violet-300">{filteredRequests.length}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <AetherLoader compact label="Scanning student requests" />
          ) : filteredRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-14 text-center">
              <UserCheck className="h-10 w-10 text-emerald-400" />
              <h2 className="mt-4 text-lg font-semibold text-white">All caught up</h2>
              <p className="mt-1 text-sm text-slate-400">There are no students waiting for approval in your section.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {filteredRequests.map((request) => (
                <div key={request.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <img src={getAvatarUrl(request)} alt={`${request.full_name} profile`} className="h-12 w-12 shrink-0 rounded-full border border-slate-700 bg-slate-800 object-cover" />
                    <div>
                      <h2 className="font-semibold text-white">{request.full_name}</h2>
                      <p className="text-sm text-slate-400">{request.email}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Year {request.year_level} · Section {request.section} · Requested {new Date(request.created_at).toLocaleDateString()}
                    </p>
                    </div>
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
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-sm text-emerald-300">{filteredStudents.length}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredStudents.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-400">No students found in your assigned section.</p>
          ) : (
            <div className="divide-y divide-slate-800">
              {filteredStudents.map((student) => (
                <div key={student.id} className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <img src={getAvatarUrl(student)} alt={`${student.full_name} profile`} className="h-12 w-12 shrink-0 rounded-full border border-slate-700 bg-slate-800 object-cover" />
                    <div>
                      <h2 className="font-semibold text-white">{student.full_name}</h2>
                      <p className="text-sm text-slate-400">{student.email}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Year {student.year_level} · Section {student.section} · Joined {new Date(student.created_at).toLocaleDateString()}
                      </p>
                    </div>
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
