import { useEffect, useState } from 'react';
import { Check, RefreshCw, UserCheck, Users } from 'lucide-react';
import { AetherSpinner } from '@/components/AetherSpinner';
import { authFetch } from '@/lib/authFetch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AetherLoader } from '@/components/AetherLoader';

interface InstructorRequest {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
}

export function InstructorApprovals() {
  const [requests, setRequests] = useState<InstructorRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const loadRequests = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await authFetch('/admin/instructor-requests');
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || 'Could not load instructor requests');
      }
      setRequests(payload.data || []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not load instructor requests');
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
      const response = await authFetch(`/admin/instructor-requests/${id}/approve`, { method: 'PATCH' });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || 'Could not approve instructor');
      }
      setRequests((current) => current.filter((request) => request.id !== id));
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : 'Could not approve instructor');
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-violet-400">Access control</p>
          <h1 className="mt-1 text-3xl font-bold text-white">Instructor approvals</h1>
          <p className="mt-2 text-slate-400">Review new instructor accounts before they can sign in.</p>
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
            <AetherLoader compact label="Scanning instructor requests" />
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-14 text-center">
              <UserCheck className="h-10 w-10 text-emerald-400" />
              <h2 className="mt-4 text-lg font-semibold text-white">All caught up</h2>
              <p className="mt-1 text-sm text-slate-400">There are no instructor accounts waiting for approval.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {requests.map((request) => (
                <div key={request.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-semibold text-white">{request.full_name}</h2>
                    <p className="text-sm text-slate-400">{request.email}</p>
                    <p className="mt-1 text-xs text-slate-500">Requested {new Date(request.created_at).toLocaleDateString()}</p>
                  </div>
                  <Button onClick={() => approveRequest(request.id)} disabled={approvingId === request.id} className="bg-emerald-600 text-white hover:bg-emerald-500">
                    {approvingId === request.id ? <AetherSpinner className="mr-2 h-4 w-4" /> : <Check className="mr-2 h-4 w-4" />}
                    Approve account
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}