import { useEffect, useState } from 'react';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, X, Loader2 } from 'lucide-react';

interface PendingInstructor {
  id: string;
  email: string;
  full_name: string;
  role: string;
  approval_status?: 'pending' | 'approved' | 'rejected';
}

export function AdminApprovalsPage() {
  const [pendingInstructors, setPendingInstructors] = useState<PendingInstructor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPending = async () => {
    setIsLoading(true);
    setError(null);
    const response = await api.getPendingInstructors();
    if (response.success && response.data) {
      setPendingInstructors((response.data as any).pending_instructors || []);
    } else {
      setError(response.error?.message || 'Unable to load pending instructors');
    }
    setIsLoading(false);
  };

  useEffect(() => {
    void loadPending();
  }, []);

  const handleDecision = async (userId: string, action: 'approve' | 'reject') => {
    setIsUpdating(userId);
    const response = action === 'approve' ? await api.approveInstructor(userId) : await api.rejectInstructor(userId);
    if (response.success) {
      setPendingInstructors((current) => current.filter((user) => user.id !== userId));
    } else {
      setError(response.error?.message || `Unable to ${action} instructor`);
    }
    setIsUpdating(null);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-white">Instructor approvals</h1>
        <p className="text-sm text-slate-400">Review new instructor requests before granting access.</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>
      )}

      <Card className="border-slate-800 bg-slate-900/70">
        <CardHeader>
          <CardTitle className="text-white">Pending requests</CardTitle>
          <CardDescription className="text-slate-400">{pendingInstructors.length} pending approval</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading requests...
            </div>
          ) : pendingInstructors.length === 0 ? (
            <p className="text-sm text-slate-400">No pending instructor requests right now.</p>
          ) : (
            <div className="space-y-3">
              {pendingInstructors.map((user) => (
                <div key={user.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/70 p-4">
                  <div>
                    <p className="font-medium text-white">{user.full_name}</p>
                    <p className="text-sm text-slate-400">{user.email}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                      onClick={() => void handleDecision(user.id, 'approve')}
                      disabled={isUpdating === user.id}
                    >
                      {isUpdating === user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                      onClick={() => void handleDecision(user.id, 'reject')}
                      disabled={isUpdating === user.id}
                    >
                      {isUpdating === user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
