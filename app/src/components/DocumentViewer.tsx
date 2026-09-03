import { useEffect, useState } from 'react';
import DocViewer, { DocViewerRenderers } from '@cyntler/react-doc-viewer';
import { AlertCircle } from 'lucide-react';
import { API_BASE_URL, resolveBackendAssetUrl } from '@/lib/apiConfig';
import { PDFViewer } from './PDFViewer';
import { authFetch } from '@/lib/authFetch';

interface DocumentViewerProps {
  lessonId?: string;
  documentUrl: string;
  title: string;
  fileType: 'pdf' | 'pptx';
}

export function DocumentViewer({ lessonId, documentUrl, title, fileType }: DocumentViewerProps) {
  const [error, setError] = useState('');
  const [resolvedUrl, setResolvedUrl] = useState(resolveBackendAssetUrl(documentUrl));
  const [migrating, setMigrating] = useState(false);
  const token = localStorage.getItem('access_token');
  const isLocalDocument = /^(https?:\/\/)?(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?/i.test(resolvedUrl);

  useEffect(() => {
    setResolvedUrl(resolveBackendAssetUrl(documentUrl));
    setError('');
  }, [documentUrl]);

  useEffect(() => {
    if (fileType !== 'pptx' || !lessonId || !isLocalDocument) return;
    setMigrating(true);
    let cancelled = false;
    authFetch(`${API_BASE_URL}/lessons/by-id/${lessonId}`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json();
        const migratedUrl = payload?.data?.pdf_url || payload?.data?.pdfUrl;
        if (!cancelled && response.ok && migratedUrl) setResolvedUrl(resolveBackendAssetUrl(migratedUrl));
        if (!cancelled) setMigrating(false);
      })
      .catch(() => { if (!cancelled) setMigrating(false); });
    return () => { cancelled = true; };
  }, [fileType, lessonId, isLocalDocument]);

  if (fileType === 'pdf') {
    return <PDFViewer url={resolvedUrl} title={title} />;
  }

  if (fileType === 'pptx' && migrating) {
    return <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-slate-800 bg-slate-950 p-8 text-center text-slate-300">Preparing PowerPoint preview...</div>;
  }

  if (fileType === 'pptx' && isLocalDocument) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-8 text-center text-amber-200">
        <AlertCircle className="h-5 w-5" />
        <span>PowerPoint preview requires a publicly reachable document URL. Download the file to view it locally.</span>
      </div>
    );
  }

  if (!resolvedUrl) {
    return (
      <div className="flex min-h-[420px] items-center justify-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-8 text-center text-amber-200">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <span>Document preview is not available.</span>
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
      <DocViewer
        documents={[{ uri: resolvedUrl, fileType, fileName: `${title}.${fileType}` }]}
        pluginRenderers={DocViewerRenderers}
        requestHeaders={token ? { Authorization: `Bearer ${token}` } : undefined}
        config={{ header: { disableHeader: true }, pdfZoom: { defaultZoom: 1.1 } }}
        style={{ height: '80vh', minHeight: '600px', width: '100%' }}
        onError={() => setError('Document preview could not be loaded.')}
      />
      {error && <p className="p-4 text-center text-sm text-amber-200">{error}</p>}
    </div>
  );
}
