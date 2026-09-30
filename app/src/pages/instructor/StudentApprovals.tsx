import { useEffect, useState } from 'react';
import { Check, RefreshCw, Trash2, UserCheck, Users, Search, CheckSquare, CheckCheck } from 'lucide-react';
import { AetherSpinner } from '@/components/AetherSpinner';
import { authFetch } from '@/lib/authFetch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AetherLoader } from '@/components/AetherLoader';
import { toast } from 'sonner';
import { useThemeStore } from '@/stores/themeStore';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  const theme = useThemeStore((state) => state.theme);
  const isLight = theme === 'light';

  const [requests, setRequests] = useState<StudentRequest[]>([]);
  const [students, setStudents] = useState<StudentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<StudentRequest | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [sectionFilter, setSectionFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Multi-select bulk state
  const [selectedRequestIds, setSelectedRequestIds] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

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
      const msg = requestError instanceof Error ? requestError.message : 'Could not load student requests';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const sections = Array.from(new Set([...requests, ...students].map((s) => s.section).filter(Boolean))).sort();

  const matchesFilters = (student: StudentRequest) => {
    const matchesSection = sectionFilter === 'all' || student.section === sectionFilter;
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      student.full_name?.toLowerCase().includes(query) ||
      student.email?.toLowerCase().includes(query);
    return matchesSection && matchesSearch;
  };

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
      const approvedStudent = requests.find((r) => r.id === id);
      setRequests((current) => current.filter((request) => request.id !== id));
      if (approvedStudent) {
        setStudents((current) => [{ ...approvedStudent, student_approved: true }, ...current]);
        toast.success(`${approvedStudent.full_name || 'Student'} approved successfully`);
      } else {
        toast.success('Student approved successfully');
      }
    } catch (approveError) {
      const msg = approveError instanceof Error ? approveError.message : 'Could not approve student';
      setError(msg);
      toast.error(msg);
    } finally {
      setApprovingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!studentToDelete) return;
    setIsDeleting(true);
    try {
      const response = await authFetch(`/instructor/student-requests/${studentToDelete.id}`, { method: 'DELETE' });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || 'Could not delete student');
      }
      setRequests((current) => current.filter((request) => request.id !== studentToDelete.id));
      setStudents((current) => current.filter((student) => student.id !== studentToDelete.id));
      toast.success(`${studentToDelete.full_name} has been removed from the classroom`);
      setStudentToDelete(null);
    } catch (deleteError) {
      const msg = deleteError instanceof Error ? deleteError.message : 'Could not delete student';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedRequestIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedRequestIds.size === filteredRequests.length && filteredRequests.length > 0) {
      setSelectedRequestIds(new Set());
    } else {
      setSelectedRequestIds(new Set(filteredRequests.map((r) => r.id)));
    }
  };

  const isAllSelected = filteredRequests.length > 0 && selectedRequestIds.size === filteredRequests.length;

  const handleBulkApprove = async () => {
    if (selectedRequestIds.size === 0) return;
    setIsBulkProcessing(true);
    const idsToApprove = Array.from(selectedRequestIds);
    try {
      const results = await Promise.allSettled(
        idsToApprove.map((id) => authFetch(`/instructor/student-requests/${id}/approve`, { method: 'PATCH' }))
      );
      const successfulIds = new Set<string>();
      results.forEach((res, idx) => {
        if (res.status === 'fulfilled' && res.value.ok) {
          successfulIds.add(idsToApprove[idx]);
        }
      });

      if (successfulIds.size > 0) {
        const approved = requests.filter((r) => successfulIds.has(r.id));
        setRequests((curr) => curr.filter((r) => !successfulIds.has(r.id)));
        setStudents((curr) => [
          ...approved.map((s) => ({ ...s, student_approved: true })),
          ...curr,
        ]);
        setSelectedRequestIds((curr) => {
          const next = new Set(curr);
          successfulIds.forEach((id) => next.delete(id));
          return next;
        });
        toast.success(`Approved ${successfulIds.size} student${successfulIds.size !== 1 ? 's' : ''}`);
      }

      if (successfulIds.size < idsToApprove.length) {
        toast.error(`Could not approve ${idsToApprove.length - successfulIds.size} students`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error processing bulk approval');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkReject = async () => {
    if (selectedRequestIds.size === 0) return;
    setIsBulkProcessing(true);
    const idsToDelete = Array.from(selectedRequestIds);
    try {
      const results = await Promise.allSettled(
        idsToDelete.map((id) => authFetch(`/instructor/student-requests/${id}`, { method: 'DELETE' }))
      );
      const successfulIds = new Set<string>();
      results.forEach((res, idx) => {
        if (res.status === 'fulfilled' && res.value.ok) {
          successfulIds.add(idsToDelete[idx]);
        }
      });

      if (successfulIds.size > 0) {
        setRequests((curr) => curr.filter((r) => !successfulIds.has(r.id)));
        setStudents((curr) => curr.filter((s) => !successfulIds.has(s.id)));
        setSelectedRequestIds(new Set());
        toast.success(`Rejected ${successfulIds.size} student registration${successfulIds.size !== 1 ? 's' : ''}`);
      }
      setBulkDeleteConfirmOpen(false);
    } catch (err: any) {
      toast.error(err?.message || 'Error processing bulk rejection');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold tracking-wide text-violet-500 uppercase">Access control</p>
          <h1 className={`mt-1 text-3xl font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
            Student Approvals
          </h1>
          <p className={`mt-1 text-sm ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            Review and manage student registrations for your assigned sections.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={loadRequests}
          disabled={loading}
          className={isLight ? 'border-slate-200 text-slate-700 hover:bg-slate-100 shadow-sm' : 'border-slate-700 text-slate-200 hover:bg-slate-800'}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${isLight ? 'text-slate-400' : 'text-slate-500'}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by student name or email..."
            className={`w-full rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40 transition-colors ${
              isLight
                ? 'bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 shadow-sm'
                : 'bg-slate-800/60 border border-slate-700 text-white placeholder:text-slate-500'
            }`}
          />
        </div>
        {sections.length > 0 && (
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <select
              id="sectionFilter"
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className={`h-9.5 rounded-xl border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-colors w-full sm:w-auto ${
                isLight
                  ? 'border-slate-200 bg-white text-slate-800 shadow-sm'
                  : 'border-slate-700 bg-slate-800/60 text-white'
              }`}
            >
              <option value="all">All sections ({sections.length})</option>
              {sections.map((s) => (
                <option key={s} value={s}>Section {s}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{error}</p>
      )}

      {/* Pending Requests Card */}
      <Card className={`transition-colors overflow-hidden ${
        isLight ? 'border-slate-200 bg-white shadow-sm' : 'border-slate-800 bg-slate-900/70'
      }`}>
        <CardHeader className={`border-b ${isLight ? 'border-slate-100 bg-slate-50/50' : 'border-slate-800'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className={`flex items-center gap-3 text-base font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>
              <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
                <Users className="h-4 w-4 text-violet-500" />
              </div>
              Pending Approval Requests
              <span className="rounded-full bg-violet-500/15 px-2.5 py-0.5 text-xs font-semibold text-violet-500">
                {filteredRequests.length}
              </span>
            </CardTitle>

            {filteredRequests.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleToggleSelectAll}
                    className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 cursor-pointer"
                  />
                  <span className={isLight ? 'text-slate-600' : 'text-slate-400'}>
                    Select All ({filteredRequests.length})
                  </span>
                </label>
              </div>
            )}
          </div>
        </CardHeader>

        {/* Bulk Action Banner */}
        {selectedRequestIds.size > 0 && (
          <div className={cn(
            'flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3 border-b transition-all animate-in fade-in',
            isLight ? 'bg-violet-50/90 border-violet-100 text-violet-900' : 'bg-violet-950/40 border-violet-800/60 text-violet-200'
          )}>
            <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold">
              <CheckSquare className="w-4 h-4 text-violet-500" />
              <span>{selectedRequestIds.size} student{selectedRequestIds.size !== 1 ? 's' : ''} selected</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedRequestIds(new Set())}
                disabled={isBulkProcessing}
                className={cn('text-xs h-8', isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white')}
              >
                Clear
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setBulkDeleteConfirmOpen(true)}
                disabled={isBulkProcessing}
                className="h-8 text-xs gap-1.5 border-rose-500/30 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Bulk Reject ({selectedRequestIds.size})
              </Button>
              <Button
                size="sm"
                onClick={handleBulkApprove}
                disabled={isBulkProcessing}
                className="bg-emerald-600 hover:bg-emerald-500 text-white h-8 text-xs gap-1.5 shadow-sm"
              >
                {isBulkProcessing ? <AetherSpinner className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                Bulk Approve ({selectedRequestIds.size})
              </Button>
            </div>
          </div>
        )}

        <CardContent className="p-0">
          {loading ? (
            <div className="p-4">
              <AetherLoader variant="table" count={4} label="Scanning student requests" />
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-3">
                <UserCheck className="h-6 w-6" />
              </div>
              <h2 className={`text-base font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>All caught up</h2>
              <p className={`mt-1 text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                {searchQuery ? 'No pending requests match your search.' : 'There are no students waiting for approval.'}
              </p>
            </div>
          ) : (
            <div className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-slate-800'}`}>
              {filteredRequests.map((request) => {
                const isSelected = selectedRequestIds.has(request.id);
                return (
                  <div
                    key={request.id}
                    className={cn(
                      'flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between transition-colors',
                      isSelected ? (isLight ? 'bg-violet-50/40' : 'bg-violet-950/20') : ''
                    )}
                  >
                    <div className="flex items-center gap-3.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(request.id)}
                        className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 cursor-pointer shrink-0"
                      />
                      <img
                        src={getAvatarUrl(request)}
                        alt={`${request.full_name} profile`}
                        className={`h-11 w-11 shrink-0 rounded-full border object-cover shadow-sm ${
                          isLight ? 'border-slate-200 bg-slate-100' : 'border-slate-700 bg-slate-800'
                        }`}
                      />
                      <div>
                        <h3 className={`font-medium ${isLight ? 'text-slate-900' : 'text-white'}`}>{request.full_name}</h3>
                        <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{request.email}</p>
                        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium border ${
                            isLight ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}>
                            Section {request.section}
                          </span>
                          <span className={`text-[11px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                            Requested {new Date(request.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pl-7 sm:pl-0">
                      <Button
                        onClick={() => approveRequest(request.id)}
                        disabled={approvingId === request.id || isBulkProcessing}
                        className="bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm"
                      >
                        {approvingId === request.id ? <AetherSpinner className="mr-2 h-4 w-4" /> : <Check className="mr-2 h-4 w-4" />}
                        Approve
                      </Button>
                      <Button
                        onClick={() => setStudentToDelete(request)}
                        variant="outline"
                        disabled={isBulkProcessing}
                        className="border-rose-500/30 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enrolled Students Card */}
      <Card className={`transition-colors overflow-hidden ${
        isLight ? 'border-slate-200 bg-white shadow-sm' : 'border-slate-800 bg-slate-900/70'
      }`}>
        <CardHeader className={`border-b ${isLight ? 'border-slate-100 bg-slate-50/50' : 'border-slate-800'}`}>
          <CardTitle className={`flex items-center gap-3 text-base font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <Users className="h-4 w-4 text-emerald-500" />
            </div>
            Active Classroom Students
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-500">
              {filteredStudents.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredStudents.length === 0 ? (
            <p className={`p-8 text-center text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              {searchQuery ? 'No enrolled students match your search.' : 'No students enrolled in your assigned section.'}
            </p>
          ) : (
            <div className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-slate-800'}`}>
              {filteredStudents.map((student) => (
                <div key={student.id} className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <img
                      src={getAvatarUrl(student)}
                      alt={`${student.full_name} profile`}
                      className={`h-11 w-11 shrink-0 rounded-full border object-cover shadow-sm ${
                        isLight ? 'border-slate-200 bg-slate-100' : 'border-slate-700 bg-slate-800'
                      }`}
                    />
                    <div>
                      <h3 className={`font-medium ${isLight ? 'text-slate-900' : 'text-white'}`}>{student.full_name}</h3>
                      <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{student.email}</p>
                      <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium border ${
                          isLight ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}>
                          Section {student.section}
                        </span>
                        <span className={`text-[11px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                          Joined {new Date(student.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-fit rounded-full border px-2.5 py-1 text-xs font-medium ${
                      student.student_approved === false
                        ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300'
                        : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                    }`}>
                      {student.student_approved === false ? 'Pending approval' : 'Active'}
                    </span>
                    <Button
                      onClick={() => setStudentToDelete(student)}
                      variant="ghost"
                      size="icon"
                      className="text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                      title="Remove student"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete / Reject Student Confirmation Modal */}
      <AlertDialog open={Boolean(studentToDelete)} onOpenChange={(open) => !open && setStudentToDelete(null)}>
        <AlertDialogContent className="bg-slate-900 border-slate-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Student</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Are you sure you want to permanently remove <span className="font-semibold text-slate-200">{studentToDelete?.full_name}</span>? This student will no longer have access to this classroom and their enrollment will be revoked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault();
                handleConfirmDelete();
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isDeleting ? 'Removing...' : 'Confirm Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Reject Students Confirmation Modal */}
      <AlertDialog open={bulkDeleteConfirmOpen} onOpenChange={setBulkDeleteConfirmOpen}>
        <AlertDialogContent className={cn('border', isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white')}>
          <AlertDialogHeader>
            <AlertDialogTitle>Bulk Reject Registrations</AlertDialogTitle>
            <AlertDialogDescription className={isLight ? 'text-slate-600' : 'text-slate-400'}>
              Are you sure you want to reject and remove <span className="font-semibold">{selectedRequestIds.size}</span> pending student registrations? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkProcessing} className={isLight ? 'border-slate-200 text-slate-700' : 'bg-slate-800 border-slate-700 text-slate-300'}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isBulkProcessing}
              onClick={(e) => {
                e.preventDefault();
                handleBulkReject();
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isBulkProcessing ? 'Rejecting...' : `Confirm Reject (${selectedRequestIds.size})`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default StudentApprovals;
