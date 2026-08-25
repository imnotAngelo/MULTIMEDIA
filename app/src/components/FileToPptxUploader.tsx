import { useCallback, useState } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import { AlertCircle, Download, FileArchive, FileText, Image, Presentation, UploadCloud } from 'lucide-react';
import { AetherSpinner } from './AetherSpinner';
import { authFetch } from '@/lib/authFetch';
import { API_BASE_URL } from '@/lib/apiConfig';

const acceptedTypes = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
  'text/markdown': ['.md', '.markdown'],
  'text/plain': ['.txt'],
};

interface FileToPptxUploaderProps {
  className?: string;
}

export function FileToPptxUploader({ className = '' }: FileToPptxUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [downloaded, setDownloaded] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[], fileRejections: FileRejection[]) => {
    setDownloaded(false);
    setError(fileRejections[0]?.errors[0]?.message || '');
    const nextFile = acceptedFiles[0];
    if (nextFile) {
      setFile(nextFile);
      setTitle(nextFile.name.replace(/\.[^.]+$/, ''));
      setError('');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedTypes,
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
    disabled: loading,
  });

  const convertFile = async () => {
    if (!file) return setError('Choose a file first');
    if (!title.trim()) return setError('Presentation title is required');

    setLoading(true);
    setError('');
    setDownloaded(false);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('title', title.trim());
      const response = await authFetch(`${API_BASE_URL}/convert/pptx`, { method: 'POST', body: form });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error?.message || 'Conversion failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${title.trim().replace(/[^a-z0-9-_]+/gi, '-').replace(/^-|-$/g, '') || 'presentation'}.pptx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setDownloaded(true);
    } catch (conversionError) {
      setError(conversionError instanceof Error ? conversionError.message : 'Conversion failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className={`rounded-xl border border-cyan-400/20 bg-slate-950/45 p-5 shadow-[0_0_35px_rgba(34,211,238,0.06)] ${className}`}>
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-lg border border-cyan-300/20 bg-cyan-400/10 p-2 text-cyan-300"><Presentation className="h-5 w-5" /></div>
        <div>
          <h3 className="font-semibold text-white">Convert to PowerPoint</h3>
          <p className="mt-1 text-sm text-slate-400">Keep important text and images while organizing the material into clean 16:9 slides.</p>
        </div>
      </div>

      <div {...getRootProps()} className={`cursor-pointer rounded-lg border border-dashed p-7 text-center transition-colors ${isDragActive ? 'border-cyan-300 bg-cyan-400/10' : 'border-slate-700 bg-slate-900/45 hover:border-cyan-400/60 hover:bg-slate-900/70'}`}>
        <input {...getInputProps()} />
        {file ? <FileArchive className="mx-auto h-9 w-9 text-cyan-300" /> : <UploadCloud className="mx-auto h-9 w-9 text-slate-500" />}
        <p className="mt-3 text-sm font-medium text-slate-200">{file ? file.name : isDragActive ? 'Drop your file here' : 'Drag and drop a file, or click to browse'}</p>
        <p className="mt-1 text-xs text-slate-500">PDF, DOCX, PNG, JPG, WEBP, Markdown, or TXT up to 50MB</p>
      </div>

      {file && (
        <div className="mt-4 space-y-3">
          <label className="block text-sm text-slate-300" htmlFor="pptx-title">Presentation title</label>
          <input id="pptx-title" value={title} onChange={(event) => setTitle(event.target.value)} className="h-10 w-full rounded-md border border-slate-700 bg-slate-900/70 px-3 text-sm text-white outline-none focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20" />
          <button type="button" onClick={convertFile} disabled={loading} className="inline-flex h-10 w-full items-center justify-center rounded-md bg-cyan-500 px-4 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60">
            {loading ? <><AetherSpinner className="mr-2 h-4 w-4" /> Converting...</> : <><Download className="mr-2 h-4 w-4" /> Convert and download PPTX</>}
          </button>
        </div>
      )}

      {error && <p className="mt-4 flex items-center gap-2 rounded-md border border-red-400/25 bg-red-400/10 p-3 text-sm text-red-200"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>}
      {downloaded && <p className="mt-4 flex items-center gap-2 rounded-md border border-emerald-400/25 bg-emerald-400/10 p-3 text-sm text-emerald-200"><FileText className="h-4 w-4 shrink-0" />PowerPoint downloaded successfully.</p>}
    </section>
  );
}