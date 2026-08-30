import { useState, useRef } from 'react';
import { Upload, X, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import * as pdfjsLib from 'pdfjs-dist';

// Set up the worker - use the file served from public directory
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface PDFUploadProps {
  onUpload: (file: File, metadata: PDFMetadata) => Promise<void>;
  onCancel?: () => void;
  disabled?: boolean;
}

interface PDFMetadata {
  filename: string;
  fileSize: number;
  pageCount: number;
  title?: string;
}

export function PDFUpload({ onUpload, onCancel, disabled = false }: PDFUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      setError('Please select a valid PDF file');
      return;
    }

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      setError('File size must be less than 50MB');
      return;
    }

    try {
      setError(null);
      setSuccess(false);
      setLoading(true);

      // Get page count
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      setPageCount(pdf.numPages);
      setSelectedFile(file);
    } catch (err) {
      console.error('Error validating PDF:', err);
      setError('Invalid PDF file or corrupted file');
      setSelectedFile(null);
      setPageCount(null);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || pageCount === null) return;

    try {
      setLoading(true);
      setError(null);

      const metadata: PDFMetadata = {
        filename: selectedFile.name,
        fileSize: selectedFile.size,
        pageCount: pageCount,
        title: selectedFile.name.replace('.pdf', ''),
      };

      await onUpload(selectedFile, metadata);
      setSuccess(true);
      setSelectedFile(null);
      setPageCount(null);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Error uploading PDF:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload PDF');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setPageCount(null);
    setError(null);
    setSuccess(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onCancel?.();
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-slate-900/60 border-2 border-dashed border-slate-700 rounded-lg p-8">
        {success ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <CheckCircle className="w-12 h-12 text-emerald-500" />
            <p className="text-lg font-semibold text-emerald-400">PDF Uploaded Successfully!</p>
            <p className="text-slate-400 text-sm">{selectedFile?.name}</p>
          </div>
        ) : selectedFile && pageCount !== null ? (
          <div className="space-y-4">
            <div className="bg-slate-800/50 rounded p-4 space-y-2">
              <p className="text-sm text-slate-300">
                <span className="font-semibold">File:</span> {selectedFile.name}
              </p>
              <p className="text-sm text-slate-300">
                <span className="font-semibold">Size:</span>{' '}
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
              <p className="text-sm text-slate-300">
                <span className="font-semibold">Pages:</span> {pageCount}
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                onClick={handleCancel}
                disabled={loading}
                className="bg-slate-700 hover:bg-slate-600 text-white"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={loading || disabled}
                className="bg-violet-600 hover:bg-violet-700 text-white"
              >
                <Upload className="w-4 h-4 mr-2" />
                {loading ? 'Uploading...' : 'Upload PDF'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <Upload className="w-12 h-12 text-slate-400" />
            <div className="text-center">
              <p className="text-lg font-semibold text-white mb-2">
                Drop your PDF here
              </p>
              <p className="text-slate-400 text-sm mb-4">
                or click to browse
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                disabled={disabled || loading}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || loading}
                className="bg-violet-600 hover:bg-violet-700 text-white"
              >
                Select PDF File
              </Button>
              <p className="text-slate-500 text-xs mt-4">
                Max file size: 50MB • Supported: PDF
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 flex gap-3 p-4 bg-red-900/20 border border-red-700 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-400">Error</p>
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
