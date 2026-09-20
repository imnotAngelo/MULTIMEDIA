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
  const [resolvedUrl, setResolvedUrl] = useState(resolveBackendAssetUrl(documentUrl));
  const [migrating, setMigrating] = useState(false);
  const token = localStorage.getItem('access_token');
  const isLocalDocument = /^(https?:\/\/)?(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?/i.test(resolvedUrl);

  useEffect(() => {
    setResolvedUrl(resolveBackendAssetUrl(documentUrl));
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
    return <div className="flex min-h-[min(58vh,420px)] items-center justify-center rounded-xl border border-slate-800 bg-slate-950 p-8 text-center text-slate-300 sm:min-h-[min(72vh,820px)]">Preparing PowerPoint preview...</div>;
  }

  if (fileType === 'pptx' && isLocalDocument) {
    return (
      <div className="flex min-h-[min(58vh,420px)] flex-col items-center justify-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-8 text-center text-amber-200 sm:min-h-[min(72vh,820px)]">
        <AlertCircle className="h-5 w-5" />
        <span>PowerPoint preview requires a publicly reachable document URL. Download the file to view it locally.</span>
      </div>
    );
  }

  if (!resolvedUrl) {
    return (
      <div className="flex min-h-[min(58vh,420px)] items-center justify-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-8 text-center text-amber-200 sm:min-h-[min(72vh,820px)]">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <span>Document preview is not available.</span>
      </div>
    );
  }

  return (
    <div className="glass-panel h-[min(58vh,420px)] w-full overflow-hidden rounded-xl sm:h-[min(72vh,820px)] lg:h-[min(calc(100vh-10rem),900px)]">
      <DocViewer
        documents={[{ uri: resolvedUrl, fileType, fileName: `${title}.${fileType}` }]}
        pluginRenderers={DocViewerRenderers}
        requestHeaders={token ? { Authorization: `Bearer ${token}` } : undefined}
        config={{
          header: { disableHeader: true },
          pdfZoom: { defaultZoom: 1.0, zoomJump: 0.2 },
          pdfVerticalScrollByDefault: true,
        }}
        style={{ height: '100%', minHeight: 0, width: '100%' }}
      />
    </div>
  );
}
