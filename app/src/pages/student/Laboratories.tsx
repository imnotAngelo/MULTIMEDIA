import { useState, useEffect, useRef } from 'react';
import {
  Layers,
  Zap,
  FileText,
  Palette,
  Trophy,
  ChevronRight,
  Play,
  CheckCircle,
  Lock,
  BookOpen,
  Loader2,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { H5PActivity } from '@/components/laboratories/H5PActivity';
import { ThreeJsLearning } from '@/components/laboratories/ThreeJsLearning';
import { Building3DSimulator } from '@/components/laboratories/Building3DSimulator';
import { authFetch } from '@/lib/authFetch';
import { updatePhaseProgress } from '@/lib/laboratoryProgressService';
import { LaboratorySubmissionForm } from '@/components/LaboratorySubmissionForm';

interface LabModule {
  id: string;
  unitId: string;
  unitTitle: string;
  title: string;
  description: string;
  phase: 'theory' | 'interactive' | 'activity' | 'creative';
  status: 'locked' | 'available' | 'completed';
  content: {
    overview?: string;
    canvaEmbed?: string;
    threejsScene?: string;
    h5pActivityId?: string;
    designPrompt?: string;
    pdfUrl?: string;
    slideCount?: number;
  };
  xpReward: number;
  completionTime: string;
}

interface Lesson {
  id: string;
  unitId: string;
  title: string;
  content: string;
  createdAt: string;
  slideCount?: number;
  slides?: any[];
}

const PHASE_COLORS = {
  theory: 'from-blue-600 to-blue-400',
  interactive: 'from-purple-600 to-purple-400',
  activity: 'from-green-600 to-green-400',
  creative: 'from-pink-600 to-pink-400'
};

const PHASE_ICONS = {
  theory: <BookOpen className="w-5 h-5" />,
  interactive: <Layers className="w-5 h-5" />,
  activity: <Zap className="w-5 h-5" />,
  creative: <Palette className="w-5 h-5" />
};

// Transform instructor-uploaded lessons into lab modules
function transformLessonsToModules(lessons: Lesson[], unitTitle: string, unitId: string): LabModule[] {
  return lessons.flatMap((lesson, index) => [
    {
      id: `${lesson.id}-theory`,
      unitId,
      unitTitle,
      title: `${lesson.title} - Theory`,
      description: 'Learn the core concepts with visual presentations',
      phase: 'theory' as const,
      status: index === 0 ? 'available' : 'locked' as const,
      content: {
        overview: lesson.content,
        pdfUrl: lesson.content,
        slideCount: lesson.slideCount,
        designPrompt: 'Review the lesson material'
      },
      xpReward: 50,
      completionTime: '15 min'
    },
    {
      id: `${lesson.id}-interactive`,
      unitId,
      unitTitle,
      title: `${lesson.title} - 3D Exploration`,
      description: 'Explore concepts in 3D with interactive learning',
      phase: 'interactive' as const,
      status: 'locked' as const,
      content: {
        threejsScene: 'geometry-explorer',
        designPrompt: 'Interact with 3D models to understand the concepts'
      },
      xpReward: 100,
      completionTime: '20 min'
    },
    {
      id: `${lesson.id}-activity`,
      unitId,
      unitTitle,
      title: `${lesson.title} - Hands-On Activity`,
      description: 'Complete interactive exercises to reinforce learning',
      phase: 'activity' as const,
      status: 'locked' as const,
      content: {
        h5pActivityId: `activity-${lesson.id}`,
        designPrompt: 'Test your knowledge with interactive exercises'
      },
      xpReward: 150,
      completionTime: '25 min'
    },
    {
      id: `${lesson.id}-creative`,
      unitId,
      unitTitle,
      title: `${lesson.title} - Creative Project`,
      description: 'Apply your knowledge with a creative design project',
      phase: 'creative' as const,
      status: 'locked' as const,
      content: {
        designPrompt: `Create a visual representation of what you learned in "${lesson.title}"`
      },
      xpReward: 200,
      completionTime: '30 min'
    }
  ]);
}

interface PhaseCardProps {
  module: LabModule;
  isActive: boolean;
  onClick: () => void;
}

function PhaseCard({ module, isActive, onClick }: PhaseCardProps) {
  const isLocked = module.status === 'locked';
  const isCompleted = module.status === 'completed';

  return (
    <button
      onClick={onClick}
      disabled={isLocked}
      className={cn(
        'relative overflow-hidden rounded-xl border-2 transition-all duration-300 p-5 text-left',
        isActive
          ? 'border-white bg-slate-800 scale-105 shadow-lg shadow-slate-500'
          : 'border-slate-700 hover:border-slate-600',
        isLocked && 'opacity-60 cursor-not-allowed'
      )}
    >
      {/* Background gradient */}
      <div className={cn(
        'absolute inset-0 bg-gradient-to-br',
        PHASE_COLORS[module.phase],
        'opacity-10'
      )} />

      {/* Content */}
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-700">
              {PHASE_ICONS[module.phase]}
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-sm">{module.title}</h3>
              <p className="text-xs text-slate-400">{module.phase.charAt(0).toUpperCase() + module.phase.slice(1)}</p>
            </div>
          </div>
          {isCompleted && <CheckCircle className="w-5 h-5 text-green-400" />}
          {isLocked && <Lock className="w-5 h-5 text-slate-400" />}
        </div>

        <p className="text-xs text-slate-300 mb-4">{module.description}</p>

        <div className="flex items-center justify-between text-xs">
          <div className="flex gap-3">
            <span className="flex items-center gap-1 text-slate-400">
              <Trophy className="w-3 h-3" /> {module.xpReward} XP
            </span>
            <span className="text-slate-400">{module.completionTime}</span>
          </div>
          {!isLocked && <ChevronRight className="w-4 h-4 text-slate-400" />}
        </div>
      </div>

      {/* Progress indicator */}
      {isCompleted && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-green-500" />
      )}
    </button>
  );
}

