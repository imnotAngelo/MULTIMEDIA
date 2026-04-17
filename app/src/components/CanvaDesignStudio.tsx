// [REMOVED: Canva integration component no longer used]
import React, { useEffect, useRef, useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Loader2, Download, Share2 } from 'lucide-react';

interface CanvaDesignStudioProps {
  designPrompt: string;
  onDesignComplete: (designUrl?: string) => void;
}

type CanvaDesign = { id: string };
type CanvaExportResult = { url: string };
type CanvaCreateDesignOptions = { title: string; type: string };
type CanvaExportDesignOptions = { designId: string; format: string };
type CanvaShareDesignOptions = { designId: string };

export function CanvaDesignStudio({ designPrompt, onDesignComplete }: CanvaDesignStudioProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [designData, setDesignData] = useState<CanvaDesign | null>(null);

  useEffect(() => {
    // Initialize Canva SDK
    const initCanva = async () => {
      try {
        // Load Canva SDK script
        if (!window.Canva) {
          const script = document.createElement('script');
          script.src = 'https://sdk.canva.com/v1/canva.js';
          script.async = true;
          document.body.appendChild(script);

          await new Promise((resolve) => {
            script.onload = resolve;
          });
        }

        // Configure and initialize Canva
        if (window.Canva) {
          // Request design creation
          const design = await window.Canva.createDesign({
            title: 'Interactive Lab Design',
            type: 'presentation', // or 'document', 'image', etc.
          } satisfies CanvaCreateDesignOptions);

          setDesignData(design);
          setIsLoading(false);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to initialize Canva'
        );
        setIsLoading(false);
      }
    };

    initCanva();
  }, []);

  const handleDownloadDesign = async () => {
    try {
      if (designData && designData.id) {
        const canva = window.Canva;
        if (!canva) {
          throw new Error('Canva SDK not loaded');
        }
        // Export design as PNG/PDF
        const exported = await canva.exportDesign({
          designId: designData.id,
          format: 'png', // or 'pdf'
        } satisfies CanvaExportDesignOptions);

        // Create download link
        const link = document.createElement('a');
        link.href = exported.url;
        link.download = `design-${Date.now()}.png`;
        link.click();

        // Notify completion
        onDesignComplete(exported.url);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to export design'
      );
    }
  };

  const handleShareDesign = async () => {
    try {
      if (designData && designData.id) {
        const canva = window.Canva;
        if (!canva) {
          throw new Error('Canva SDK not loaded');
        }
        // Share design
        const shareUrl = await canva.shareDesign({
          designId: designData.id,
        } satisfies CanvaShareDesignOptions);

        // Copy to clipboard
        await navigator.clipboard.writeText(shareUrl);
        alert('Share link copied to clipboard!');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to share design');
    }
  };

  return (
    <Card className="bg-slate-900/60 border-slate-800 p-6">
      <div className="space-y-4">
        {/* Design Prompt */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-2">Design Brief</h3>
          <p className="text-slate-300">{designPrompt}</p>
        </div>

        {/* Canva Container */}
        <div
          ref={containerRef}
          className="w-full rounded-lg overflow-hidden bg-slate-950 border border-slate-800"
          style={{ minHeight: '500px' }}
        >
          {isLoading && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
                <p className="text-slate-300">Loading Canva Design Studio...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <p className="text-red-400 font-semibold mb-2">Error</p>
                <p className="text-slate-300 text-sm">{error}</p>
              </div>
            </div>
          )}

          {!isLoading && !error && designData && (
            <div className="w-full h-full">
              {/* Canva design canvas will be embedded here */}
              <div id="canva-design-container" className="w-full h-full" />
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {designData && !isLoading && (
          <div className="flex gap-3 justify-end">
            <Button
              onClick={handleShareDesign}
              variant="outline"
              className="border-slate-700 text-slate-200 hover:bg-slate-800"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share Design
            </Button>

            <Button
              onClick={handleDownloadDesign}
              className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600"
            >
              <Download className="w-4 h-4 mr-2" />
              Download & Submit
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

// Extend window interface for Canva SDK
declare global {
  interface Window {
    Canva?: {
      createDesign: (options: CanvaCreateDesignOptions) => Promise<CanvaDesign>;
      exportDesign: (options: CanvaExportDesignOptions) => Promise<CanvaExportResult>;
      shareDesign: (options: CanvaShareDesignOptions) => Promise<string>;
    };
  }
}
