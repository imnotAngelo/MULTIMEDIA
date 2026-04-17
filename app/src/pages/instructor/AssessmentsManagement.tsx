import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { authFetch } from '@/lib/authFetch';
import { Button } from '@/components/ui/button';
import {
  Plus,
  FileText,
  ClipboardList,
  Beaker,
  Edit2,
  Trash2,
  ChevronDown,
  Calendar,
  Users,
  RefreshCw,
  Loader2,
  Layers,
  CheckCircle2,
  Clock,
} from 'lucide-react';

interface Assessment {
  id: string;
  title: string;
  description: string;
  type: 'assignment' | 'quiz' | 'laboratory';
  unitId: string;
  unitName: string;
  dueDate: string;
  totalPoints: number;
  submissions: number;
  graded: number;
  createdAt: string;
  updatedAt: string;
}

interface AssessmentStats {
  totalAssessments: number;
  totalAssignments: number;
  totalQuizzes: number;
  totalLaboratories: number;
  totalSubmissions: number;
  gradedSubmissions: number;
  pendingGrading: number;
}

export function InstructorAssessments() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [stats, setStats] = useState<AssessmentStats>({
    totalAssessments: 0,
    totalAssignments: 0,
    totalQuizzes: 0,
    totalLaboratories: 0,
    totalSubmissions: 0,
    gradedSubmissions: 0,
    pendingGrading: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'assignment' | 'quiz' | 'laboratory'>('assignment');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleTokenExpiration = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('auth-storage');
    navigate('/login');
  };

  useEffect(() => {
    // Check if user has valid token before loading
    const token = localStorage.getItem('access_token');
    if (!token) {
      setError('Not logged in. Please log in to view assessments.');
      setLoading(false);
      return;
    }
    loadAssessments();
  }, []);

  const loadAssessments = async () => {
    try {
      setLoading(true);

      const response = await authFetch('http://localhost:3001/api/assessments/instructor/all');

      if (!response.ok) {
        const errorText = await response.text();

        if (response.status === 401) {
          handleTokenExpiration();
          return;
        }

        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success && Array.isArray(data.data)) {
        setAssessments(data.data);
        calculateStats(data.data);
        setError('');
      } else {
        setAssessments([]);
      }
    } catch (error) {
      setAssessments([]);
      setError('Failed to load assessments: ' + String(error));
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (assessmentList: Assessment[]) => {
    const stats: AssessmentStats = {
      totalAssessments: assessmentList.length,
      totalAssignments: assessmentList.filter(a => a.type === 'assignment').length,
      totalQuizzes: assessmentList.filter(a => a.type === 'quiz').length,
      totalLaboratories: assessmentList.filter(a => a.type === 'laboratory').length,
      totalSubmissions: assessmentList.reduce((sum, a) => sum + a.submissions, 0),
      gradedSubmissions: assessmentList.reduce((sum, a) => sum + a.graded, 0),
      pendingGrading: assessmentList.reduce((sum, a) => sum + (a.submissions - a.graded), 0),
    };

    setStats(stats);
  };

  const handleCreateAssessment = () => {
    // Navigate to create assessment form (route to be implemented)
    navigate('/instructor/assessments/create');
  };

  const handleEditAssessment = (id: string) => {
    navigate(`/instructor/assessments/${id}/edit`);
  };

  const handleDeleteAssessment = async (id: string) => {
    if (confirm('Are you sure you want to delete this assessment?')) {
      try {
        const response = await authFetch(`http://localhost:3001/api/assessments/${id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.status === 401) {
          handleTokenExpiration();
          return;
        }

        if (!response.ok) {
          throw new Error(`Delete failed with status ${response.status}`);
        }

        const data = await response.json();
        if (data.success) {
          setAssessments(assessments.filter(a => a.id !== id));
          calculateStats(assessments.filter(a => a.id !== id));
        } else {
          alert('Failed to delete assessment: ' + (data.message || 'Unknown error'));
        }
      } catch (error) {
        alert('Error deleting assessment: ' + String(error));
      }
    }
  };

  const handleViewSubmissions = (id: string) => {
    navigate(`/instructor/assessments/${id}/submissions`);
  };

  const getAssessmentIcon = (type: string) => {
    switch (type) {
      case 'assignment':
        return <FileText className="w-5 h-5" />;
      case 'quiz':
        return <ClipboardList className="w-5 h-5" />;
      case 'laboratory':
        return <Beaker className="w-5 h-5" />;
      default:
        return <FileText className="w-5 h-5" />;
    }
  };

  const getAssessmentColor = (type: string) => {
    switch (type) {
      case 'assignment':
        return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
      case 'quiz':
        return 'bg-orange-500/10 border-orange-500/30 text-orange-400';
      case 'laboratory':
        return 'bg-purple-500/10 border-purple-500/30 text-purple-400';
      default:
        return 'bg-slate-500/10 border-slate-500/30 text-slate-400';
    }
  };

  const filteredAssessments = assessments.filter(a => a.type === filter);

  const getDaysUntilDue = (dueDate: string) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Assessment Management</h1>
          <p className="text-slate-400 mt-1 text-sm">Create and manage student assessments</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={loadAssessments}
            variant="outline"
            className="border-slate-700 text-slate-300 hover:bg-slate-800/50"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={handleCreateAssessment}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Assessment
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
          {error.includes('expired') && (
            <div className="mt-3 flex gap-2">
              <Button
                onClick={loadAssessments}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm"
              >
                Retry
              </Button>
              <Button
                onClick={() => {
                  localStorage.removeItem('access_token');
                  localStorage.removeItem('refresh_token');
                  localStorage.removeItem('auth-storage');
                  navigate('/login');
                }}
                className="bg-slate-700 hover:bg-slate-600 text-white text-sm"
              >
                Log in Again
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="group bg-slate-900/60 border border-slate-800/60 rounded-xl p-5 hover:border-violet-500/30 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <Layers className="w-4.5 h-4.5 text-violet-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">{stats.totalAssessments}</div>
          <p className="text-slate-500 text-xs mt-1">Total Assessments</p>
        </div>
        <div className="group bg-slate-900/60 border border-slate-800/60 rounded-xl p-5 hover:border-emerald-500/30 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Users className="w-4.5 h-4.5 text-emerald-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">{stats.totalSubmissions}</div>
          <p className="text-slate-500 text-xs mt-1">Total Submissions</p>
        </div>
        <div className="group bg-slate-900/60 border border-slate-800/60 rounded-xl p-5 hover:border-blue-500/30 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-4.5 h-4.5 text-blue-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">{stats.gradedSubmissions}</div>
          <p className="text-slate-500 text-xs mt-1">Graded</p>
        </div>
        <div className="group bg-slate-900/60 border border-slate-800/60 rounded-xl p-5 hover:border-amber-500/30 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Clock className="w-4.5 h-4.5 text-amber-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">{stats.pendingGrading}</div>
          <p className="text-slate-500 text-xs mt-1">Pending Grading</p>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter('assignment')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            filter === 'assignment'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <FileText className="w-4 h-4" />
          Assignments
        </button>
        <button
          onClick={() => setFilter('quiz')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            filter === 'quiz'
              ? 'bg-orange-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          Quizzes
        </button>
        <button
          onClick={() => setFilter('laboratory')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            filter === 'laboratory'
              ? 'bg-purple-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <Beaker className="w-4 h-4" />
          Laboratories
        </button>
      </div>

      {/* Assessments List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
          <p className="text-slate-500 text-sm">Loading assessments...</p>
        </div>
      ) : filteredAssessments.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/60 flex items-center justify-center mx-auto mb-4">
            <ClipboardList className="w-7 h-7 text-slate-500" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">No Assessments Yet</h2>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Create your first assessment to get started with student evaluations.
          </p>
          <Button
            onClick={handleCreateAssessment}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Assessment
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAssessments.map(assessment => {
            const daysUntil = getDaysUntilDue(assessment.dueDate);
            const isOverdue = daysUntil < 0;
            const gradingPercentage = Math.round((assessment.graded / assessment.submissions) * 100) || 0;

            return (
              <div
                key={assessment.id}
                className="bg-gradient-to-r from-slate-900/60 to-slate-900/30 border border-slate-800 rounded-lg overflow-hidden"
              >
                {/* Main Assessment Row */}
                <button
                  onClick={() => setExpandedId(expandedId === assessment.id ? null : assessment.id)}
                  className="w-full p-6 text-left hover:bg-slate-900/50 transition-colors flex items-start justify-between gap-4"
                >
                  {/* Left Section */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`p-2 rounded-lg border ${getAssessmentColor(assessment.type)}`}>
                        {getAssessmentIcon(assessment.type)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-white text-lg line-clamp-1">
                          {assessment.title}
                        </h3>
                        <p className="text-slate-400 text-sm">{assessment.unitName}</p>
                      </div>
                    </div>
                    <p className="text-slate-400 text-sm line-clamp-1 ml-11">
                      {assessment.description}
                    </p>
                  </div>

                  {/* Right Section */}
                  <div className="flex items-center gap-8 ml-4 flex-shrink-0">
                    {/* Submissions Progress */}
                    <div className="text-right min-w-fit">
                      <p className="text-xs text-slate-500 mb-1">Submissions</p>
                      <p className="text-lg font-bold text-emerald-400">
                        {assessment.graded}/{assessment.submissions}
                      </p>
                      <div className="w-24 h-1 bg-slate-800 rounded-full mt-1 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 transition-all"
                          style={{ width: `${gradingPercentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Due Date */}
                    <div className="text-right min-w-fit">
                      <p className="text-xs text-slate-500 mb-1">Due</p>
                      <p
                        className={`text-sm font-medium ${
                          isOverdue
                            ? 'text-red-400'
                            : daysUntil <= 3
                              ? 'text-yellow-400'
                              : 'text-slate-300'
                        }`}
                      >
                        {isOverdue
                          ? `${Math.abs(daysUntil)}d ago`
                          : `${daysUntil}d left`}
                      </p>
                    </div>

                    {/* Toggle Icon */}
                    <ChevronDown
                      className={`w-5 h-5 text-slate-500 transition-transform ${
                        expandedId === assessment.id ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </button>

                {/* Expanded Details */}
                {expandedId === assessment.id && (
                  <div className="border-t border-slate-800 bg-slate-900/30 p-6 space-y-4">
                    {/* Assessment Details Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="bg-slate-800/30 rounded-lg p-3">
                        <p className="text-xs text-slate-500 mb-1">Total Points</p>
                        <p className="text-lg font-bold text-white">{assessment.totalPoints}</p>
                      </div>
                      <div className="bg-slate-800/30 rounded-lg p-3">
                        <p className="text-xs text-slate-500 mb-1">Submissions</p>
                        <p className="text-lg font-bold text-blue-400">{assessment.submissions}</p>
                      </div>
                      <div className="bg-slate-800/30 rounded-lg p-3">
                        <p className="text-xs text-slate-500 mb-1">Graded</p>
                        <p className="text-lg font-bold text-emerald-400">{assessment.graded}</p>
                      </div>
                      <div className="bg-slate-800/30 rounded-lg p-3">
                        <p className="text-xs text-slate-500 mb-1">Pending</p>
                        <p className="text-lg font-bold text-orange-400">
                          {assessment.submissions - assessment.graded}
                        </p>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => handleViewSubmissions(assessment.id)}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Users className="w-4 h-4" />
                        View Submissions
                      </Button>
                      <Button
                        onClick={() => handleEditAssessment(assessment.id)}
                        variant="outline"
                        className="flex items-center gap-2 border-slate-700 text-slate-300 hover:bg-slate-800/50"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </Button>
                      <Button
                        onClick={() => handleDeleteAssessment(assessment.id)}
                        variant="outline"
                        className="flex items-center gap-2 border-red-700/50 text-red-400 hover:bg-red-900/20"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
