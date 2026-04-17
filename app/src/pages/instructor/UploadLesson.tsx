import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Upload, FileUp, AlertCircle, CheckCircle2, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authFetch } from '@/lib/authFetch';

interface UploadLessonProps {
  unitId: string;
  onSuccess?: (lesson: any) => void;
}

export function UploadLesson({ unitId, onSuccess }: UploadLessonProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file || !title) {
      setError('Please fill in all required fields');
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
      formData.append('title', title);
      formData.append('description', description);
      formData.append('unitId', unitId);

      const uploadUrl = 'http://localhost:3001/api/lessons/upload-pdf';
      
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
      console.log('🎬 Slides from response:', responseData.slides);
      console.log('📊 Slide count:', responseData.slideCount);

      // Create lesson object with the response from backend
      const newLesson = {
        id: responseData.lessonId || uuidv4(),
        unitId,
        title,
        content: description || 'PDF lesson - slides generated automatically',
        createdAt: new Date().toISOString(),
        slideCount: responseData.slideCount || 0,
        slides: responseData.slides || [],
      };
      
      console.log('✅ New Lesson Object:', newLesson);
      console.log('📸 Slides array length:', newLesson.slides.length);

      setSuccess(true);
      setFile(null);
      setTitle('');
      setDescription('');

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
    <Card className="p-6 bg-slate-900/60 border-slate-800">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-200 mb-4">Upload Lesson Material</h3>
          <p className="text-sm text-slate-400 mb-4">
            Upload a PDF file. Our system will automatically generate slides and create a summary for students.
          </p>
        </div>

        {/* Title Input */}
        <div>
          <Label htmlFor="title" className="text-slate-300">
            Lesson Title *
          </Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Introduction to React Hooks"
            className="mt-2 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
          />
        </div>

        {/* Description Input */}
        <div>
          <Label htmlFor="description" className="text-slate-300">
            Description (optional)
          </Label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of the lesson..."
            rows={3}
            className="mt-2 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        {/* File Upload */}
        <div>
          <Label className="text-slate-300 block mb-3">
            PDF File *
          </Label>
          <div className="flex gap-3">
            <label className="flex-1 cursor-pointer">
              <div className="flex items-center justify-center p-6 border-2 border-dashed border-slate-700 rounded-lg hover:border-violet-500 hover:bg-slate-900/30 transition-colors">
                <div className="text-center">
                  <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">
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
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-200">{error}</p>
          </div>
        )}

        {success && (
          <div className="flex gap-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <p className="text-sm text-emerald-200">Lesson uploaded successfully! Processing slides...</p>
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
  );
}
