import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Plus, Upload, Trash2, Eye, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { UploadLesson } from './UploadLesson';
import { notificationService } from '@/services/notificationService';

interface Unit {
  id: string;
  title: string;
  description: string;
  lessonCount: number;
  createdAt: string;
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

export function InstructorModules() {
  const navigate = useNavigate();
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadUnits();
  }, []);

  const loadUnits = () => {
    try {
      setLoading(true);
      const savedUnits = localStorage.getItem('instructor_units');
      if (savedUnits) {
        setUnits(JSON.parse(savedUnits));
      }
      setError('');
    } catch (err) {
      setError('Failed to load units');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadLessons = (unitId: string) => {
    try {
      const savedLessons = localStorage.getItem(`lessons_${unitId}`);
      if (savedLessons) {
        setLessons(JSON.parse(savedLessons));
      } else {
        setLessons([]);
      }
    } catch (err) {
      console.error('Failed to load lessons:', err);
      setLessons([]);
    }
  };

  const handleUnitSelect = (unit: Unit) => {
    setSelectedUnit(unit);
    loadLessons(unit.id);
    setShowUpload(false);
  };

  const handleUploadSuccess = (newLesson: Lesson) => {
    if (selectedUnit) {
      const updatedLessons = [...lessons, newLesson];
      setLessons(updatedLessons);
      localStorage.setItem(`lessons_${selectedUnit.id}`, JSON.stringify(updatedLessons));
      
      // Update unit lesson count
      const updatedUnits = units.map(unit =>
        unit.id === selectedUnit.id
          ? { ...unit, lessonCount: unit.lessonCount + 1 }
          : unit
      );
      setUnits(updatedUnits);
      localStorage.setItem('instructor_units', JSON.stringify(updatedUnits));
      setSelectedUnit(updatedUnits.find(u => u.id === selectedUnit.id) || null);
      setShowUpload(false);
      
      // Add notification
      notificationService.notifyLessonAdded(newLesson.title, selectedUnit.title);
    }
  };

  const handleDeleteLesson = (lessonId: string) => {
    if (!confirm('Are you sure you want to delete this lesson?')) return;

    if (selectedUnit) {
      const updatedLessons = lessons.filter(lesson => lesson.id !== lessonId);
      setLessons(updatedLessons);
      localStorage.setItem(`lessons_${selectedUnit.id}`, JSON.stringify(updatedLessons));

      // Update unit lesson count
      const updatedUnits = units.map(unit =>
        unit.id === selectedUnit.id
          ? { ...unit, lessonCount: Math.max(0, unit.lessonCount - 1) }
          : unit
      );
      setUnits(updatedUnits);
      localStorage.setItem('instructor_units', JSON.stringify(updatedUnits));
      setSelectedUnit(updatedUnits.find(u => u.id === selectedUnit.id) || null);
    }
  };

  const handleViewLesson = (lesson: Lesson) => {
    if (selectedUnit) {
      navigate(`/instructor/lesson/${selectedUnit.id}/${lesson.id}`);
    }
  };

  const handlePrevSlide = () => {
    // No longer needed - moved to ViewLesson component
  };

  const handleNextSlide = () => {
    // No longer needed - moved to ViewLesson component
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-slate-400">Loading units...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Upload Lessons</h1>
        <p className="text-slate-400">Upload PDF lessons to your units</p>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Units List */}
        <div className="lg:col-span-1">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <h2 className="text-lg font-semibold text-slate-200 mb-4">Your Units</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {units.length === 0 ? (
                <div className="text-center p-4">
                  <BookOpen className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No units yet</p>
                  <p className="text-xs text-slate-600 mt-1">Create units in Units Management</p>
                </div>
              ) : (
                units.map(unit => (
                  <button
                    key={unit.id}
                    onClick={() => handleUnitSelect(unit)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selectedUnit?.id === unit.id
                        ? 'bg-violet-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <div className="font-medium text-sm">{unit.title}</div>
                    <div className="text-xs opacity-75 mt-1">
                      {unit.lessonCount} lesson{unit.lessonCount !== 1 ? 's' : ''}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3 space-y-6">
          {selectedUnit ? (
            <>
              {showUpload ? (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <button
                      onClick={() => setShowUpload(false)}
                      className="text-violet-400 hover:text-violet-300 text-sm font-medium"
                    >
                      ← Back to Lessons
                    </button>
                  </div>
                  <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
                    <h2 className="text-xl font-semibold text-white mb-1">Upload Lesson to {selectedUnit.title}</h2>
                    <p className="text-slate-400 mb-6">Upload a PDF file to generate presentation slides</p>
                    <UploadLesson
                      unitId={selectedUnit.id}
                      onSuccess={handleUploadSuccess}
                    />
                  </div>
                </div>
              ) : (
                <>
                  {/* Unit Header */}
                  <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
                    <h2 className="text-2xl font-semibold text-white mb-2">
                      {selectedUnit.title}
                    </h2>
                    <p className="text-slate-400 mb-4">{selectedUnit.description || 'No description'}</p>
                    <Button
                      onClick={() => setShowUpload(true)}
                      className="bg-violet-600 hover:bg-violet-700 text-white"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload PDF Lesson
                    </Button>
                  </div>

                  {/* Lessons List */}
                  <div>
                    <h3 className="text-lg font-semibold text-slate-200 mb-4">
                      Lessons ({lessons.length})
                    </h3>
                    {lessons.length === 0 ? (
                      <Card className="p-8 text-center bg-slate-900/60 border-slate-800">
                        <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                        <p className="text-slate-400 mb-4">No lessons in this unit yet</p>
                        <Button
                          onClick={() => setShowUpload(true)}
                          className="bg-violet-600 hover:bg-violet-700 text-white"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Upload First Lesson
                        </Button>
                      </Card>
                    ) : (
                      <div className="space-y-3">
                        {lessons.map(lesson => (
                          <Card
                            key={lesson.id}
                            className="p-4 bg-slate-900/60 border-slate-800 hover:border-slate-700 transition-colors"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="font-semibold text-slate-200 mb-1">
                                  {lesson.title}
                                </h4>
                                <p className="text-sm text-slate-500 mb-2">
                                  {lesson.slideCount ? `${lesson.slideCount} slides • ` : ''}
                                  Created {new Date(lesson.createdAt).toLocaleDateString()}
                                </p>
                                <p className="text-sm text-slate-400 line-clamp-2">
                                  {lesson.content || 'No description available'}
                                </p>
                              </div>
                              <div className="flex gap-2 ml-4">
                                <button
                                  onClick={() => handleViewLesson(lesson)}
                                  title="View lesson"
                                  className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-blue-400"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteLesson(lesson.id)}
                                  title="Delete lesson"
                                  className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-red-400 hover:text-red-300"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          ) : (
            <Card className="p-12 text-center bg-slate-900/60 border-slate-800">
              <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">Select a unit to manage lessons</p>
              {units.length === 0 && (
                <p className="text-slate-500 text-sm mt-2">Create a unit in Units Management first</p>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
