import { useEffect, useRef, useState } from 'react';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface H5PActivityProps {
  activityId: string;
  onComplete?: () => void;
}

/**
 * H5P Activity Component
 * Integrates H5P interactive activities for hands-on learning
 * Supports: Quizzes, Drag-and-drop, Flashcards, Video, Simulations
 */
export function H5PActivity({ activityId, onComplete }: H5PActivityProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    // Load H5P script and initialize activity
    const loadH5P = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Load H5P core first if not already loaded
        if (!(window as any).H5P) {
          const h5pScript = document.createElement('script');
          h5pScript.src = 'https://h5p.org/h5p-hub/mods/h5plib_v3/vendor/h5p/h5p-core/js/h5p-resizer.js';
          h5pScript.async = true;
          document.body.appendChild(h5pScript);

          await new Promise(resolve => {
            h5pScript.onload = resolve;
          });
        }

        // Mock H5P activity data - in production, fetch from your H5P server
        const activityData = getActivityData(activityId);

        if (containerRef.current) {
          containerRef.current.innerHTML = '';
          
          // Create H5P container
          const h5pContainer = document.createElement('div');
          h5pContainer.className = 'h5p-container';
          h5pContainer.id = `h5p-${activityId}`;
          containerRef.current.appendChild(h5pContainer);

          // Simulate H5P activity loading
          h5pContainer.innerHTML = `
            <div class="h5p-activity" data-activity="${activityId}">
              <div class="activity-content">
                ${activityData.content}
              </div>
            </div>
          `;

          // Add completion tracking
          setupActivityTracking(h5pContainer, () => {
            setIsCompleted(true);
            onComplete?.();
          });
        }

        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load H5P activity');
        setIsLoading(false);
      }
    };

    loadH5P();
  }, [activityId, onComplete]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
        <span className="ml-3 text-slate-300">Loading interactive activity...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-red-500/10 border border-red-500/30 p-6">
        <div className="flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-red-400 mt-1 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-red-300 mb-1">Error Loading Activity</h4>
            <p className="text-sm text-red-200">{error}</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div
        ref={containerRef}
        className="bg-slate-800/50 rounded-lg border border-slate-700 p-6 min-h-96"
      />
      
      {isCompleted && (
        <Card className="bg-green-500/10 border border-green-500/30 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <p className="text-sm text-green-300">
              ✓ Activity completed! Great job learning through hands-on practice.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}

/**
 * Get activity data for demonstration
 * In production, this would fetch from your H5P server
 */
function getActivityData(activityId: string) {
  const activities: Record<string, { content: string }> = {
    'activity-001': {
      content: `
        <div class="activities-container space-y-6">
          <div class="activity-section">
            <h3 class="text-lg font-semibold text-white mb-4">Quiz: Test Your Knowledge</h3>
            <div class="space-y-3">
              <div class="question bg-slate-700 p-4 rounded">
                <p class="text-white font-medium mb-3">What is the primary benefit of hands-on learning?</p>
                <div class="space-y-2">
                  <label class="flex items-center gap-3 cursor-pointer group">
                    <input type="radio" name="q1" value="a" class="w-4 h-4" />
                    <span class="text-slate-300 group-hover:text-slate-100">Retained memory and practical skills</span>
                  </label>
                  <label class="flex items-center gap-3 cursor-pointer group">
                    <input type="radio" name="q1" value="b" class="w-4 h-4" />
                    <span class="text-slate-300 group-hover:text-slate-100">It's faster than theoretical learning</span>
                  </label>
                  <label class="flex items-center gap-3 cursor-pointer group">
                    <input type="radio" name="q1" value="c" class="w-4 h-4" />
                    <span class="text-slate-300 group-hover:text-slate-100">No reading required</span>
                  </label>
                </div>
              </div>
              <button class="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded transition">
                Check Answer
              </button>
            </div>
          </div>

          <div class="activity-section">
            <h3 class="text-lg font-semibold text-white mb-4">Drag and Drop: Match Concepts</h3>
            <div class="grid grid-cols-2 gap-4">
              <div class="bg-slate-700 p-4 rounded">
                <h4 class="text-sm font-semibold text-slate-300 mb-2">Terms</h4>
                <div class="space-y-2">
                  <div class="bg-blue-600 p-2 rounded text-white cursor-move text-sm">Interactive Learning</div>
                  <div class="bg-blue-600 p-2 rounded text-white cursor-move text-sm">Creative Expression</div>
                  <div class="bg-blue-600 p-2 rounded text-white cursor-move text-sm">Theory Foundation</div>
                </div>
              </div>
              <div class="bg-slate-700 p-4 rounded">
                <h4 class="text-sm font-semibold text-slate-300 mb-2">Definitions</h4>
                <div class="space-y-2">
                  <div class="bg-slate-600 p-2 rounded text-slate-300 text-sm">Understanding principles</div>
                  <div class="bg-slate-600 p-2 rounded text-slate-300 text-sm">Hands-on experimentation</div>
                  <div class="bg-slate-600 p-2 rounded text-slate-300 text-sm">Applying knowledge artistically</div>
                </div>
              </div>
            </div>
          </div>

          <div class="activity-section">
            <h3 class="text-lg font-semibold text-white mb-4">Reflection: Share Your Learning</h3>
            <textarea 
              class="w-full bg-slate-700 border border-slate-600 text-white p-3 rounded text-sm"
              rows="4"
              placeholder="What did you learn? How will you apply it?"
            />
            <button class="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded transition">
              Submit Response
            </button>
          </div>
        </div>
      `
    }
  };

  return activities[activityId] || {
    content: `
      <div class="text-center py-12">
        <p class="text-slate-400">Activity not found: ${activityId}</p>
      </div>
    `
  };
}

/**
 * Setup activity tracking and completion detection
 */
function setupActivityTracking(
  container: HTMLElement,
  onComplete: () => void
) {
  // Track submit button clicks
  const submitButtons = container.querySelectorAll('button[type="submit"]') as NodeListOf<HTMLButtonElement>;
  
  submitButtons.forEach(button => {
    button.addEventListener('click', () => {
      onComplete();
    });
  });

  // Alternative: Track radio/checkbox answers
  const inputs = container.querySelectorAll('input[type="radio"], input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
  
  let completedQuestions = 0;
  inputs.forEach(input => {
    input.addEventListener('change', () => {
      const questionsContainer = container.querySelectorAll('.question');
      completedQuestions = Array.from(questionsContainer).filter(q => {
        const hasSelection = q.querySelector('input:checked');
        return hasSelection !== null;
      }).length;

      if (completedQuestions === questionsContainer.length) {
        onComplete();
      }
    });
  });
}
