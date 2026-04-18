import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';

type StoredUser = {
  email?: string;
  role?: string;
};

export function AuthDiagnostic() {
  const [tokens, setTokens] = useState<{
    accessToken: string | null;
    refreshToken: string | null;
    accessTokenValid: boolean;
    refreshTokenValid: boolean;
  }>({
    accessToken: null,
    refreshToken: null,
    accessTokenValid: false,
    refreshTokenValid: false,
  });

  const [user, setUser] = useState<StoredUser | null>(null);
  const [apiStatus, setApiStatus] = useState<'unknown' | 'ok' | 'error'>('unknown');

  async function testAPIConnection() {
    try {
      const response = await fetch(`${API_BASE}/health`, {
        method: 'GET',
      }).catch(() => null);

      if (response && response.ok) {
        setApiStatus('ok');
      } else {
        setApiStatus('error');
      }
    } catch {
      setApiStatus('error');
    }
  }

  useEffect(() => {
    // Check tokens
    const accessToken = localStorage.getItem('access_token');
    const refreshToken = localStorage.getItem('refresh_token');

    setTokens({
      accessToken: accessToken ? accessToken.substring(0, 50) + '...' : null,
      refreshToken: refreshToken ? refreshToken.substring(0, 50) + '...' : null,
      accessTokenValid: !!accessToken,
      refreshTokenValid: !!refreshToken,
    });

    // Try to get user from auth store
    try {
      const authState = localStorage.getItem('auth-storage');
      if (authState) {
        const parsed: unknown = JSON.parse(authState);
        const maybeUser = (parsed as { state?: { user?: StoredUser } } | null | undefined)?.state?.user;
        setUser(maybeUser ?? null);
      }
    } catch {
      console.error('Failed to parse auth-storage');
    }

    // Test API connection
    testAPIConnection();
  }, []);

  const tokenStatus = tokens.accessTokenValid && tokens.refreshTokenValid;

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-slate-900 border border-slate-700 rounded-lg p-4 shadow-lg z-50">
      <div className="space-y-3 text-sm">
        <h3 className="font-bold text-slate-200 mb-3 flex items-center gap-2">
          🔐 Auth Diagnostic
        </h3>

        {/* Access Token */}
        <div className="bg-slate-800/50 p-2 rounded">
          <div className="flex items-center gap-2 mb-1">
            {tokens.accessTokenValid ? (
              <CheckCircle className="w-4 h-4 text-green-400" />
            ) : (
              <XCircle className="w-4 h-4 text-red-400" />
            )}
            <span className="font-mono text-xs text-slate-300">Access Token</span>
          </div>
          <div className="text-xs text-slate-500 font-mono">
            {tokens.accessToken || 'MISSING'}
          </div>
        </div>

        {/* Refresh Token */}
        <div className="bg-slate-800/50 p-2 rounded">
          <div className="flex items-center gap-2 mb-1">
            {tokens.refreshTokenValid ? (
              <CheckCircle className="w-4 h-4 text-green-400" />
            ) : (
              <XCircle className="w-4 h-4 text-red-400" />
            )}
            <span className="font-mono text-xs text-slate-300">Refresh Token</span>
          </div>
          <div className="text-xs text-slate-500 font-mono">
            {tokens.refreshToken || 'MISSING'}
          </div>
        </div>

        {/* User */}
        <div className="bg-slate-800/50 p-2 rounded">
          <div className="flex items-center gap-2 mb-1">
            {user ? (
              <CheckCircle className="w-4 h-4 text-green-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-yellow-400" />
            )}
            <span className="font-mono text-xs text-slate-300">User</span>
          </div>
          {user ? (
            <div className="text-xs text-slate-400">
              {user.email} ({user.role})
            </div>
          ) : (
            <div className="text-xs text-slate-500">Not logged in</div>
          )}
        </div>

        {/* API Status */}
        <div className="bg-slate-800/50 p-2 rounded">
          <div className="flex items-center gap-2 mb-1">
            {apiStatus === 'ok' ? (
              <CheckCircle className="w-4 h-4 text-green-400" />
            ) : apiStatus === 'error' ? (
              <XCircle className="w-4 h-4 text-red-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-yellow-400" />
            )}
            <span className="font-mono text-xs text-slate-300">API Status</span>
          </div>
          <div className="text-xs text-slate-400">
            {apiStatus === 'ok'
              ? `${API_BASE} ✓`
              : 'Not available'}
          </div>
        </div>

        {/* Summary */}
        <div className="border-t border-slate-700 pt-2 mt-2 text-xs">
          {!tokenStatus && (
            <div className="text-red-300 flex gap-2">
              <span>❌</span>
              <span>Tokens missing. Please log in.</span>
            </div>
          )}
          {tokenStatus && !user && (
            <div className="text-yellow-300 flex gap-2">
              <span>⚠️</span>
              <span>Tokens exist but user not in state.</span>
            </div>
          )}
          {tokenStatus && user && (
            <div className="text-green-300 flex gap-2">
              <span>✅</span>
              <span>Auth looks good!</span>
            </div>
          )}
          {apiStatus === 'error' && (
            <div className="text-red-300 flex gap-2 mt-2">
              <span>❌</span>
              <span>Backend not running (port 3001)</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