// --- localStorage helpers for progress fallback ---
function getLocalProgressKey(): string {
  try {
    const token = localStorage.getItem('access_token');
    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return `lab_progress_${payload.sub || 'unknown'}`;
    }
  } catch {}
  return 'lab_progress_guest';
}
function saveModuleToLocal(moduleId: string): void {
  try {
    const key = getLocalProgressKey();
    const saved: string[] = JSON.parse(localStorage.getItem(key) || '[]');
    if (!saved.includes(moduleId)) saved.push(moduleId);
    localStorage.setItem(key, JSON.stringify(saved));
  } catch {}
}
function getLocalCompletedModules(): Set<string> {
  try {
    const key = getLocalProgressKey();
    const saved: string[] = JSON.parse(localStorage.getItem(key) || '[]');
    return new Set(saved);
  } catch {}
  return new Set();
}
// --------------------------------------------------

export function Laboratories() {
  const [modules, setModules] = useState<LabModule[]>([]);
  const [selectedModule, setSelectedModule] = useState<LabModule | null>(null);
  const [totalXP, setTotalXP] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupedModules, setGroupedModules] = useState<Map<string, LabModule[]>>(new Map());
  const [savingProgress, setSavingProgress] = useState(false);

  // Fetch units and lessons from API
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch units
        const unitsResponse = await authFetch('/units');
        
        console.log('Units API Response:', {
          status: unitsResponse.status,
          ok: unitsResponse.ok,
          contentType: unitsResponse.headers.get('content-type')
        });

        if (!unitsResponse.ok) {
          throw new Error(`API Error: ${unitsResponse.status} ${unitsResponse.statusText}`);
        }

        // Read text first to avoid stream exhaustion
        const text = await unitsResponse.text();
        console.log('Units API Text Response:', text.substring(0, 200));
        
        // Check if response is HTML (error page)
        if (text.trim().startsWith('<!doctype') || text.trim().startsWith('<html')) {
          throw new Error(`API returned HTML error page instead of JSON. The /api/units endpoint may not exist. Response: ${text.substring(0, 150)}`);
        }

        let responseData;
        
        try {
          responseData = JSON.parse(text);
        } catch (parseErr) {
          console.error('Failed to parse API response:', text.substring(0, 200));
          throw new Error(`API returned invalid JSON. Response: ${text.substring(0, 100)}`);
        }

        // Handle wrapped response format from backend: { success: true, data: [...] }
        const units = Array.isArray(responseData) ? responseData : responseData.data || [];

        let allModules: LabModule[] = [];
        const grouped = new Map<string, LabModule[]>();

        // Fetch lessons for each unit
        for (const unit of units) {
          try {
            const lessonsResponse = await authFetch(`/units/${unit.id}/lessons`);
            
            if (!lessonsResponse.ok) {
              console.warn(`Failed to fetch lessons for unit ${unit.id}: ${lessonsResponse.status}`);
              continue;
            }

            // Read text first to avoid stream exhaustion
            const lessonsText = await lessonsResponse.text();
            let lessonsData;
            
            try {
              lessonsData = JSON.parse(lessonsText);
            } catch (parseErr) {
              console.warn(`Failed to parse lessons for unit ${unit.id}:`, parseErr);
              continue;
            }

            // Handle wrapped response format: { success: true, data: [...] }
            const lessons = Array.isArray(lessonsData) ? lessonsData : lessonsData.data || [];

            if (lessons && lessons.length > 0) {
              const unitModules = transformLessonsToModules(lessons, unit.title, unit.id);
              allModules = [...allModules, ...unitModules];
              grouped.set(unit.id, unitModules);
            }
          } catch (unitErr) {
            console.error(`Error loading lessons for unit ${unit.id}:`, unitErr);
            continue;
          }
        }

        // NOW load saved progress BEFORE setting to state
        console.log('📥 Loading saved progress from database...');
        for (const [unitId, unitModules] of grouped) {
          try {
            const progressResponse = await authFetch(`/laboratories/${unitId}/phase-details`);
            if (progressResponse.ok) {
              const phaseProgressList = await progressResponse.json();
              const progressData = phaseProgressList.data || [];

              console.log(`📊 Loaded ${progressData.length} phase records for unit ${unitId}`);

              // Apply saved progress to modules by matching module_id
              progressData.forEach((phase: any) => {
                const moduleIndex = allModules.findIndex(m => m.id === phase.module_id);
                if (moduleIndex !== -1) {
                  console.log(`✅ Applying saved status '${phase.status}' to module ${phase.module_id}`);
                  allModules[moduleIndex].status = phase.status;
                }
              });
            }
          } catch (err) {
            console.warn(`⚠️ Could not load progress for unit ${unitId}`, err);
          }
        }

        // Apply localStorage fallback — restores completed modules when DB tables are missing
        const localCompleted = getLocalCompletedModules();
        if (localCompleted.size > 0) {
          console.log(`💾 Applying ${localCompleted.size} locally-stored completions as fallback`);
          allModules.forEach((m, i) => {
            if (localCompleted.has(m.id)) allModules[i].status = 'completed';
          });
          // Unlock modules that follow completed ones
          allModules.forEach((m, i) => {
            if (i > 0 && allModules[i - 1].status === 'completed' && m.status === 'locked') {
              allModules[i].status = 'available';
            }
          });
        }

        // SET STATE ONCE with all modules AND their saved progress
        setModules(allModules);
        setGroupedModules(grouped);
        
        // Set first available module as selected
        if (allModules.length > 0) {
          const firstAvailable = allModules.find(m => m.status === 'available') || allModules[0];
          setSelectedModule(firstAvailable);
        }

        // Calculate stats
        const completed = allModules.filter(m => m.status === 'completed').length;
        const xp = allModules
          .filter(m => m.status === 'completed')
          .reduce((sum, m) => sum + m.xpReward, 0);

        console.log(`📈 Stats: ${completed} completed, ${xp} XP earned`);
        setCompletedCount(completed);
        setTotalXP(xp);

        setLoading(false);
      } catch (err) {
        console.error('Error loading laboratories:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to load laboratory modules. Please try again later.';
        setError(`${errorMessage}\n\nMake sure the backend server is running on port 3001.`);
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Unlock modules as previous ones are completed
  useEffect(() => {
    if (modules.length === 0) return;

    const updatedModules = modules.map((module, index): LabModule => {
      if (index === 0) return module;
      const previousModule = modules[index - 1];
      if (previousModule.status === 'completed' && module.status === 'locked') {
        return { ...module, status: 'available' as const };
      }
      return module;
    });
    
    setModules(updatedModules);
    
    // Calculate stats
    const completed = updatedModules.filter(m => m.status === 'completed').length;
    const xp = updatedModules
      .filter(m => m.status === 'completed')
      .reduce((sum, m) => sum + m.xpReward, 0);
    
    setCompletedCount(completed);
    setTotalXP(xp);
  }, []);

  // Load saved progress from database and apply to modules
  const loadSavedProgress = async (allModules: LabModule[], grouped: Map<string, LabModule[]>) => {
    try {
      console.log('📥 Loading saved progress from database...');
      
      // For each unit, try to load progress
      for (const [unitId, unitModules] of grouped) {
        try {
          const progressResponse = await authFetch(`/laboratories/${unitId}/phase-details`);
          if (progressResponse.ok) {
            const phaseProgressList = await progressResponse.json();
            const progressData = phaseProgressList.data || [];

            console.log(`📊 Loaded ${progressData.length} phase records for unit ${unitId}`);

            // Apply saved progress to modules by matching module_id
            progressData.forEach((phase: any) => {
              const moduleIndex = allModules.findIndex(m => m.id === phase.module_id);
              if (moduleIndex !== -1) {
                console.log(`✅ Applying saved status '${phase.status}' to module ${phase.module_id}`);
                allModules[moduleIndex].status = phase.status;
              }
            });
          }
        } catch (err) {
          console.warn(`⚠️ Could not load progress for unit ${unitId}`, err);
        }
      }

      setModules([...allModules]);
      setGroupedModules(new Map(grouped));

      // Recalculate stats
      const completed = allModules.filter(m => m.status === 'completed').length;
      const xp = allModules
        .filter(m => m.status === 'completed')
        .reduce((sum, m) => sum + m.xpReward, 0);

      console.log(`📈 Stats: ${completed} completed, ${xp} XP earned`);
      setCompletedCount(completed);
      setTotalXP(xp);
    } catch (err) {
      console.error('❌ Error loading saved progress:', err);
    }
  };

  const handleModuleComplete = async () => {
    if (!selectedModule) return;

    // Check tokens before attempting save
    const accessToken = localStorage.getItem('access_token');
    const refreshToken = localStorage.getItem('refresh_token');
    
    console.log('📋 [COMPLETE CHECK] Tokens before save:', {
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
    });

    if (!accessToken && !refreshToken) {
      console.error('❌ [COMPLETE] No tokens found. User session is invalid.');
      alert(
        'Your session has expired. You need to log in again to save progress.\n\n' +
        'This happens when:\n' +
        '• You haven\'t logged in\n' +
        '• Your session was cleared or expired\n' +
        '• You\'re using a private/incognito window\n\n' +
        'Please refresh the page and log in again.'
      );
      window.location.href = '/auth/login';
      return;
    }

    setSavingProgress(true);
    try {
      // Save progress to database
      const [lessonId, phase] = selectedModule.id.split('-');
      
      console.log('💾 [COMPLETE] Saving progress:', {
        moduleId: selectedModule.id,
        unitId: selectedModule.unitId,
        phase,
      });
      
      const saveResult = await updatePhaseProgress(
        selectedModule.id,
        selectedModule.unitId,
        phase as any,
        {
          lessonId,
          status: 'completed',
          xpEarned: selectedModule.xpReward,
        }
      );

      if (saveResult && saveResult.status === 'completed') {
        console.log(`✅ Progress SAVED to database for module: ${selectedModule.id}`);
        // Also persist locally so it survives refresh even if DB tables are missing
        saveModuleToLocal(selectedModule.id);
        
        // Update UI ONLY after successful database save
        const updatedModules = modules.map((m): LabModule =>
          m.id === selectedModule.id ? { ...m, status: 'completed' as const } : m
        );
        setModules(updatedModules);
        
        // Unlock next module
        const currentIndex = updatedModules.findIndex(m => m.id === selectedModule.id);
        if (currentIndex < updatedModules.length - 1) {
          const nextModule = updatedModules[currentIndex + 1];
          if (nextModule.status === 'locked') {
            (nextModule as any).status = 'available';
            setModules(updatedModules);
          }
          setSelectedModule(nextModule);
        }

        // Update stats
        const completed = updatedModules.filter(m => m.status === 'completed').length;
        const xp = updatedModules
          .filter(m => m.status === 'completed')
          .reduce((sum, m) => sum + m.xpReward, 0);
        
        setCompletedCount(completed);
        setTotalXP(xp);
      } else {
        throw new Error('Save response did not confirm completion');
      }
    } catch (err: any) {
      console.error('❌ Error saving progress to database:', err);
      
      // Check if it's an auth error
      if (err.message?.includes('authentication token') || err.message?.includes('log in')) {
        alert(
          'Your session has expired.\n\n' +
          'Please log in again to continue saving progress.\n\n' +
          'Error: ' + err.message
        );
        window.location.href = '/auth/login';
      } else {
        alert('Failed to save progress. Please try again or contact support.\n\nError: ' + err.message);
      }
    } finally {
      setSavingProgress(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-violet-400 mx-auto mb-4" />
          <p className="text-slate-300">Loading your laboratory modules...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-red-400 mt-1 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-red-300 mb-1">Error Loading Laboratories</h3>
            <p className="text-sm text-red-200 whitespace-pre-wrap">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (modules.length === 0) {
    return (
      <div className="text-center py-12">
        <BookOpen className="w-16 h-16 text-slate-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-slate-300 mb-2">No Laboratory Modules Yet</h3>
        <p className="text-slate-400">Instructors will add laboratory modules for you to explore. Check back soon!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Interactive Laboratories</h1>
          <p className="text-slate-400 mt-2">Learn through theory, hands-on practice, and creative projects</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card className="bg-slate-900/60 border-slate-800 p-4">
            <p className="text-xs text-slate-400 mb-1">Modules Completed</p>
            <p className="text-2xl font-bold text-green-400">{completedCount}/{modules.length}</p>
          </Card>
          <Card className="bg-slate-900/60 border-slate-800 p-4">
            <p className="text-xs text-slate-400 mb-1">Total XP Earned</p>
            <p className="text-2xl font-bold text-violet-400">{totalXP}</p>
          </Card>
          <Card className="bg-slate-900/60 border-slate-800 p-4">
            <p className="text-xs text-slate-400 mb-1">Current Phase</p>
            <p className="text-sm font-semibold text-slate-200 capitalize">{selectedModule?.phase || 'N/A'}</p>
          </Card>
          <Card className="bg-slate-900/60 border-slate-800 p-4">
            <p className="text-xs text-slate-400 mb-1">Progress</p>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-violet-500 to-pink-500 h-2 rounded-full transition-all"
                style={{ width: `${(completedCount / modules.length) * 100}%` }}
              />
            </div>
          </Card>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Learning Path */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-lg font-semibold text-slate-200">Learning Path</h2>
          {modules.map((module) => (
            <PhaseCard
              key={module.id}
              module={module}
              isActive={selectedModule ? selectedModule.id === module.id : false}
              onClick={() => {
                if (module.status !== 'locked') {
                  setSelectedModule(module);
                }
              }}
            />
          ))}
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3">
          {!selectedModule ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-12 text-center">
              <BookOpen className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-300 mb-2">Select a Module</h3>
              <p className="text-slate-400">Choose a learning module from the path to get started</p>
            </div>
          ) : selectedModule.status === 'locked' ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-12 text-center">
              <Lock className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-300 mb-2">Module Locked</h3>
              <p className="text-slate-400">Complete the previous module to unlock this one</p>
            </div>
          ) : selectedModule.phase === 'theory' ? (
            <TheoryPhase module={selectedModule} onComplete={handleModuleComplete} />
          ) : selectedModule.phase === 'interactive' ? (
            <InteractivePhase module={selectedModule} onComplete={handleModuleComplete} />
          ) : selectedModule.phase === 'activity' ? (
            <ActivityPhase module={selectedModule} onComplete={handleModuleComplete} />
          ) : (
            <CreativePhase module={selectedModule} onComplete={handleModuleComplete} />
          )}
        </div>
      </div>
    </div>
  );
}

interface PhaseProps {
  module: LabModule;
  onComplete: () => void;
}

function TheoryPhase({ module, onComplete }: PhaseProps) {
  return (
    <div className="space-y-4">
      <Card className="bg-slate-900/60 border-slate-800 p-4 sm:p-6">
        <div className="mb-4">
          <p className="text-xs text-slate-400 mb-2">{module.unitTitle}</p>
          <h2 className="text-xl sm:text-2xl font-bold text-white">{module.title}</h2>
        </div>
        {/* Instructor Instructions */}
        <div className="mb-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <h4 className="font-semibold text-yellow-300 mb-1">Instructor Instructions</h4>
          <p className="text-xs sm:text-sm text-yellow-200">Review the lesson objectives and ensure students understand the key concepts before proceeding. Provide additional resources or clarification as needed.</p>
        </div>
        {/* PDF/Lesson Content Display */}
        <div className="mb-6 rounded-lg overflow-hidden bg-slate-800 p-4 sm:p-6 min-h-64 sm:min-h-96">
          <div className="prose prose-invert max-w-none">
            <div className="text-slate-300 space-y-4">
              <p className="whitespace-pre-wrap text-sm sm:text-base">{module.content.overview}</p>
              {module.content.slideCount && (
                <p className="text-xs sm:text-sm text-slate-400">
                  📊 <strong>{module.content.slideCount}</strong> slides in this lesson
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="space-y-4 text-slate-300">
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <p className="text-xs sm:text-sm text-blue-300">
              💡 <strong>Key Concept:</strong> This theory phase introduces fundamental concepts through the lesson material. Take notes and understand the core principles before moving to the interactive phase.
            </p>
          </div>
        </div>
      </Card>
      <Button
        onClick={onComplete}
        className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 py-5 sm:py-6 text-sm sm:text-base"
      >
        <CheckCircle className="w-4 h-4 mr-2" />
        Complete Theory Phase - Earn {module.xpReward} XP
      </Button>
      {module.status === 'completed' && (
        <div className="text-center text-xs text-green-400 font-semibold">✓ Progress Saved</div>
      )}
    </div>
  );
}

function InteractivePhase({ module, onComplete }: PhaseProps) {
  const [explored, setExplored] = useState(false);

  return (
    <div className="space-y-4">
      <Card className="bg-slate-900/60 border-slate-800 p-4 sm:p-6">
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">{module.title}</h2>
        {/* Instructor Instructions */}
        <div className="mb-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <h4 className="font-semibold text-yellow-300 mb-1">Instructor Instructions</h4>
          <p className="text-xs sm:text-sm text-yellow-200">Guide students through the 3D building activity. Encourage creativity and provide feedback on their designs. Ensure all required elements are included.</p>
        </div>
        <p className="text-sm sm:text-base text-slate-300 mb-4">
          Design and construct a 3D building on the grid below. Place walls, windows, doors, floors, and a roof
          to simulate real 3D creation. Build at least <strong className="text-violet-400">12 blocks</strong> to complete this phase.
        </p>
        {/* 3D Building Simulator */}
        <Building3DSimulator
          onInteractionComplete={() => setExplored(true)}
        />
        {explored && (
          <div className="mt-4 bg-green-500/10 border border-green-500/30 rounded-lg p-4">
            <p className="text-xs sm:text-sm text-green-300">
              🏗️ <strong>Building complete!</strong> Your 3D structure is ready. Click below to earn your XP.
            </p>
          </div>
        )}
      </Card>
      <Button
        onClick={onComplete}
        disabled={!explored}
        className={cn(
          'w-full py-5 sm:py-6 text-sm sm:text-base',
          explored
            ? 'bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600'
            : 'bg-slate-700 cursor-not-allowed opacity-50'
        )}
      >
        <CheckCircle className="w-4 h-4 mr-2" />
        Complete Interactive Phase - Earn {module.xpReward} XP
      </Button>
      {module.status === 'completed' && (
        <div className="text-center text-xs text-green-400 font-semibold">✓ Progress Saved</div>
      )}
    </div>
  );
}

function ActivityPhase({ module, onComplete }: PhaseProps) {
  return (
    <div className="space-y-4">
      <Card className="bg-slate-900/60 border-slate-800 p-4 sm:p-6">
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">{module.title}</h2>
        {/* Instructor Instructions */}
        <div className="mb-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <h4 className="font-semibold text-yellow-300 mb-1">Instructor Instructions</h4>
          <p className="text-xs sm:text-sm text-yellow-200">Monitor student progress and provide support during the activity. Clarify instructions and help troubleshoot any issues with the interactive exercises.</p>
        </div>
        <p className="text-sm sm:text-base text-slate-300 mb-4">Complete hands-on activities to reinforce your learning. These interactive exercises will test your knowledge.</p>
        {/* H5P Activity */}
        {module.content.h5pActivityId && (
          <H5PActivity
            activityId={module.content.h5pActivityId}
            onComplete={onComplete}
          />
        )}
      </Card>
      <Button
        onClick={onComplete}
        className="w-full bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 py-5 sm:py-6 text-sm sm:text-base"
      >
        <Trophy className="w-4 h-4 mr-2" />
        Complete Activity - Earn {module.xpReward} XP
      </Button>
      {module.status === 'completed' && (
        <div className="text-center text-xs text-green-400 font-semibold">✓ Progress Saved</div>
      )}
    </div>
  );
}

function CreativePhase({ module, onComplete }: PhaseProps) {
  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-r from-pink-600/15 to-purple-600/15 border border-pink-500/30 p-4 sm:p-6">
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">{module.title}</h2>
        {/* Instructor Instructions */}
        <div className="mb-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <h4 className="font-semibold text-yellow-300 mb-1">Instructor Instructions</h4>
          <p className="text-xs sm:text-sm text-yellow-200">Explain the creative project requirements and provide examples. Encourage students to express their understanding creatively. Review submissions and give constructive feedback.</p>
        </div>
        <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4 sm:p-6">
          <LaboratorySubmissionForm
            laboratoryId={module.unitId}
            phaseId={4}
            onSuccess={() => onComplete()}
          />
        </div>
      </Card>
      {module.status === 'completed' && (
        <div className="text-center text-xs text-green-400 font-semibold">✓ Progress Saved</div>
      )}
    </div>
  );
}
