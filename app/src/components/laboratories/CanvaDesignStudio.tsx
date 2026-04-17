// [REMOVED: Canva integration component no longer used]
import { useState, useRef, useEffect } from 'react';
import { Download, Share2, Save, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

// Canva App Configuration
const CANVA_APP_ID = 'AAHAAELrVU0';
const CANVA_ORIGIN = 'https://www.canva.com';

interface CanvaDesignStudioProps {
  designPrompt: string;
  onDesignComplete?: () => void;
}

/**
 * Canva Design Studio Component
 * Enables creative expression through design
 * Integrates with Canva for rich design capabilities using app ID: AAHAAELrVU0
 */
export function CanvaDesignStudio({ designPrompt, onDesignComplete }: CanvaDesignStudioProps) {
  const [designTitle, setDesignTitle] = useState('');
  const [designNotes, setDesignNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [canvaLoaded, setCanvaLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Load Canva SDK on component mount
  useEffect(() => {
    // Load Canva Button SDK
    const script = document.createElement('script');
    script.src = 'https://sdk.canva.com/@canva/web-embed@1/bundle.js';
    script.async = true;
    script.onload = () => {
      console.log('Canva SDK loaded successfully');
      setCanvaLoaded(true);
    };
    script.onerror = () => {
      console.error('Failed to load Canva SDK');
    };
    document.body.appendChild(script);

    return () => {
      // Cleanup if needed
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  const handleDesignComplete = async () => {
    if (!designTitle.trim()) {
      alert('Please give your design a title');
      return;
    }

    setIsSubmitting(true);
    try {
      // Simulate saving design
      await new Promise(resolve => setTimeout(resolve, 2000));

      const design = {
        title: designTitle,
        prompt: designPrompt,
        notes: designNotes,
        completedAt: new Date().toISOString(),
        url: 'https://canva.com/design/example'
      };

      // Store design locally or send to backend
      saveDesign(design);

      setIsCompleted(true);
      onDesignComplete?.();
    } catch (error) {
      console.error('Error saving design:', error);
      alert('Failed to save design. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = () => {
    // In production, this would trigger Canva export
    alert('Design download initiated. Check your downloads folder.');
  };

  const handleShare = () => {
    // In production, this would generate shareable link
    const shareUrl = `${window.location.origin}/portfolio/${designTitle.replace(/\s+/g, '-')}`;
    navigator.clipboard.writeText(shareUrl);
    alert('Share link copied to clipboard!');
  };

  return (
    <div className="space-y-6">
      {/* Design Prompt */}
      <Card className="bg-violet-500/10 border border-violet-500/30 p-4">
        <h3 className="font-semibold text-violet-300 mb-2">Design Challenge</h3>
        <p className="text-sm text-violet-200">{designPrompt}</p>
      </Card>

      {/* Canva Embed */}
      <div className="space-y-3">
        <h3 className="font-semibold text-slate-200">Create Your Design</h3>
        <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden aspect-video">
          {/* Canva App Integration */}
          <div className="w-full h-full bg-slate-800 flex items-center justify-center relative">
            {canvaLoaded ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center">
                <div className="space-y-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-purple-600 rounded-lg mx-auto opacity-75" />
                  <div>
                    <p className="text-slate-300 text-sm font-semibold">Canva Design Studio Ready</p>
                    <p className="text-slate-400 text-xs mt-2">App ID: {CANVA_APP_ID}</p>
                    <p className="text-slate-500 text-xs mt-3">Click "Create with Canva" to open the design editor</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center space-x-2 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Loading Canva...</span>
              </div>
            )}
          </div>
        </div>

        {/* Canva Quick Links */}
        <div className="grid grid-cols-3 gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const canvaUrl = `https://www.canva.com/design/create/?apiKey=${CANVA_APP_ID}`;
              window.open(canvaUrl, '_blank');
            }}
            className="border-slate-600 hover:bg-slate-700 text-xs"
          >
            Create with Canva
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDownload}
            className="border-slate-600 hover:bg-slate-700 text-xs"
          >
            <Download className="w-3 h-3 mr-1" />
            Download
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleShare}
            className="border-slate-600 hover:bg-slate-700 text-xs"
          >
            <Share2 className="w-3 h-3 mr-1" />
            Share
          </Button>
        </div>
      </div>

      {/* Design Details */}
      <div className="space-y-4">
        <h3 className="font-semibold text-slate-200">Design Details</h3>
        
        <div>
          <label className="text-sm font-medium text-slate-300 mb-2 block">
            Design Title *
          </label>
          <Input
            value={designTitle}
            onChange={(e) => setDesignTitle(e.target.value)}
            placeholder="Give your design a meaningful title"
            className="bg-slate-800 border-slate-700 text-white placeholder-slate-500"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-300 mb-2 block">
            Design Notes & Reflection
          </label>
          <textarea
            value={designNotes}
            onChange={(e) => setDesignNotes(e.target.value)}
            placeholder="Explain your design choices, what you learned, and how it relates to the concepts..."
            className="w-full bg-slate-800 border border-slate-700 text-white p-3 rounded-lg text-sm placeholder-slate-500 resize-none focus:outline-none focus:border-slate-600"
            rows={5}
          />
          <p className="text-xs text-slate-500 mt-2">
            {designNotes.length} / 500 characters
          </p>
        </div>
      </div>

      {/* Learning Outcomes */}
      <Card className="bg-slate-800/50 border border-slate-700 p-4">
        <h3 className="font-semibold text-slate-200 mb-3">Learning Outcomes</h3>
        <ul className="space-y-2 text-sm text-slate-300">
          <li className="flex items-start gap-2">
            <span className="text-pink-400 mt-1">✓</span>
            <span>Applied theoretical concepts to creative work</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-pink-400 mt-1">✓</span>
            <span>Developed visual communication skills</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-pink-400 mt-1">✓</span>
            <span>Expressed knowledge through design</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-pink-400 mt-1">✓</span>
            <span>Created portfolio piece</span>
          </li>
        </ul>
      </Card>

      {/* Submission */}
      {!isCompleted ? (
        <Button
          onClick={handleDesignComplete}
          disabled={isSubmitting || !designTitle.trim()}
          className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 py-6 text-white"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving Your Design...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Submit Creative Project
            </>
          )}
        </Button>
      ) : (
        <Card className="bg-green-500/10 border border-green-500/30 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-green-300">Design Submitted!</p>
              <p className="text-sm text-green-200">Your creative work has been saved to your portfolio.</p>
            </div>
          </div>
        </Card>
      )}

      {/* Tips */}
      <Card className="bg-blue-500/10 border border-blue-500/30 p-4">
        <h4 className="font-semibold text-blue-300 mb-2">💡 Creative Tips</h4>
        <ul className="text-sm text-blue-200 space-y-1">
          <li>• Use colors that reflect the concepts you learned</li>
          <li>• Include text elements that summarize key ideas</li>
          <li>• Incorporate visual metaphors related to the topic</li>
          <li>• Make it visually appealing and easy to understand</li>
        </ul>
      </Card>
    </div>
  );
}

/**
 * Save design to portfolio
 */
function saveDesign(design: any) {
  const designs = JSON.parse(localStorage.getItem('userDesigns') || '[]');
  designs.push(design);
  localStorage.setItem('userDesigns', JSON.stringify(designs));
}

/**
 * Get all user designs
 */
export function getUserDesigns() {
  return JSON.parse(localStorage.getItem('userDesigns') || '[]');
}
