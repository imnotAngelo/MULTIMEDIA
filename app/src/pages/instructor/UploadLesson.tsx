import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Upload, FileUp, AlertCircle, CheckCircle2, Loader, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authFetch } from '@/lib/authFetch';
import { API_BASE_URL } from '@/lib/apiConfig';
import { useAuthStore } from '@/stores/authStore';
import { getNextLessonTitle } from '@/lib/lessonNaming';

interface UploadLessonProps {
  unitId: string;
  onSuccess?: (lesson: any) => void;
}

export function UploadLesson({ unitId, onSuccess }: UploadLessonProps) {
  const { user } = useAuthStore();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [graphicUrl, setGraphicUrl] = useState('');
  const [graphicFile, setGraphicFile] = useState<File | null>(null);
  const [targetSections, setTargetSections] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [autoSuggestedTitle, setAutoSuggestedTitle] = useState('Lesson I');

  useEffect(() => {
    let isMounted = true;
    const fetchUnitLessons = async () => {
      if (!unitId) return;
      try {
        const res = await authFetch(`/units/${unitId}/lessons`);
        const data = await res.json();
        if (isMounted && data.success && Array.isArray(data.data)) {
          const autoTitle = getNextLessonTitle(data.data);
          setAutoSuggestedTitle(autoTitle);
          setTitle((prev) => {
            if (!prev || /^Lesson\s+[IVXLCDM\d]+/i.test(prev.trim())) {
              return autoTitle;
            }
            return prev;
          });
        }
      } catch {
        if (isMounted) {
          setAutoSuggestedTitle('Lesson I');
          setTitle((prev) => prev || 'Lesson I');
        }
      }
    };

    fetchUnitLessons();
    return () => {
      isMounted = false;
    };
  }, [unitId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        setError('Only PDF files are supported');
        setFile(null);
        return;
      }
      if (selectedFile.size > 50 * 1024 * 1024) {
        setError('File size must be less than 50MB');
        setFile(null);
        return;
      }
      setError('');
      setFile(selectedFile);
    }
  };

  const handleGraphicFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.type.startsWith('image/')) {
        setError('Graphic must be an image file');
        setGraphicFile(null);
        return;
      }
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('Graphic file size must be less than 10MB');
        setGraphicFile(null);
        return;
      }
      setError('');
      setGraphicFile(selectedFile);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const titleToSubmit = title.trim() || autoSuggestedTitle || 'Lesson I';

    if (!file) {
      setError('Please select a PDF file to upload');
      return;
    }

    // Validate unitId is a UUID before submitting
    const uuidv4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidv4Regex.test(unitId)) {
      setError(`Invalid unit ID format. Expected UUID, got: "${unitId}"`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', titleToSubmit);
      if (videoUrl.trim()) formData.append('videoUrl', videoUrl.trim());
      if (graphicUrl.trim()) formData.append('graphicUrl', graphicUrl.trim());
      if (graphicFile) formData.append('graphicFile', graphicFile);
      formData.append('unitId', unitId);
      if (targetSections.length > 0) {
        formData.append('targetSections', JSON.stringify(targetSections));
      }

      const uploadUrl = `${API_BASE_URL}/lessons/upload-pdf`;
      
      console.log('🚀 [UPLOAD_START_UPLOADLESSON] About to upload to:', uploadUrl);
      console.log('📝 [FORM_DATA_UPLOADLESSON]', {
        title,
        file: file.name,
        fileSize: file.size,
        unitId
      });

      const response = await authFetch(uploadUrl, {
        method: 'POST',
        body: formData,
      });

      console.log('✅ [RESPONSE_UPLOADLESSON] Status:', response.status);

      const data = await response.json();

      if (!response.ok) {
        console.error('❌ [ERROR_RESPONSE]', data);
        throw new Error(data.error?.message || 'Upload failed');
      }

      // Unwrap nested response structure
      const responseData = data.data || data;
      
      console.log('📡 Backend Response:', data);
      console.log('📋 Response Data:', responseData);
      console.log('📄 PDF kept as uploaded:', responseData.pdfUrl || responseData.lesson?.pdfUrl);
      console.log('📊 Slide count:', responseData.slideCount);

      // Create lesson object with the response from backend
      const newLesson = {
        id: responseData.lessonId || uuidv4(),
        unitId,
        title,
        content: responseData.content || responseData.lesson?.content || responseData.summary || '',
        createdAt: new Date().toISOString(),
        slideCount: responseData.slideCount || 0,
        slides: responseData.slides || [],
        pdfUrl: responseData.pdfUrl || responseData.lesson?.pdfUrl || '',
        videoUrl: videoUrl.trim() || '',
        graphicUrl: graphicUrl.trim() || '',
        graphicFileName: graphicFile?.name || '',
      };
      
      console.log('✅ New Lesson Object:', newLesson);
      console.log('📸 Slides array length:', newLesson.slides.length);

      setSuccess(true);
      setFile(null);
      setTitle('');
      setVideoUrl('');
      setGraphicUrl('');
      setGraphicFile(null);

      setTimeout(() => {
        setSuccess(false);
        onSuccess?.(newLesson);
      }, 2000);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
    <Card className="p-6 bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 shadow-sm">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Upload Lesson Material</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Upload the original PDF file and keep it unchanged. No slide conversion or document rewriting will happen.
          </p>
        </div>

        {/* Title Input */}
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="title" className="text-slate-700 dark:text-slate-300 font-medium">
              Lesson Title *
            </Label>
            <span className="text-xs text-violet-600 dark:text-violet-400 font-medium">Auto-named sequentially</span>
          </div>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={autoSuggestedTitle || 'e.g., Lesson I'}
            className="mt-2 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        </div>

        {/* Teaching Sections Selection */}
        {user?.teaching_sections && user.teaching_sections.length > 0 && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-200">Assign to Sections</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Select which sections can access this lesson (leave unchecked for all sections)</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const allSelected = user.teaching_sections!.length > 0 && user.teaching_sections!.every(s => targetSections.includes(s));
                  if (allSelected) {
                    setTargetSections([]);
                  } else {
                    setTargetSections([...user.teaching_sections!]);
                  }
                }}
                className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 hover:underline transition-colors shrink-0"
              >
                {user.teaching_sections.every(s => targetSections.includes(s)) ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-violet-600 dark:text-violet-400">
                <input
                  type="checkbox"
                  checked={user.teaching_sections.length > 0 && user.teaching_sections.every(s => targetSections.includes(s))}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setTargetSections([...user.teaching_sections!]);
                    } else {
                      setTargetSections([]);
                    }
                  }}
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-violet-600 focus:ring-violet-500 cursor-pointer"
                />
                <span className="text-xs font-semibold">Select All ({user.teaching_sections.length})</span>
              </label>
              {user.teaching_sections.map((section) => (
                <label key={section} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={targetSections.includes(section)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setTargetSections([...targetSections, section]);
                      } else {
                        setTargetSections(targetSections.filter(s => s !== section));
                      }
                    }}
                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-violet-600 focus:ring-violet-500 cursor-pointer"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">{section}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Class Media Section */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/40 p-4 space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-200">Class media (optional)</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Add a video or supporting graphic to enrich the lesson for class discussion.</p>
          </div>

          <div>
            <Label htmlFor="videoUrl" className="text-slate-700 dark:text-slate-300">
              Video URL
            </Label>
            <Input
              id="videoUrl"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://example.com/video.mp4 or YouTube/Vimeo link"
              className="mt-2 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>

          <div>
            <Label htmlFor="graphicUrl" className="text-slate-700 dark:text-slate-300">
              Graphic URL
            </Label>
            <Input
              id="graphicUrl"
              value={graphicUrl}
              onChange={(e) => setGraphicUrl(e.target.value)}
              placeholder="https://example.com/diagram.png"
              className="mt-2 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>

          <div>
            <Label htmlFor="graphicFile" className="text-slate-700 dark:text-slate-300 block mb-2">
              Upload Graphic
            </Label>
            <label className="flex items-center justify-center p-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg hover:border-violet-500 hover:bg-slate-100 dark:hover:bg-slate-900/30 transition-colors cursor-pointer">
              <div className="text-center">
                <Upload className="w-6 h-6 text-slate-400 dark:text-slate-500 mx-auto mb-2" />
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {graphicFile ? graphicFile.name : 'Choose an image for class visuals'}
                </p>
              </div>
              <input
                id="graphicFile"
                type="file"
                accept="image/*"
                onChange={handleGraphicFileChange}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* File Upload */}
        <div>
          <Label className="text-slate-700 dark:text-slate-300 block mb-3 font-medium">
            PDF File *
          </Label>
          <div className="flex gap-3">
            <label className="flex-1 cursor-pointer">
              <div className="flex items-center justify-center p-6 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg hover:border-violet-500 hover:bg-slate-100 dark:hover:bg-slate-900/30 transition-colors">
                <div className="text-center">
                  <Upload className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto mb-2" />
                  <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                    {file ? file.name : 'Click to upload or drag and drop'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">PDF (max 50MB)</p>
                </div>
              </div>
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="flex gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-600 dark:text-red-200">{error}</p>
          </div>
        )}

        {success && (
          <div className="flex gap-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <p className="text-sm text-emerald-700 dark:text-emerald-200">Lesson uploaded successfully! The PDF was kept in its original format.</p>
          </div>
        )}

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={loading || !file}
          className="w-full bg-violet-600 hover:bg-violet-700 text-white"
        >
          {loading ? (
            <>
              <Loader className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <FileUp className="w-4 h-4 mr-2" />
              Upload & Generate Slides
            </>
          )}
        </Button>
      </form>
    </Card>
    </div>
  );
}
