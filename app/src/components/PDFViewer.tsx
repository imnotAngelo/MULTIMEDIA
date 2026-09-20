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
  const [zoom, setZoom] = useState(100);
  const [fitMode, setFitMode] = useState<'width' | 'page' | 'custom'>('width');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfRef = useRef<Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });

  // Update container dimensions whenever container mounts, resizes, or fullscreen/loading toggles
  useEffect(() => {
    if (loading) return;
    const element = canvasContainerRef.current;
    if (!element) return;

    const updateSize = () => {
      if (element.clientWidth) {
        setContainerDimensions({
          width: element.clientWidth,
          height: element.clientHeight,
        });
      }
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    window.addEventListener('resize', updateSize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [isFullscreen, loading]);

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

  // Render current page — crisp at every screen size, perfectly fitted to frame
  useEffect(() => {
    let renderTask: any = null;
    let isCancelled = false;

    const renderPage = async () => {
      if (!pdfRef.current || !canvasRef.current || loading) return;

      const element = canvasContainerRef.current;
      const curWidth = element?.clientWidth || containerDimensions.width;
      const curHeight = element?.clientHeight || containerDimensions.height;

      // If dimensions are not ready in the DOM yet, defer to next frame
      if (!curWidth) {
        requestAnimationFrame(() => {
          if (!isCancelled && element?.clientWidth) {
            setContainerDimensions({ width: element.clientWidth, height: element.clientHeight });
          }
        });
        return;
      }

      try {
        const page = await pdfRef.current.getPage(currentPage);
        if (isCancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const isLandscape = baseViewport.width > baseViewport.height;

        const paddingX = isFullscreen ? 64 : (curWidth < 640 ? 16 : 48);
        const paddingY = isFullscreen ? 64 : (curWidth < 640 ? 16 : 32);
        const availableWidth = Math.max(100, curWidth - paddingX);
        const availableHeight = Math.max(100, curHeight - paddingY);

        // Fit Width: fill width up to 1000px on desktop for pleasant reading
        const targetWidth = isLandscape
          ? availableWidth
          : Math.min(availableWidth, Math.max(680, availableWidth * 0.95));
        const widthFitScale = targetWidth / baseViewport.width;

        // Fit Page: fit both width and height within the frame
        const pageFitScale = Math.min(
          availableWidth / baseViewport.width,
          availableHeight / baseViewport.height
        );

        let scale = widthFitScale;
        if (fitMode === 'page') {
          scale = pageFitScale;
        } else if (fitMode === 'width') {
          scale = widthFitScale;
        } else {
          scale = widthFitScale * (zoom / 100);
        }

        const viewport = page.getViewport({ scale });
        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);

        const canvas = canvasRef.current;
        if (!canvas || isCancelled) return;
        const context = canvas.getContext('2d');
        if (!context) return;

        // Physical canvas size (hi-res pixels)
        canvas.width = Math.ceil(viewport.width * dpr);
        canvas.height = Math.ceil(viewport.height * dpr);

        // CSS display size (logical pixels — matches layout)
        canvas.style.width = `${Math.ceil(viewport.width)}px`;
        canvas.style.height = `${Math.ceil(viewport.height)}px`;

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
      isCancelled = true;
      if (renderTask) {
        try { renderTask.cancel(); } catch { /* ignore */ }
      }
    };
  }, [currentPage, numPages, zoom, fitMode, containerDimensions, isFullscreen, loading]);

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
    setFitMode('custom');
    setZoom((prev) => Math.min(prev + 15, 250));
  };

  const handleZoomOut = () => {
    setFitMode('custom');
    setZoom((prev) => Math.max(prev - 15, 40));
  };

  const handleFitWidth = () => {
    setFitMode('width');
    setZoom(100);
  };

  const handleFitPage = () => {
    setFitMode('page');
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
      } else if (e.key === 'w' || e.key === 'W') {
        handleFitWidth();
      } else if (e.key === 'p' || e.key === 'P') {
        handleFitPage();
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
            disabled={fitMode === 'custom' && zoom <= 40}
            className="h-8 w-8 p-0 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-25"
            title="Zoom Out (-)"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>

          {/* Zoom readout */}
          <span className="px-2 py-1 font-mono text-xs font-semibold text-slate-600 dark:text-slate-300">
            {fitMode === 'width' ? 'Fit Width' : fitMode === 'page' ? 'Fit Page' : `${zoom}%`}
          </span>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomIn}
            disabled={fitMode === 'custom' && zoom >= 250}
            className="h-8 w-8 p-0 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-25"
            title="Zoom In (+)"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block" />

          <Button
            variant="ghost"
            size="sm"
            onClick={handleFitWidth}
            className={`h-8 px-2.5 rounded-xl text-xs font-medium hidden sm:inline-flex items-center gap-1.5 transition-colors ${
              fitMode === 'width'
                ? 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 font-semibold'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Fit document width (scroll to read)"
          >
            <RotateCw className="h-3.5 w-3.5" />
            <span>Fit Width</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleFitPage}
            className={`h-8 px-2.5 rounded-xl text-xs font-medium hidden sm:inline-flex items-center gap-1.5 transition-colors ${
              fitMode === 'page'
                ? 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 font-semibold'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Fit entire page inside frame"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Fit Page</span>
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

      {/* Document Canvas Container — scrollable on desktop and mobile */}
      <div
        ref={canvasContainerRef}
        className={`w-full rounded-2xl transition-all overflow-auto border border-slate-200/80 dark:border-slate-800/80 bg-slate-100/60 dark:bg-slate-950/60 p-3 sm:p-6 shadow-inner ${
          isFullscreen
            ? 'flex flex-1 bg-[#060b11] p-4 sm:p-8 items-start justify-center'
            : 'flex items-start justify-center min-h-[60vh] sm:min-h-[70vh] lg:h-[calc(100vh-13rem)]'
        }`}
      >
        <div className="flex items-center justify-center my-auto min-w-full">
          <canvas
            ref={canvasRef}
            className="rounded-xl bg-white shadow-[0_8px_32px_rgba(0,0,0,0.18)] ring-1 ring-slate-900/10 dark:ring-white/10 transition-all mx-auto block shrink-0"
          />
        </div>
      </div>
    </div>
  );
}
