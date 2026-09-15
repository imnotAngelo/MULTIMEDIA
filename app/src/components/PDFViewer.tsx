import { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, AlertCircle, Maximize2, Minimize2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { resolveBackendAssetUrl } from '@/lib/apiConfig';
import { authFetch } from '@/lib/authFetch';

// Set up the worker - use the file served from public directory
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface PDFViewerProps {
  url: string;
  title?: string;
  onDownload?: () => void;
}

export function PDFViewer({ url, title = 'PDF Document', onDownload }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100); // Start at 100% so full content is visible
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfRef = useRef<pdfjsLib.PDFDocument | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load PDF document
  useEffect(() => {
    const loadPdf = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('📄 PDFViewer - Loading PDF from URL:', url);
        
        if (!url || url.trim() === '') {
          setError('No PDF URL provided');
          setLoading(false);
          return;
        }

        // Normalize relative and legacy localhost URLs to the configured API.
        const absoluteUrl = resolveBackendAssetUrl(url);

        console.log('📄 Resolved PDF URL:', absoluteUrl);
        setDebugInfo(`Loading from: ${absoluteUrl}`);

        const response = await authFetch(absoluteUrl, {
          cache: 'no-store',
          headers: { Accept: 'application/pdf' },
        });

        if (!response.ok) {
          throw new Error(`PDF request failed (${response.status})`);
        }

        const pdfBytes = await response.arrayBuffer();
        if (pdfBytes.byteLength === 0) {
          throw new Error('PDF response was empty');
        }

        const pdf = await pdfjsLib.getDocument({
          data: new Uint8Array(pdfBytes),
        }).promise;

        console.log('✅ PDF loaded successfully, pages:', pdf.numPages);
        pdfRef.current = pdf;
        setNumPages(pdf.numPages);
        setCurrentPage(1);
        setDebugInfo(`PDF loaded: ${pdf.numPages} pages`);
      } catch (err) {
        console.error('❌ Error loading PDF:', err);
        const errorMsg = err instanceof Error ? err.message : 'Failed to load PDF file';
        setError(errorMsg);
        setDebugInfo(`Error: ${errorMsg}`);
      } finally {
        setLoading(false);
      }
    };

    loadPdf();
  }, [url]);

  // Render current page
  useEffect(() => {
    const renderPage = async () => {
      if (!pdfRef.current || !canvasRef.current) return;

      try {
        const page = await pdfRef.current.getPage(currentPage);
        const scale = zoom / 100;
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        if (!context) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;
      } catch (err) {
        console.error('❌ Error rendering page:', err);
      }
    };

    renderPage();
  }, [currentPage, zoom]);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (numPages && currentPage < numPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleZoomIn = () => {
    setZoom(Math.min(zoom + 25, 300)); // Allow up to 300% zoom
  };

  const handleZoomOut = () => {
    setZoom(Math.max(zoom - 25, 75)); // Minimum 75% zoom
  };

  const handleFitToScreen = () => {
    // Set zoom to fit the PDF to the visible area with all content visible
    setZoom(100); // 100% ensures full content is visible
  };

  const handleFullscreen = async () => {
    if (!containerRef.current) return;

    try {
      if (!isFullscreen) {
        // Request fullscreen
        if (containerRef.current.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        } else if ((containerRef.current as any).webkitRequestFullscreen) {
          await (containerRef.current as any).webkitRequestFullscreen();
        } else if ((containerRef.current as any).mozRequestFullScreen) {
          await (containerRef.current as any).mozRequestFullScreen();
        }
        setIsFullscreen(true);
        // Keep at 100% so full content is visible
        setTimeout(() => {
          setZoom(100); // Keep at 100% to show everything
        }, 100);
      } else {
        // Exit fullscreen
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else if ((document as any).webkitFullscreenElement) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).mozFullScreenElement) {
          await (document as any).mozCancelFullScreen();
        }
        setIsFullscreen(false);
        setZoom(100); // Keep at 100% to show everything
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  };

  // Handle fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement
      );
      setIsFullscreen(isCurrentlyFullscreen);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    (document as any).addEventListener('webkitfullscreenchange', handleFullscreenChange);
    (document as any).addEventListener('mozfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      (document as any).removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      (document as any).removeEventListener('mozfullscreenchange', handleFullscreenChange);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center rounded-lg border border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/60">
        <div className="text-center">
          <p className="mb-2 text-slate-700 dark:text-slate-300">Loading PDF...</p>
          <p className="text-xs text-slate-500 dark:text-slate-500">{debugInfo}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-96 items-center justify-center rounded-lg border border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/60">
        <div className="text-center max-w-md">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500 dark:text-red-400" />
          <p className="mb-2 font-semibold text-red-600 dark:text-red-400">Failed to Load PDF</p>
          <p className="mb-4 text-sm text-red-500 dark:text-red-300">{error}</p>
          <p className="mb-3 text-xs text-slate-600 dark:text-slate-400">Debug Info:</p>
          <p className="break-all rounded border border-slate-200 bg-slate-100 p-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">{debugInfo}</p>
          <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">Check browser console for more details</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`flex flex-col gap-0 ${
        isFullscreen
          ? 'fixed inset-0 z-50 bg-slate-100 dark:bg-slate-950'
          : 'w-full'
      }`}
    >
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
          {numPages && (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Page {currentPage} of {numPages}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {onDownload && (
            <Button
              onClick={onDownload}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              size="sm"
            >
              <Download className="w-4 h-4" />
              Download
            </Button>
          )}
          <Button
            onClick={handleFullscreen}
            className="bg-violet-600 hover:bg-violet-700 text-white gap-2"
            size="sm"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-4 h-4" />
                Exit
              </>
            ) : (
              <>
                <Maximize2 className="w-4 h-4" />
                Fullscreen
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="m-4 mt-0 flex flex-shrink-0 items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-900/60">
        <div className="flex items-center gap-2">
          <Button
            onClick={handlePrevPage}
            disabled={currentPage === 1}
            className="border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 dark:disabled:border-slate-800 dark:disabled:bg-slate-900 dark:disabled:text-slate-600"
            size="sm"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="px-3 text-sm text-slate-600 dark:text-slate-300">
            {currentPage} / {numPages}
          </span>
          <Button
            onClick={handleNextPage}
            disabled={!numPages || currentPage === numPages}
            className="border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 dark:disabled:border-slate-800 dark:disabled:bg-slate-900 dark:disabled:text-slate-600"
            size="sm"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600 dark:text-slate-400">{zoom}%</span>
          <Button
            onClick={handleZoomOut}
            className="border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
            size="sm"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button
            onClick={handleFitToScreen}
            className="border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
            size="sm"
            title="Fit to Screen"
          >
            <Eye className="w-4 h-4" />
          </Button>
          <Button
            onClick={handleZoomIn}
            className="border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
            size="sm"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Canvas - PDF Rendering */}
      <div className={`flex-1 overflow-auto flex items-center justify-center ${
        isFullscreen
          ? 'bg-slate-100 p-4 dark:bg-slate-950'
          : 'm-4 mt-0 rounded-lg border border-slate-200 bg-slate-100/80 p-4 dark:border-slate-800 dark:bg-slate-900/60'
      }`}>
        <canvas
          ref={canvasRef}
          className="rounded bg-white shadow-lg ring-1 ring-slate-200 dark:ring-slate-700"
          style={{
            width: '100%',
            maxWidth: '100%',
            height: 'auto',
            display: 'block',
          }}
        />
      </div>
    </div>
  );
}
