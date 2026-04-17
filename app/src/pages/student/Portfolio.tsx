import { useState, useEffect } from 'react';
import { Share2, Download, Trash2, Eye, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getUserDesigns } from '@/components/laboratories/CanvaDesignStudio';

interface PortfolioDesign {
  id: string;
  title: string;
  prompt: string;
  notes: string;
  completedAt: string;
  url: string;
  thumbnail?: string;
}

/**
 * Portfolio Component
 * Displays student's created designs and creative work
 * Allows sharing and showcasing of learning outcomes
 */
export function Portfolio() {
  const [designs, setDesigns] = useState<PortfolioDesign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDesign, setSelectedDesign] = useState<PortfolioDesign | null>(null);
  const [filter, setFilter] = useState<'all' | 'recent' | 'favorite'>('all');

  useEffect(() => {
    // Load designs from localStorage
    const loadDesigns = async () => {
      try {
        setIsLoading(true);
        const designData = getUserDesigns();
        setDesigns(designData);
      } catch (error) {
        console.error('Error loading portfolio:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDesigns();
  }, []);

  const handleDelete = (designId: string) => {
    if (confirm('Are you sure you want to delete this design?')) {
      const updatedDesigns = designs.filter(d => d.id !== designId);
      setDesigns(updatedDesigns);
      localStorage.setItem('userDesigns', JSON.stringify(updatedDesigns));
    }
  };

  const handleShare = (design: PortfolioDesign) => {
    const shareUrl = `${window.location.origin}/portfolio/${design.id}`;
    navigator.clipboard.writeText(shareUrl);
    alert('Portfolio link copied to clipboard!');
  };

  const handleDownload = (design: PortfolioDesign) => {
    alert(`Downloading ${design.title}...`);
  };

  const filteredDesigns = designs.filter(design => {
    if (filter === 'recent') {
      const recent = new Date(design.completedAt);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return recent >= thirtyDaysAgo;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Student Portfolio</h1>
          <p className="text-slate-400 mt-2">Showcase your creative work and learning journey</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-slate-900/60 border-slate-800 p-4">
            <p className="text-xs text-slate-400 mb-1">Total Designs</p>
            <p className="text-2xl font-bold text-violet-400">{designs.length}</p>
          </Card>
          <Card className="bg-slate-900/60 border-slate-800 p-4">
            <p className="text-xs text-slate-400 mb-1">Recent (30 days)</p>
            <p className="text-2xl font-bold text-pink-400">
              {designs.filter(d => {
                const recent = new Date(d.completedAt);
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                return recent >= thirtyDaysAgo;
              }).length}
            </p>
          </Card>
          <Card className="bg-slate-900/60 border-slate-800 p-4">
            <p className="text-xs text-slate-400 mb-1">Public Shares</p>
            <p className="text-2xl font-bold text-blue-400">
              {designs.filter(d => d.url).length}
            </p>
          </Card>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(['all', 'recent', 'favorite'] as const).map(f => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f)}
            className={cn(
              filter === f
                ? 'bg-violet-600 hover:bg-violet-700'
                : 'border-slate-600 hover:bg-slate-800'
            )}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
          <span className="ml-3 text-slate-300">Loading portfolio...</span>
        </div>
      ) : filteredDesigns.length === 0 ? (
        <Card className="bg-slate-900/60 border-slate-800 p-12 text-center">
          <p className="text-slate-400 mb-4">No designs yet</p>
          <p className="text-sm text-slate-500">
            Complete laboratory projects to create your portfolio
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDesigns.map(design => (
            <Card
              key={design.id}
              className="bg-slate-900/60 border-slate-800 overflow-hidden hover:border-slate-700 transition-all cursor-pointer group"
              onClick={() => setSelectedDesign(design)}
            >
              {/* Thumbnail */}
              <div className="relative w-full h-40 bg-gradient-to-br from-slate-800 to-slate-900 floor items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-pink-500/10 group-hover:from-violet-500/20 group-hover:to-pink-500/20 transition-all" />
                <Eye className="w-8 h-8 text-slate-500 group-hover:text-slate-300 transition-all" />
              </div>

              {/* Content */}
              <div className="p-4 space-y-3">
                <div>
                  <h3 className="font-semibold text-white truncate">{design.title}</h3>
                  <p className="text-xs text-slate-500">
                    {new Date(design.completedAt).toLocaleDateString()}
                  </p>
                </div>

                <p className="text-sm text-slate-400 line-clamp-2">{design.prompt}</p>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleShare(design);
                    }}
                    className="flex-1 border-slate-600 hover:bg-slate-700 h-8"
                  >
                    <Share2 className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(design);
                    }}
                    className="flex-1 border-slate-600 hover:bg-slate-700 h-8"
                  >
                    <Download className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(design.id);
                    }}
                    className="border-red-600/30 hover:bg-red-500/10 h-8"
                  >
                    <Trash2 className="w-3 h-3 text-red-400" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedDesign && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedDesign(null)}
        >
          <Card
            className="bg-slate-900 border-slate-800 w-full max-w-2xl max-h-96 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h2 className="text-2xl font-bold text-white mb-4">{selectedDesign.title}</h2>

              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-slate-300 mb-2">Design Prompt</h3>
                  <p className="text-slate-400">{selectedDesign.prompt}</p>
                </div>

                {selectedDesign.notes && (
                  <div>
                    <h3 className="font-semibold text-slate-300 mb-2">Student Reflection</h3>
                    <p className="text-slate-400">{selectedDesign.notes}</p>
                  </div>
                )}

                <div>
                  <h3 className="font-semibold text-slate-300 mb-2">Completed</h3>
                  <p className="text-slate-400">
                    {new Date(selectedDesign.completedAt).toLocaleString()}
                  </p>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={() => {
                      handleShare(selectedDesign);
                      setSelectedDesign(null);
                    }}
                    className="flex-1 bg-violet-600 hover:bg-violet-700"
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Share Portfolio
                  </Button>
                  <Button
                    onClick={() => setSelectedDesign(null)}
                    variant="outline"
                    className="border-slate-600"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
