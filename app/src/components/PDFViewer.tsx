import { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Download,
  AlertCircle,
  Maximize2,
  Minimize2,
  Eye,
  FileText,
  RotateCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { resolveBackendAssetUrl } from '@/lib/apiConfig';
import { authFetch } from '@/lib/authFetch';
import { AetherLoader } from '@/components/AetherLoader';

// Set up the worker - use the file served from public directory
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface PDFViewerProps {
  url: string;
  title?: string;
  onDownload?: () => void;
}

export function PDFViewer({ url, title, onDownload }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100); // 100% = fit to container width
  const [isFitMode, setIsFitMode] = useState(true); // auto-fit width by default
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfRef = useRef<Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [canvasContainerWidth, setCanvasContainerWidth] = useState(0);

  useEffect(() => {
    const element = canvasContainerRef.current;
    if (!element) return;

    const updateWidth = () => setCanvasContainerWidth(element.clientWidth);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, [isFullscreen]);

  // Load PDF document
  useEffect(() => {
    let isCancelled = false;
    const loadPdf = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!url || url.trim() === '') {
          setError('No PDF URL provided');
          setLoading(false);
          return;
        }

        const absoluteUrl = resolveBackendAssetUrl(url);
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

        if (!isCancelled) {
          pdfRef.current = pdf;
          setNumPages(pdf.numPages);
          setCurrentPage(1);
          setDebugInfo(`PDF loaded: ${pdf.numPages} pages`);
        }
      } catch (err) {
        console.error('Error loading PDF:', err);
        const errorMsg = err instanceof Error ? err.message : 'Failed to load PDF file';
        if (!isCancelled) {
          setError(errorMsg);
          setDebugInfo(`Error: ${errorMsg}`);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    loadPdf();
    return () => {
      isCancelled = true;
    };
  }, [url]);

  // Render current page — crisp at every screen size
  useEffect(() => {
    let renderTask: any = null;
    const renderPage = async () => {
      if (!pdfRef.current || !canvasRef.current || canvasContainerWidth === 0) return;

      try {
        const page = await pdfRef.current.getPage(currentPage);
        const baseViewport = page.getViewport({ scale: 1 });

        // Padding: 16px each side (8px mobile, 32px desktop)
        const padding = isFullscreen ? 64 : (canvasContainerWidth < 640 ? 16 : 32);
        const availableWidth = Math.max(100, canvasContainerWidth - padding);

        // Fit-width scale: always fills the container
        const fitScale = availableWidth / baseViewport.width;

        // In fit mode, always match container width (perfect for mobile).
        // In manual zoom mode, apply zoom relative to fit.
        const scale = isFitMode ? fitScale : fitScale * (zoom / 100);

        const viewport = page.getViewport({ scale });

        // Use device pixel ratio for crisp rendering on hi-DPI/retina screens
        const dpr = Math.min(window.devicePixelRatio || 1, 3); // cap at 3× to save memory

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;

        // Physical canvas size (hi-res pixels)
        canvas.width = Math.ceil(viewport.width * dpr);
        canvas.height = Math.ceil(viewport.height * dpr);

        // CSS display size (logical pixels — matches the layout)
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        canvas.style.maxWidth = '100%';

        // Scale context to match DPR
        context.setTransform(dpr, 0, 0, dpr, 0, 0);

        renderTask = page.render({
          canvasContext: context,
          canvas,
          viewport,
        });

        await renderTask.promise;
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error('Error rendering PDF page:', err);
        }
      }
    };

    renderPage();
    return () => {
      if (renderTask) {
        try { renderTask.cancel(); } catch { /* ignore */ }
      }
    };
  }, [currentPage, numPages, zoom, isFitMode, canvasContainerWidth, isFullscreen]);

  const handlePrevPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  }, [currentPage]);

  const handleNextPage = useCallback(() => {
    if (numPages && currentPage < numPages) {
      setCurrentPage((prev) => prev + 1);
    }
  }, [numPages, currentPage]);

  const handleZoomIn = () => {
    setIsFitMode(false);
    setZoom((prev) => Math.min(prev + 20, 300));
  };

  const handleZoomOut = () => {
    setIsFitMode(false);
    setZoom((prev) => Math.max(prev - 20, 40));
  };

  const handleFitToScreen = () => {
    setIsFitMode(true);
    setZoom(100);
  };

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        handleNextPage();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        handlePrevPage();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        handleZoomOut();
      }
    },
    [handleNextPage, handlePrevPage]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleFullscreen = async () => {
    if (!containerRef.current) return;

    try {
      if (!isFullscreen) {
        if (containerRef.current.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        } else if ((containerRef.current as any).webkitRequestFullscreen) {
          await (containerRef.current as any).webkitRequestFullscreen();
        }
        setIsFullscreen(true);
      } else {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else if ((document as any).webkitFullscreenElement) {
          await (document as any).webkitExitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement || (document as any).webkitFullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] sm:min-h-[70vh] lg:min-h-[calc(100vh-12rem)] w-full items-center justify-center rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40">
        <AetherLoader label="Rendering course document..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] sm:min-h-[70vh] lg:min-h-[calc(100vh-12rem)] w-full flex-col items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
        <AlertCircle className="mb-3 h-10 w-10 text-red-400" />
        <h4 className="text-base font-semibold text-red-400">Failed to load document</h4>
        <p className="mt-1 text-xs text-slate-400 max-w-sm">{error}</p>
        <p className="mt-2 text-[11px] text-slate-500 font-mono">{debugInfo}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`flex flex-col gap-3 transition-all ${
        isFullscreen
          ? 'fixed inset-0 z-50 bg-[#070d14] p-4 sm:p-6 overflow-hidden'
          : 'w-full'
      }`}
    >
      {/* Sleek, Single-Bar Aesthetic Reader Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/90 px-2.5 py-2.5 sm:gap-3 sm:px-4 shadow-sm backdrop-blur-md">
        {/* Left: Page Navigation */}
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrevPage}
            disabled={currentPage === 1}
            className="h-8 w-8 p-0 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-25 transition-all"
            title="Previous Page (←)"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-1 px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700/60 shadow-inner">
            <span className="text-slate-500 dark:text-slate-400 text-[11px]">Page</span>
            <span className="text-violet-600 dark:text-violet-400 font-bold">{currentPage}</span>
            <span className="text-slate-400 dark:text-slate-500">/</span>
            <span>{numPages || 1}</span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleNextPage}
            disabled={!numPages || currentPage === numPages}
            className="h-8 w-8 p-0 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-25 transition-all"
            title="Next Page (→)"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Center: Zoom Controls */}
        <div className="flex min-w-0 items-center gap-1 sm:gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomOut}
            disabled={!isFitMode && zoom <= 40}
            className="h-8 w-8 p-0 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-25"
            title="Zoom Out (-)"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>

          {/* Zoom readout — shows "Fit" when in fit mode, percentage when zoomed manually */}
          <button
            onClick={handleFitToScreen}
            className={`rounded-lg px-2 py-1 font-mono text-xs font-semibold transition-colors ${
              isFitMode
                ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-300'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Reset to Fit Width"
          >
            {isFitMode ? 'Fit' : `${zoom}%`}
          </button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomIn}
            disabled={!isFitMode && zoom >= 300}
            className="h-8 w-8 p-0 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-25"
            title="Zoom In (+)"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block" />

          <Button
            variant="ghost"
            size="sm"
            onClick={handleFitToScreen}
            className={`h-8 px-2.5 rounded-xl text-xs font-medium hidden sm:inline-flex items-center gap-1.5 transition-colors ${
              isFitMode
                ? 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Fit width (reset view)"
          >
            <RotateCw className="h-3.5 w-3.5" />
            <span>Fit Width</span>
          </Button>
        </div>

        {/* Right: Actions */}
        <div className="ml-auto flex min-w-0 items-center gap-1.5">
          {onDownload && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDownload}
              className="h-8 rounded-xl px-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5"
              title="Download PDF"
            >
              <Download className="h-3.5 w-3.5 text-emerald-500" />
              <span className="hidden sm:inline">Download</span>
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleFullscreen}
            className="h-8 rounded-xl px-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Exit</span>
              </>
            ) : (
              <>
                <Maximize2 className="h-3.5 w-3.5 text-violet-500" />
                <span className="hidden sm:inline">Fullscreen</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Document Canvas Container — scrollable on mobile when zoomed in */}
      <div
        ref={canvasContainerRef}
        className={`w-full rounded-2xl transition-all ${
          isFullscreen
            ? 'flex flex-1 overflow-auto bg-[#060b11] p-4 sm:p-8 items-start justify-center'
            : isFitMode
              ? 'overflow-hidden border border-slate-200/80 dark:border-slate-800/80 bg-slate-100/60 dark:bg-slate-950/60 p-1 sm:p-4 shadow-inner flex items-start justify-center min-h-[60vh] sm:min-h-[70vh] lg:min-h-[calc(100vh-12rem)]'
              : 'overflow-auto border border-slate-200/80 dark:border-slate-800/80 bg-slate-100/60 dark:bg-slate-950/60 p-2 sm:p-4 shadow-inner flex items-start justify-center min-h-[60vh] sm:min-h-[70vh] lg:min-h-[calc(100vh-12rem)]'
        }`}
      >
        <div className={`${isFitMode ? 'w-full' : 'mx-auto'} flex items-start justify-center`}>
          <canvas
            ref={canvasRef}
            className="rounded-xl bg-white shadow-[0_8px_32px_rgba(0,0,0,0.15)] ring-1 ring-slate-900/10 dark:ring-white/10 transition-all"
            style={{ display: 'block', maxWidth: isFitMode ? '100%' : 'none' }}
          />
        </div>
      </div>
    </div>
  );
}
