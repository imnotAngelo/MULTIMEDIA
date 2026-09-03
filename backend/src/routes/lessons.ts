import { Router, Request, Response } from 'express';
import { supabase } from '../config/supabase.js';
import { authMiddleware, optionalAuthMiddleware, AuthRequest } from '../middleware/auth.js';
import { instructorMiddleware } from '../middleware/admin.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'node:url';
import pdfParser from 'pdf-parse';
import { v4 as uuidv4 } from 'uuid';
import { createLocalLesson, getLocalLessonById, listLocalLessonsByModuleId } from '../lib/lessonStore.js';
import { clipQuizSource, extractTextFromLessonFile, isThinLessonContent } from '../lib/lessonDocumentText.js';
import { matchesContentTarget } from '../lib/contentTargeting.js';

const router = Router();
const routeDir = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(routeDir, '..', '..');
const uploadDir = path.join(backendRoot, 'uploads');

async function canAccessLesson(lessonId: string, requester: AuthRequest['user']) {
  if (!requester || !supabase) return false;
  const { data: lesson, error: lessonError } = await supabase
    .from('lessons')
    .select('id, module_id, status, target_sections, target_year_levels')
    .eq('id', lessonId)
    .maybeSingle();
  if (lessonError || !lesson) return false;

  const { data: module, error: moduleError } = await supabase
    .from('modules')
    .select('course_id')
    .eq('id', lesson.module_id)
    .maybeSingle();
  if (moduleError || !module) return false;

  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select('instructor_id')
    .eq('id', module.course_id)
    .maybeSingle();
  if (courseError || !course) return false;
  if (requester.role === 'instructor') return course.instructor_id === requester.id;
  if (requester.role !== 'student' || lesson.status === 'archived' || lesson.status === 'draft') return false;

  const { data: owner, error: ownerError } = await supabase
    .from('users')
    .select('section, teaching_sections, teaching_year_levels')
    .eq('id', course.instructor_id)
    .maybeSingle();
  if (ownerError || !owner) return false;
  const ownerSections = Array.isArray(owner.teaching_sections) && owner.teaching_sections.length
    ? owner.teaching_sections
    : (owner.section ? [owner.section] : []);
  const ownerYears = Array.isArray(owner.teaching_year_levels) ? owner.teaching_year_levels : [];
  return matchesContentTarget(lesson.target_sections, lesson.target_year_levels, requester.section, requester.year_level)
    && matchesContentTarget(ownerSections, ownerYears, requester.section, requester.year_level);
}

async function fetchWithTimeout(input: string, init: RequestInit = {}, timeoutMs = 15000): Promise<globalThis.Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

// Log all incoming requests to this router
router.use((req: Request, res: Response, next) => {
  console.log(`📨 [LESSON_ROUTER] Received ${req.method} request to path: "${req.path}", Full URL: "${req.originalUrl}"`);
  console.log(`📨 [LESSON_ROUTER] Content-Type: ${req.headers['content-type']}`);
  next();
});

// Test route to verify routing is working
router.post('/test-upload', (req: Request, res: Response) => {
  console.log('✅ TEST ROUTE HIT: /test-upload');
  res.json({ message: 'Test route working', body: req.body });
});

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'graphicFile') {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
        return;
      }
      cb(new Error('Only image files are allowed for graphic uploads'));
      return;
    }

    if (file.mimetype === 'application/pdf') {
      cb(null, true);
      return;
    }

    cb(new Error('Only PDF files are allowed'));
  },
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

export function getUploadedFile(req: Request): Express.Multer.File | undefined {
  const files = (req as any).files;
  if (files && Array.isArray(files.file)) return files.file[0];
  if (files && files.file && !Array.isArray(files.file)) return files.file;
  return (req as any).file;
}

export function getUploadedGraphicFile(req: Request): Express.Multer.File | undefined {
  const files = (req as any).files;
  if (!files) return undefined;
  if (Array.isArray(files.graphicFile)) return files.graphicFile[0];
  if (files.graphicFile && !Array.isArray(files.graphicFile)) return files.graphicFile;
  return undefined;
}

export function createUniqueStorageName(extension: string, prefix = 'lesson') {
  const normalizedExt = extension.startsWith('.') ? extension : `.${extension}`;
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${uniqueSuffix}${normalizedExt}`;
}

async function persistGraphicAsset(graphicFile: Express.Multer.File, lessonTitle: string): Promise<string> {
  if (!graphicFile) return '';

  const assetDir = path.join(uploadDir, 'lesson-graphics');
  if (!fs.existsSync(assetDir)) fs.mkdirSync(assetDir, { recursive: true });

  const extension = path.extname(graphicFile.originalname || graphicFile.filename || '.png') || '.png';
  const safeTitle = (lessonTitle || 'lesson-graphic').replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/^-+|-+$/g, '') || 'lesson-graphic';
  const fileName = createUniqueStorageName(extension, safeTitle);
  const targetPath = path.join(assetDir, fileName);

  if (fs.existsSync(graphicFile.path)) fs.renameSync(graphicFile.path, targetPath);

  return `/uploads/lesson-graphics/${fileName}`;
}

function sendSupabaseUnavailable(res: Response) {
  return res.status(503).json({
    success: false,
    error: {
      code: 'DB_UNAVAILABLE',
      message: 'Database is unavailable. Please check Supabase configuration.',
    },
  });
}

interface ParsedPdf {
  text: string;
  pages: string[];
}

function summarizePdfText(pdfText?: string, maxLength = 1800): string {
  const normalized = String(pdfText || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3).trim()}...` : normalized;
}

// Extract the complete document while retaining page boundaries for slide conversion.
async function extractPdf(filePath: string): Promise<ParsedPdf> {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const pages: string[] = [];
    const data = await pdfParser(dataBuffer, {
      pagerender: async (pageData: any) => {
        const textContent = await pageData.getTextContent();
        const lines: string[] = [];
        let currentLine = '';
        let currentY: number | null = null;
        for (const item of textContent.items) {
          const text = String(item.str || '').trim();
          if (!text) continue;
          const itemY = Array.isArray(item.transform) ? Number(item.transform[5]) : null;
          if (currentLine && currentY !== null && itemY !== null && Math.abs(itemY - currentY) > 2) {
            lines.push(currentLine.trim());
            currentLine = '';
          }
          currentLine += `${currentLine ? ' ' : ''}${text}`;
          currentY = itemY ?? currentY;
        }
        if (currentLine) lines.push(currentLine.trim());
        const pageText = lines.join('\n').replace(/[ \t]+/g, ' ').trim();
        pages.push(pageText);
        return pageText;
      },
    } as any);
    return { text: data.text || pages.join('\n\n'), pages };
  } catch (error) {
    throw new Error(`Failed to parse PDF: ${error}`);
  }
}

async function extractLessonDocumentText(lesson: any): Promise<string> {
  const storedUrl = String(lesson.pdf_url || lesson.pdfUrl || lesson.file_url || lesson.fileUrl || '').trim();
  if (!storedUrl) return '';

  const fileName = path.basename(new URL(storedUrl, 'http://localhost').pathname);
  const originalFormat = String(lesson.original_format || lesson.originalFormat || '').trim();
  const localPaths = [
    path.join(uploadDir, fileName),
    path.join(process.cwd(), 'uploads', fileName),
  ];

  const extractFromBuffer = (buffer: Buffer) => extractTextFromLessonFile(buffer, fileName, originalFormat);

  for (const localPath of localPaths) {
    if (fs.existsSync(localPath)) {
      return extractFromBuffer(fs.readFileSync(localPath));
    }
  }

  let buffer: Buffer | null = null;
  if (!/^(https?:\/\/)(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?/i.test(storedUrl)) {
    try {
      const response = await fetchWithTimeout(storedUrl, {}, 15000);
      if (response.ok) buffer = Buffer.from(await response.arrayBuffer());
    } catch (fetchError: any) {
      console.warn('⚠️ Could not download lesson document:', fetchError?.message || fetchError);
    }
  }

  if (!buffer && supabase) {
    for (const storagePath of [`lessons/${fileName}`, fileName]) {
      const { data: file } = await supabase.storage.from('lesson-pdfs').download(storagePath);
      if (file) {
        buffer = Buffer.from(await file.arrayBuffer());
        break;
      }
    }
  }

  if (!buffer) return '';
  return extractFromBuffer(buffer);
}

function splitForReadableSlides(text: string, maxCharacters = 900): string[] {
  const sourceText = text.trim();
  const paragraphs = text
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((part) => part.replace(/[ \t]+/g, ' ').replace(/\n/g, ' ').trim())
    .filter(Boolean);
  const chunks: string[] = [];

  for (const paragraph of paragraphs.length > 0 ? paragraphs : [sourceText]) {
    if (paragraph.length <= maxCharacters) {
      chunks.push(paragraph);
      continue;
    }

    const sentences = paragraph.split(/(?<=[.!?])\s+/).filter(Boolean);
    let current = '';
    for (const sentence of sentences.length > 0 ? sentences : [paragraph]) {
      if (sentence.length > maxCharacters) {
        if (current) {
          chunks.push(current);
          current = '';
        }
        for (let start = 0; start < sentence.length; start += maxCharacters) {
          chunks.push(sentence.slice(start, start + maxCharacters).trim());
        }
        continue;
      }
      if (current && `${current} ${sentence}`.length > maxCharacters) {
        chunks.push(current);
        current = sentence;
      } else {
        current = current ? `${current} ${sentence}` : sentence;
      }
    }
    if (current) chunks.push(current);
  }

  return chunks;
}

function buildFallbackSlides(pdfText: string, title: string, pages?: string[]): any[] {
  const sourcePages = pages && pages.length > 0 ? pages : [pdfText];
  const pageChunks = sourcePages.flatMap((pageText, pageIndex) =>
    splitForReadableSlides(pageText || `${title} (page ${pageIndex + 1})`).map((content) => ({ content, pageIndex }))
  );
  const chunks = pageChunks.length > 0 ? pageChunks : [{ content: title, pageIndex: 0 }];

  return chunks.map(({ content, pageIndex }, index) => {
    const firstLine = content.split(/[.!?]/)[0].trim();
    const slideTitle = firstLine.length > 70 ? `${firstLine.slice(0, 67)}...` : firstLine;
    const summary = content.length > 180 ? `${content.slice(0, 177)}...` : content;
    const keyPoints = content
      .split(/(?<=[.!?])\s+/)
      .filter(Boolean)
      .slice(0, 4);
    return {
      slideNumber: index + 1,
      title: slideTitle || `${title} — Page ${pageIndex + 1}`,
      content,
      summary,
      keyPoints: keyPoints.length > 0 ? keyPoints : [content],
      sourcePage: pageIndex + 1,
    };
  });
}

function buildFallbackSummary(slides: any[], pdfText?: string): string {
  const fallbackText = slides
    .filter((slide) => !slide.isSummary)
    .map((slide, index) => `Part ${index + 1}: ${slide.summary || slide.content || ''}`)
    .filter(Boolean)
    .join(' ');
  const cleaned = (fallbackText || pdfText || '').replace(/\s+/g, ' ').trim();
  return cleaned.length > 1800
    ? `${cleaned.slice(0, 1797)}...`
    : cleaned || `Lesson content for ${slides[0]?.title || 'this lesson'}`;
}

export function buildOriginalPdfLessonRecord({
  lessonId,
  title,
  description,
  moduleId,
  fileName,
  fileUrl,
  videoUrl,
  graphicUrl,
  pdfText,
}: {
  lessonId?: string;
  title: string;
  description?: string;
  moduleId: string;
  fileName: string;
  fileUrl?: string;
  videoUrl?: string;
  graphicUrl?: string;
  pdfText?: string;
}) {
  const rawText = summarizePdfText(pdfText);
  const descriptionText = String(description || '').trim();
  const content = rawText || (
    descriptionText && !isThinLessonContent(descriptionText, 1) ? descriptionText : ''
  ) || `Original PDF uploaded: ${title}`;

  return {
    id: lessonId || uuidv4(),
    moduleId,
    title,
    content,
    slides: [],
    slideCount: 0,
    status: 'published' as const,
    pdfUrl: fileUrl || `/uploads/${fileName}`,
    originalFormat: 'pdf' as const,
    videoUrl: videoUrl || '',
    graphicUrl: graphicUrl || '',
  };
}

export function buildConvertedLessonRecord({
  id,
  unitId,
  moduleId,
  title,
  content,
  fileUrl,
  pdfUrl,
  originalFormat = 'pptx',
}: {
  id?: string;
  unitId?: string | null;
  moduleId?: string | null;
  title: string;
  content?: string;
  fileUrl?: string;
  pdfUrl?: string;
  originalFormat?: string;
}) {
  const normalizedUnitId = unitId || moduleId || null;
  const normalizedFileUrl = fileUrl || pdfUrl || '';

  return {
    id: id || uuidv4(),
    lessonId: id || uuidv4(),
    unitId: normalizedUnitId,
    moduleId: normalizedUnitId,
    title,
    content: content || `Converted presentation generated from ${title}.`,
    createdAt: new Date().toISOString(),
    slideCount: 0,
    slides: [],
    pdfUrl: normalizedFileUrl,
    fileUrl: normalizedFileUrl,
    downloadUrl: normalizedFileUrl,
    videoUrl: '',
    graphicUrl: '',
    originalFormat,
    stored: true,
    message: 'Presentation converted and saved as a lesson.',
  };
}

export function normalizeGeneratedQuestions(rawQuestions: any[], targetCount = 5) {
  const normalized: any[] = [];
  const seen = new Set<string>();

  for (const item of rawQuestions || []) {
    if (!item || typeof item !== 'object') continue;

    const rawText = String(item.text ?? item.title ?? '').trim();
    if (!rawText) continue;

    const normalizedText = rawText.replace(/\s+/g, ' ').trim();
    const dedupeKey = normalizedText.toLowerCase();
    if (!dedupeKey || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const type = item.type === 'short-answer' ? 'short-answer' : 'multiple-choice';
    const points = Number(item.points) > 0 ? Number(item.points) : 2;

    if (type === 'multiple-choice') {
      const rawOptions = Array.isArray(item.options) ? item.options : [];
      const validOptions = rawOptions
        .map((option: any) => String(typeof option === 'string' ? option : option?.text ?? '').trim())
        .filter((option) => option && option.length > 0)
        .filter((option, index, arr) => arr.findIndex((candidate) => candidate.toLowerCase() === option.toLowerCase()) === index);

      if (validOptions.length < 4) continue;

      const uniqueOptions = validOptions.slice(0, 4);
      const answerValue = String(item.correctAnswer ?? item.answer ?? '').trim();
      const correctAnswer = uniqueOptions.find((option) => option.toLowerCase() === answerValue.toLowerCase()) || uniqueOptions[0];

      normalized.push({
        id: item.id ?? String(normalized.length + 1),
        text: normalizedText,
        type,
        points,
        options: uniqueOptions,
        correctAnswer,
      });
    } else {
      normalized.push({
        id: item.id ?? String(normalized.length + 1),
        text: normalizedText,
        type: 'short-answer',
        points,
        options: [],
        correctAnswer: '',
      });
    }

    if (normalized.length >= targetCount) break;
  }

  return normalized;
}

// Helper: Generate slides from PDF text
async function generateSlides(pdfText: string, title: string, pages?: string[]): Promise<any[]> {
  // Keep the complete extracted text in the deck. AI-generated slides are
  // intentionally avoided here because model context/output limits can omit
  // source material; summaries remain AI-assisted below.
  return buildFallbackSlides(pdfText, title, pages);
}

// Helper: Generate summary from slides (only covers topics that will be discussed)
async function generateSummary(slides: any[], pdfText?: string): Promise<string> {
  // Build from every source slide so the final summary cannot omit later pages.
  return buildFallbackSummary(slides, pdfText);
}

// Upload and process PDF
router.post(
  '/upload-pdf',
  authMiddleware,
  instructorMiddleware,
  (req: Request, res: Response, next) => {
    console.log('✅ [UPLOAD_ROUTE_MATCHED] /upload-pdf route matched!');
    console.log('Content-Type:', req.headers['content-type']);
    console.log('req.body before multer:', req.body);
    console.log('req.file before multer:', req.file);
    
    upload.fields([
      { name: 'file', maxCount: 1 },
      { name: 'graphicFile', maxCount: 1 },
    ])(req, res, (err) => {
      if (err) {
        console.error('❌ Multer error:', err);
        return res.status(400).json({
          success: false,
          error: { code: 'UPLOAD_ERROR', message: `File upload failed: ${err.message}` },
        });
      }
      console.log('✅ Multer processed successfully');
      console.log('req.body after multer:', req.body);
      console.log('req.file after multer:', (req as any).file ? { name: (req as any).file.filename, size: (req as any).file.size } : null);
      console.log('req.files after multer:', (req as any).files ? Object.keys((req as any).files) : null);
      next();
    });
  },
  async (req: Request, res: Response) => {
    try {
      const { title, moduleId, unitId, targetSections, targetYearLevels, description, videoUrl, graphicUrl } = req.body;
      const userId = (req as any).user?.id || 'anonymous'; // Use 'anonymous' if no auth
      const lessonModuleId = moduleId || unitId; // Accept both moduleId and unitId
      const uploadedFile = getUploadedFile(req);
      const uploadedGraphic = getUploadedGraphicFile(req);
      const normalizedVideoUrl = String(videoUrl || '').trim() || String((req.body as any).video_url || '').trim() || '';
      const normalizedGraphicUrl = String(graphicUrl || '').trim() || String((req.body as any).graphic_url || '').trim() || '';

      const parseJsonArray = (value: any): any[] => {
        if (Array.isArray(value)) return value;
        if (typeof value === 'string' && value.trim()) {
          try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
        }
        return [];
      };
      const cleanedTargetSections = [...new Set(parseJsonArray(targetSections).map((s) => String(s).trim()).filter(Boolean))];
      const cleanedTargetYearLevels = [...new Set(parseJsonArray(targetYearLevels).map((y) => Number(y)).filter((y) => Number.isInteger(y) && y >= 1 && y <= 3))];

      if (!uploadedFile) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_FILE', message: 'No file uploaded' },
        });
      }

      if (!title || !lessonModuleId) {
        if (uploadedFile && fs.existsSync(uploadedFile.path)) fs.unlinkSync(uploadedFile.path);
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_FIELDS', message: 'Title and moduleId/unitId are required' },
        });
      }

      // Validate that lessonModuleId is a valid UUID (v4 format)
      const uuidv4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidv4Regex.test(lessonModuleId)) {
        if (uploadedFile && fs.existsSync(uploadedFile.path)) fs.unlinkSync(uploadedFile.path);
        console.error(`Invalid UUID format for moduleId: "${lessonModuleId}"`);
        return res.status(400).json({
          success: false,
          error: { 
            code: 'INVALID_MODULE_ID', 
            message: `Invalid moduleId format. Expected UUID, got: "${lessonModuleId}". Please provide a valid UUID v4.` 
          },
        });
      }

      const persistedGraphicUrl = uploadedGraphic ? await persistGraphicAsset(uploadedGraphic, title) : normalizedGraphicUrl;

      // Keep the original PDF untouched instead of converting it into a slide deck.
      const fileName = createUniqueStorageName('.pdf', 'lesson');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const destinationPath = path.join(uploadDir, fileName);
      fs.renameSync(uploadedFile.path, destinationPath);

      let pdfUrl = `/uploads/${fileName}`;
      if (supabase) {
        const pdfBuffer = fs.readFileSync(destinationPath);
        const storagePath = `lessons/${fileName}`;
        const bucketName = 'lesson-pdfs';

        let { error: storageError } = await supabase.storage
          .from(bucketName)
          .upload(storagePath, pdfBuffer, {
            contentType: 'application/pdf',
            upsert: true,
          });

        // Create the public bucket automatically when setting up a new environment.
        if (storageError && /not found|does not exist|bucket/i.test(storageError.message || '')) {
          await supabase.storage.createBucket(bucketName, {
            public: true,
            allowedMimeTypes: ['application/pdf'],
          });
          ({ error: storageError } = await supabase.storage
            .from(bucketName)
            .upload(storagePath, pdfBuffer, {
              contentType: 'application/pdf',
              upsert: true,
            }));
        }

        if (!storageError) {
          const { data: publicData } = supabase.storage
            .from(bucketName)
            .getPublicUrl(storagePath);
          if (publicData?.publicUrl) {
            pdfUrl = publicData.publicUrl;
            console.log('✅ PDF copied to shared storage:', pdfUrl);
          } else {
            throw new Error('Shared PDF storage returned no public URL');
          }
        } else {
          throw new Error(`Shared PDF storage unavailable: ${storageError.message}`);
        }
      }

      const lessonId = uuidv4();
      let extractedPdfText = '';
      try {
        const parsedPdf = await extractPdf(destinationPath);
        extractedPdfText = parsedPdf.text || parsedPdf.pages.join('\n\n') || '';
        console.log('📄 Extracted PDF text length:', extractedPdfText.length);
      } catch (parseError) {
        console.warn('⚠️ PDF extraction failed; falling back to a placeholder lesson description:', parseError);
      }

      const lessonData = buildOriginalPdfLessonRecord({
        lessonId,
        title,
        description,
        moduleId: lessonModuleId,
        fileName,
        fileUrl: pdfUrl,
        videoUrl: normalizedVideoUrl || undefined,
        graphicUrl: persistedGraphicUrl || undefined,
        pdfText: extractedPdfText,
      });

      let savedLesson: any = null;

      if (supabase) {
        try {
          console.log('🔍 Verifying module exists:', lessonModuleId);
          const { data: moduleExists, error: moduleError } = await supabase
            .from('modules')
            .select('id, courses!inner(instructor_id)')
            .eq('id', lessonModuleId)
            .eq('courses.instructor_id', userId)
            .single();

          if (moduleError || !moduleExists) {
            console.warn('⚠️ Supabase module lookup failed, falling back to local lesson persistence:', moduleError?.message || 'module missing');
            const localLesson = createLocalLesson({
              id: lessonId,
              moduleId: lessonModuleId,
              title,
              content: lessonData.content,
              slides: [],
              slideCount: 0,
              status: 'published',
              createdAt: new Date().toISOString(),
              pdfUrl,
              originalFormat: 'pdf',
              videoUrl: normalizedVideoUrl || '',
              graphicUrl: persistedGraphicUrl || '',
            });
            savedLesson = {
              id: localLesson.id,
              title: localLesson.title,
              slides: localLesson.slides || [],
              slide_count: localLesson.slideCount || 0,
              video_url: normalizedVideoUrl || null,
              graphic_url: persistedGraphicUrl || null,
              pdf_url: localLesson.pdfUrl || pdfUrl,
              original_format: localLesson.originalFormat || 'pdf',
            };
          } else {
            console.log('✅ Module verified:', moduleExists.id);
            console.log('💾 Saving lesson to database:', lessonData);

            const insertPayload: any = {
              id: lessonId,
              module_id: lessonModuleId,
              title,
              content: lessonData.content,
              slides: [],
              slide_count: 0,
              xp_reward: 25,
              order_index: 1,
              target_sections: cleanedTargetSections,
              target_year_levels: cleanedTargetYearLevels,
              status: 'published',
              video_url: normalizedVideoUrl || null,
              graphic_url: persistedGraphicUrl || null,
            };

            const pdfAwareInsertPayload = {
              ...insertPayload,
              pdf_url: pdfUrl,
              original_format: 'pdf',
            };

            try {
              const { data: persistedLesson, error: dbError } = await supabase
                .from('lessons')
                .insert(pdfAwareInsertPayload)
                .select('id, title, slides, slide_count, video_url, graphic_url')
                .single();

              if (dbError) {
                const isMissingPdfColumns = /pdf_url|original_format|42703|column .* does not exist/i.test(dbError.message || '');
                if (isMissingPdfColumns) {
                  console.warn('⚠️ PDF columns not available in database. Falling back to local lesson persistence.');
                  throw new Error(dbError.message);
                }
                throw dbError;
              }

              savedLesson = persistedLesson;
            } catch (dbError: any) {
              console.error('⚠️ Supabase lesson save failed, using local fallback:', dbError.message);
              const localLesson = createLocalLesson({
                id: lessonId,
                moduleId: lessonModuleId,
                title,
                content: lessonData.content,
                slides: [],
                slideCount: 0,
                status: 'published',
                createdAt: new Date().toISOString(),
                pdfUrl,
                originalFormat: 'pdf',
                videoUrl: normalizedVideoUrl || '',
                graphicUrl: persistedGraphicUrl || '',
              });
              savedLesson = {
                id: localLesson.id,
                title: localLesson.title,
                slides: localLesson.slides || [],
                slide_count: localLesson.slideCount || 0,
                video_url: normalizedVideoUrl || null,
                graphic_url: persistedGraphicUrl || null,
                pdf_url: localLesson.pdfUrl || pdfUrl,
                original_format: localLesson.originalFormat || 'pdf',
              };
            }
          }
        } catch (dbError: any) {
          console.error('⚠️ Supabase lesson save failed, using local fallback:', dbError.message);
          const localLesson = createLocalLesson({
            id: lessonId,
            moduleId: lessonModuleId,
            title,
            content: lessonData.content,
            slides: [],
            slideCount: 0,
            status: 'published',
            createdAt: new Date().toISOString(),
            pdfUrl,
            originalFormat: 'pdf',
            videoUrl: normalizedVideoUrl || '',
            graphicUrl: persistedGraphicUrl || '',
          });
          savedLesson = {
            id: localLesson.id,
            title: localLesson.title,
            slides: localLesson.slides || [],
            slide_count: localLesson.slideCount || 0,
            video_url: normalizedVideoUrl || null,
            graphic_url: persistedGraphicUrl || null,
            pdf_url: localLesson.pdfUrl || pdfUrl,
            original_format: localLesson.originalFormat || 'pdf',
          };
        }
      } else {
        const localLesson = createLocalLesson({
          id: lessonId,
          moduleId: lessonModuleId,
          title,
          content: lessonData.content,
          slides: [],
          slideCount: 0,
          status: 'published',
          createdAt: new Date().toISOString(),
          pdfUrl,
          originalFormat: 'pdf',
          videoUrl: normalizedVideoUrl || '',
          graphicUrl: persistedGraphicUrl || '',
        });
        savedLesson = {
          id: localLesson.id,
          title: localLesson.title,
          slides: localLesson.slides || [],
          slide_count: localLesson.slideCount || 0,
          video_url: normalizedVideoUrl || null,
          graphic_url: persistedGraphicUrl || null,
          pdf_url: localLesson.pdfUrl || pdfUrl,
          original_format: localLesson.originalFormat || 'pdf',
        };
      }

      const responsePayload = {
        lesson: {
          id: lessonId,
          title: title,
          moduleId: lessonModuleId,
          slides: 0,
          summary: lessonData.content,
          content: lessonData.content,
          pdfUrl,
          videoUrl: normalizedVideoUrl || '',
          graphicUrl: persistedGraphicUrl || '',
          originalFormat: 'pdf',
        },
        lessonId: lessonId,
        content: lessonData.content,
        slideCount: 0,
        slides: [],
        pdfUrl,
        videoUrl: normalizedVideoUrl || '',
        graphicUrl: persistedGraphicUrl || '',
        originalFormat: 'pdf',
        message: 'Lesson created successfully. The original PDF was kept as uploaded.',
      };

      console.log('📤 Sending response with original PDF preserved:', pdfUrl);

      res.status(201).json({
        success: true,
        data: responsePayload,
      });
    } catch (error: any) {
      // Clean up uploaded files on error
      const cleanupFile = (req as any).files?.file?.[0] || (req as any).files?.graphicFile?.[0] || (req as any).file;
      if (cleanupFile) {
        try {
          if (fs.existsSync(cleanupFile.path)) {
            fs.unlinkSync(cleanupFile.path);
          }
        } catch (e) {
          console.error('Failed to clean up file:', e);
        }
      }

      console.error('PDF upload error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'UPLOAD_FAILED',
          message: error.message || 'Failed to process PDF',
        },
      });
    }
  }
);

// Get lessons for a unit (used by the instructor UI)
router.get('/unit/:unitId', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { unitId } = req.params;
    if (!unitId) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_ID', message: 'Unit ID is required' },
      });
    }

    let lessons: any[] = [];

    if (supabase) {
      const { data, error } = await supabase
        .from('lessons')
        .select('id, title, content, slides, slide_count, created_at, status, video_url, graphic_url')
        .eq('module_id', unitId)
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('⚠️ Failed to load lessons from Supabase, falling back to local lesson store:', error.message);
      } else {
        lessons = data || [];
      }
    }

    const localLessons = listLocalLessonsByModuleId(unitId).map((lesson: any) => ({
      id: lesson.id,
      title: lesson.title,
      content: lesson.content || '',
      slides: Array.isArray(lesson.slides) ? lesson.slides : [],
      slide_count: lesson.slideCount || 0,
      created_at: lesson.createdAt || new Date().toISOString(),
      status: lesson.status || 'published',
      video_url: lesson.videoUrl || '',
      graphic_url: lesson.graphicUrl || '',
      pdf_url: lesson.pdfUrl || '',
      original_format: lesson.originalFormat || (lesson.pdfUrl ? 'pdf' : 'slides'),
    }));

    const mergedLessons = [...(lessons || []), ...localLessons];

    return res.json({
      success: true,
      data: mergedLessons.map((lesson: any) => ({
        id: lesson.id,
        title: lesson.title,
        content: lesson.content,
        slides: Array.isArray(lesson.slides) ? lesson.slides : [],
        slideCount: lesson.slide_count || 0,
        createdAt: lesson.created_at,
        unitId,
        videoUrl: lesson.video_url || '',
        graphicUrl: lesson.graphic_url || '',
        pdfUrl: lesson.pdf_url || lesson.pdfUrl || '',
        originalFormat: lesson.original_format || lesson.originalFormat || (lesson.pdf_url || lesson.pdfUrl ? 'pdf' : 'slides'),
      })),
    });
  } catch (error: any) {
    console.error('Get unit lessons error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'GET_UNIT_LESSONS_FAILED', message: error.message },
    });
  }
});

// Get one lesson directly by ID. This avoids requiring the client to scan units.
router.get('/by-id/:lessonId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { lessonId } = req.params;

    if (supabase) {
      if (!(await canAccessLesson(lessonId, req.user))) {
        return res.status(404).json({ success: false, error: { code: 'LESSON_NOT_FOUND', message: 'Lesson was not found' } });
      }
      const { data: lesson, error } = await supabase
        .from('lessons')
        .select('id, title, content, slides, slide_count, created_at, status, module_id, video_url, graphic_url, pdf_url, original_format')
        .eq('id', lessonId)
        .maybeSingle();

      if (error) throw error;
      if (lesson) {
        return res.json({ success: true, data: lesson });
      }
    }

    const localLesson = getLocalLessonById(lessonId);
    if (localLesson) {
      return res.json({
        success: true,
        data: {
          id: localLesson.id,
          title: localLesson.title,
          content: localLesson.content || '',
          slides: localLesson.slides || [],
          slide_count: localLesson.slideCount || 0,
          created_at: localLesson.createdAt,
          status: localLesson.status || 'published',
          module_id: localLesson.moduleId,
          video_url: localLesson.videoUrl || '',
          graphic_url: localLesson.graphicUrl || '',
          pdf_url: localLesson.pdfUrl || '',
          original_format: localLesson.originalFormat || (localLesson.pdfUrl ? 'pdf' : 'slides'),
        },
      });
    }

    return res.status(404).json({
      success: false,
      error: { code: 'LESSON_NOT_FOUND', message: 'Lesson was not found' },
    });
  } catch (error: any) {
    console.error('Get lesson error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'GET_LESSON_FAILED', message: error.message || 'Failed to load lesson' },
    });
  }
});

// Get slides for a lesson
router.get('/:lessonId/pdf', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { lessonId } = req.params;

    if (!(await canAccessLesson(lessonId, req.user))) {
      return res.status(404).json({ success: false, error: { code: 'PDF_NOT_FOUND', message: 'PDF file was not found for this lesson' } });
    }

    if (!supabase) return sendSupabaseUnavailable(res);

    const { data: lesson, error } = await supabase
      .from('lessons')
      .select('pdf_url, original_format')
      .eq('id', lessonId)
      .single();

    if (error || !lesson?.pdf_url) {
      return res.status(404).json({
        success: false,
        error: { code: 'PDF_NOT_FOUND', message: 'PDF file was not found for this lesson' },
      });
    }

    const storedUrl = String(lesson.pdf_url);
    const fileName = path.basename(new URL(storedUrl, 'http://localhost').pathname);
    const localPath = path.join(uploadDir, fileName);

    if (fs.existsSync(localPath)) {
      return res.sendFile(localPath);
    }

    // Try the stored remote URL first when it is not a localhost URL.
    if (!/^(https?:\/\/)(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?/i.test(storedUrl)) {
      try {
        const remoteResponse = await fetch(storedUrl);
        if (remoteResponse.ok) {
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
          return res.send(Buffer.from(await remoteResponse.arrayBuffer()));
        }
      } catch (remoteError) {
        console.warn('⚠️ Stored PDF URL could not be fetched:', remoteError);
      }
    }

    // Support both the current lessons/<file> path and legacy root uploads.
    for (const storagePath of [`lessons/${fileName}`, fileName]) {
      const { data: file, error: storageError } = await supabase.storage
        .from('lesson-pdfs')
        .download(storagePath);

      if (!storageError && file) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
        return res.send(Buffer.from(await file.arrayBuffer()));
      }
    }

    return res.status(404).json({
      success: false,
      error: { code: 'PDF_NOT_FOUND', message: 'PDF file is no longer available on this server' },
    });
  } catch (error: any) {
    console.error('Get lesson PDF error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'GET_PDF_FAILED', message: error.message || 'Failed to load PDF' },
    });
  }
});

// Get slides for a lesson
router.get('/:lessonId/slides', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { lessonId } = req.params;

    if (!(await canAccessLesson(lessonId, req.user))) {
      return res.status(404).json({ success: false, error: { code: 'LESSON_NOT_FOUND', message: 'Lesson was not found' } });
    }

      if (!supabase) {
        return sendSupabaseUnavailable(res);
      }

    const { data: slides, error } = await supabase
      .from('lesson_slides')
      .select('*')
      .eq('lesson_id', lessonId)
      .order('slide_number', { ascending: true });

    if (error || !slides || slides.length === 0) {
      // If not found in lesson_slides, try to get from lessons.slides column
      console.log('📡 No slides in lesson_slides table, checking lessons.slides column');
      
      const { data: lesson, error: lessonError } = await supabase
        .from('lessons')
        .select('id, slides')
        .eq('id', lessonId)
        .single();

      if (lessonError) {
        console.error('❌ Error fetching lesson:', lessonError);
        return res.json({
          success: true,
          data: [],
        });
      }

      if (lesson && lesson.slides) {
        console.log('✅ Found slides in lessons.slides column:', lesson.slides.length, 'slides');
        return res.json({
          success: true,
          data: Array.isArray(lesson.slides) ? lesson.slides : [],
        });
      }

      console.log('⚠️ No slides found for lesson:', lessonId);
      return res.json({
        success: true,
        data: [],
      });
    }

    console.log('✅ Found slides in lesson_slides table:', slides.length, 'slides');
    res.json({
      success: true,
      data: slides || [],
    });
  } catch (error: any) {
    console.error('Get slides error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'GET_SLIDES_FAILED', message: error.message },
    });
  }
});

// Get comments for a lesson
router.get('/:lessonId/comments', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { lessonId } = req.params;

    if (!supabase) {
      return sendSupabaseUnavailable(res);
    }

    const { data: comments, error } = await supabase
      .from('lesson_comments')
      .select('*')
      .eq('lesson_id', lessonId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: comments || [],
    });
  } catch (error: any) {
    console.error('Get comments error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'GET_COMMENTS_FAILED', message: error.message },
    });
  }
});

// Post a comment
router.post('/:lessonId/comments', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { lessonId } = req.params;
    const { content, slideNumber } = req.body;
    const userId = (req as any).user.id;

    if (!supabase) {
      return sendSupabaseUnavailable(res);
    }

    if (!content) {
      return res.status(400).json({
        success: false,
        error: { code: 'EMPTY_COMMENT', message: 'Comment cannot be empty' },
      });
    }

    const { data: user } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', userId)
      .single();

    const { data: comment, error } = await supabase
      .from('lesson_comments')
      .insert({
        lesson_id: lessonId,
        user_id: userId,
        content,
        slide_number: slideNumber || 1,
        author: user?.full_name || 'Anonymous',
        likes: 0,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data: comment,
    });
  } catch (error: any) {
    console.error('Post comment error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'POST_COMMENT_FAILED', message: error.message },
    });
  }
});

// Like a comment
router.post(
  '/:lessonId/comments/:commentId/like',
  optionalAuthMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { commentId } = req.params;

      if (!supabase) {
        return sendSupabaseUnavailable(res);
      }

      // Get current likes
      const { data: comment } = await supabase
        .from('lesson_comments')
        .select('likes')
        .eq('id', commentId)
        .single();

      // Increment likes
      const { data: updated, error } = await supabase
        .from('lesson_comments')
        .update({ likes: (comment?.likes || 0) + 1 })
        .eq('id', commentId)
        .select()
        .single();

      if (error) throw error;

      res.json({
        success: true,
        data: updated,
      });
    } catch (error: any) {
      console.error('Like comment error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'LIKE_FAILED', message: error.message },
      });
    }
  }
);

// Generate quiz questions from lesson content using AI
router.post(
  '/:lessonId/generate-questions',
  optionalAuthMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { lessonId } = req.params;
      const { numberOfQuestions = 5 } = req.body;

      console.log('🧠 Generating quiz questions for lesson:', lessonId);

      // Get lesson with content and slides
      let lesson: any = null;
      let lessonError: any = null;
      let dbUnavailable = false;

      if (supabase) {
        try {
          const result = await Promise.race([
            supabase
              .from('lessons')
              .select('id, title, content, slides, pdf_url, original_format')
              .eq('id', lessonId)
              .single(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Supabase request timed out')), 5000)
            ),
          ]);
          lesson = result.data;
          lessonError = result.error;
        } catch (error: any) {
          lessonError = error;
          dbUnavailable = true;
          console.error('❌ Supabase unreachable while fetching lesson for quiz generation:', error?.message || error);
        }
      } else {
        dbUnavailable = true;
      }

      // Uploads can use the local lesson store when the database schema or
      // insert is unavailable. Use that same source for quiz generation.
      if (!lesson) {
        const localLesson = getLocalLessonById(lessonId);
        if (localLesson) {
          lesson = localLesson;
          lessonError = null;
          dbUnavailable = false;
        }
      }

      if (dbUnavailable) {
        return res.status(503).json({
          success: false,
          error: { code: 'DB_UNAVAILABLE', message: 'Database is unavailable. Please check Supabase configuration and try again.' },
        });
      }

      if (lessonError || !lesson) {
        return res.status(404).json({
          success: false,
          error: { code: 'LESSON_NOT_FOUND', message: 'Lesson not found' },
        });
      }

      let originalDocumentText = '';
      if (lesson.pdf_url || lesson.pdfUrl || lesson.file_url || lesson.fileUrl) {
        try {
          originalDocumentText = await extractLessonDocumentText(lesson);
        } catch (documentError: any) {
          console.warn('⚠️ Could not extract lesson document text:', documentError.message);
        }
      }

      let fullContent = originalDocumentText.trim();
      const lessonText = lesson.content || lesson.description || lesson.summary || lesson.text || '';
      if (!fullContent && lessonText && !isThinLessonContent(String(lessonText), 1)) {
        fullContent = String(lessonText).trim();
      }

      fullContent = clipQuizSource(fullContent);

      if (isThinLessonContent(fullContent, 1)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'NO_CONTENT',
            message: 'The original lesson file is unavailable or has no readable text. Please re-upload the original PDF, PPT, PPTX, DOCX, TXT, or Markdown file.',
          },
        });
      }

      console.log('📚 Lesson content length:', fullContent.length, 'chars');

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable is not set');
      }

      const numQuestions = Math.min(Math.max(numberOfQuestions, 2), 10);
      const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
      const modelsToTry = [model, ...(model !== 'gemini-2.5-flash' ? ['gemini-2.5-flash'] : [])];
      const prompt = `You are a professional quiz generator. Based ONLY on the lesson content below, generate exactly ${numQuestions} unique quiz questions.

LESSON CONTENT:
${fullContent}

RULES:
- Generate exactly ${numQuestions} questions, no more and no fewer.
- Every question must be answerable from the lesson content above.
- Make the questions precise, high-quality, and academically appropriate.
- Include a balanced mix of multiple-choice and short-answer questions.
- For multiple-choice: provide exactly 4 unique options and exactly 1 correct answer.
- Incorrect options must be plausible but clearly incorrect based on the lesson content.
- Do not repeat the same question, idea, or wording across questions.
- Avoid vague, generic, or repetitive phrasing.
- Do not mention the lesson title, slide titles, or any metadata in the question text.
- Focus on understanding, interpretation, and key concepts rather than memorization.

Return ONLY a JSON object in this exact format:
{"questions":[{"id":"1","text":"Question text?","type":"multiple-choice","points":2,"options":["Option A","Option B","Option C","Option D"],"correctAnswer":"Option A"}]}`;

      let response: globalThis.Response | null = null;
      let responseBody: any = null;
      let lastBusyError: any = null;
      for (const candidateModel of modelsToTry) {
        response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${candidateModel}:generateContent?key=${encodeURIComponent(apiKey)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 4096,
              responseMimeType: 'application/json',
            },
          }),
        }, 20000);
        responseBody = await response.json();
        if (response.ok) break;

        const message = responseBody?.error?.message || `Gemini request failed with status ${response.status}`;
        const isBusy = response.status === 429 || responseBody?.error?.status === 'RESOURCE_EXHAUSTED' || /high demand|try again later|rate limit/i.test(message);
        if (!isBusy || candidateModel === modelsToTry.at(-1)) {
          const error: any = new Error(message);
          error.code = responseBody?.error?.status || responseBody?.error?.code;
          error.httpStatus = response.status;
          throw error;
        }
        lastBusyError = new Error(message);
      }

      if (!response?.ok) throw lastBusyError || new Error('Gemini request failed');

      const aiContent = responseBody?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!aiContent) {
        throw new Error('AI returned empty response');
      }

      // Parse JSON from AI response
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('AI response did not contain valid JSON');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const questions = normalizeGeneratedQuestions(parsed.questions || [], numQuestions);

      console.log('🧠 Generated', questions.length, 'questions from lesson content');

      res.json({
        success: true,
        data: questions,
      });
    } catch (error: any) {
      console.error('Generate questions error:', error);

      if (error.message?.includes('GEMINI_API_KEY')) {
        return res.status(500).json({
          success: false,
          error: { code: 'AI_NOT_CONFIGURED', message: 'AI service is not configured. Please set GEMINI_API_KEY.' },
        });
      }

      if (error.code === 'NOT_FOUND' || error.message?.includes('not found') || error.message?.includes('not supported')) {
        return res.status(502).json({
          success: false,
          error: {
            code: 'AI_MODEL_UNAVAILABLE',
            message: `The configured Gemini model is unavailable: ${process.env.GEMINI_MODEL || 'gemini-3.6-flash'}. Update GEMINI_MODEL to a supported model.`,
          },
        });
      }

      if (error.httpStatus === 429 || error.code === 'RESOURCE_EXHAUSTED' || /high demand|try again later|rate limit/i.test(error.message || '')) {
        return res.status(503).json({
          success: false,
          error: { code: 'AI_BUSY', message: 'The AI service is temporarily busy. Please try again in a moment.' },
        });
      }

      res.status(500).json({
        success: false,
        error: { code: 'GENERATE_FAILED', message: error.message || 'Failed to generate questions' },
      });
    }
  }
);

// Download lesson as PDF
router.get(
  '/:lessonId/download-pdf',
  optionalAuthMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { lessonId } = req.params;

      if (!supabase) {
        return sendSupabaseUnavailable(res);
      }

      // Get lesson data
      const { data: lesson, error: lessonError } = await supabase
        .from('lessons')
        .select('*')
        .eq('id', lessonId)
        .single();

      if (lessonError || !lesson) {
        return res.status(404).json({
          success: false,
          error: { code: 'LESSON_NOT_FOUND', message: 'Lesson not found' },
        });
      }

      // Get slides
      const { data: slides, error: slidesError } = await supabase
        .from('lesson_slides')
        .select('*')
        .eq('lesson_id', lessonId)
        .order('slide_number', { ascending: true });

      if (slidesError) throw slidesError;

      // Import PDFKit
      const PDFDocument = (await import('pdfkit')).default;

      // Create PDF document
      const doc = new PDFDocument({ margin: 50 });

      // Set response headers
      const fileName = `${lesson.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${Date.now()}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      // Pipe to response
      doc.pipe(res);

      // Title page
      doc.fontSize(32).font('Helvetica-Bold').text(lesson.title || 'Untitled Lesson', {
        align: 'center',
      });

      doc.moveDown();
      doc.fontSize(14).font('Helvetica').text(`Created: ${new Date(lesson.created_at).toLocaleDateString()}`, {
        align: 'center',
      });

      if (slides && slides.length > 0) {
        doc.fontSize(14).text(`Total Slides: ${slides.length}`, {
          align: 'center',
        });
      }

      doc.addPage();

      // Content slides
      if (slides && slides.length > 0) {
        slides.forEach((slide: any, idx: number) => {
          // Slide header
          doc.fontSize(20).font('Helvetica-Bold').text(`Slide ${idx + 1}: ${slide.title || 'Untitled'}`);

          doc.moveDown();

          // Content
          doc.fontSize(12).font('Helvetica').text(slide.content || 'No content', {
            align: 'left',
            width: 500,
          });

          doc.moveDown();

          // Summary
          if (slide.summary) {
            doc.fontSize(11).font('Helvetica-Bold').text('Summary:');
            doc.fontSize(10).font('Helvetica').text(slide.summary, {
              align: 'left',
              width: 500,
            });
            doc.moveDown();
          }

          // Key Points
          if (slide.key_points && Array.isArray(slide.key_points) && slide.key_points.length > 0) {
            doc.fontSize(11).font('Helvetica-Bold').text('Key Points:');
            slide.key_points.forEach((point: string) => {
              doc.fontSize(10).font('Helvetica').text(`• ${point}`, {
                indent: 20,
              });
            });
            doc.moveDown();
          }

          // Page break between slides
          if (idx < slides.length - 1) {
            doc.addPage();
          }
        });
      }

      // Finalize PDF
      doc.end();
    } catch (error: any) {
      console.error('Download PDF error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'DOWNLOAD_FAILED', message: error.message },
      });
    }
  }
);

// Get all lessons for a module/unit
router.get(
  '/module/:moduleId',
  optionalAuthMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { moduleId } = req.params;

      if (!supabase) {
        return sendSupabaseUnavailable(res);
      }

      // Get all lessons for this module
      const { data: lessons, error } = await supabase
        .from('lessons')
        .select('id, title, content, created_at, status, module_id')
        .eq('module_id', moduleId)
        .order('order_index', { ascending: true });

      if (error) throw error;

      // For each lesson, get the slides count
      const lessonsWithSlides = await Promise.all(
        (lessons || []).map(async (lesson: any) => {
          if (!supabase) {
            return {
              ...lesson,
              slideCount: 0,
              slides: [],
            };
          }

          const { data: slides, error: slidesError } = await supabase
            .from('lesson_slides')
            .select('id')
            .eq('lesson_id', lesson.id);

          return {
            ...lesson,
            slideCount: slidesError ? 0 : (slides?.length || 0),
            slides: slidesError ? [] : slides,
          };
        })
      );

      res.json({
        success: true,
        data: lessonsWithSlides || [],
      });
    } catch (error: any) {
      console.error('Get lessons error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'FETCH_FAILED', message: error.message },
      });
    }
  }
);

// Get single lesson with all slides
router.get(
  '/:lessonId/full',
  optionalAuthMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { lessonId } = req.params;

      if (!supabase) {
        return sendSupabaseUnavailable(res);
      }

      // Get lesson
      const { data: lesson, error: lessonError } = await supabase
        .from('lessons')
        .select('*')
        .eq('id', lessonId)
        .single();

      if (lessonError || !lesson) {
        return res.status(404).json({
          success: false,
          error: { code: 'LESSON_NOT_FOUND', message: 'Lesson not found' },
        });
      }

      // Get slides
      const { data: slides, error: slidesError } = await supabase
        .from('lesson_slides')
        .select('*')
        .eq('lesson_id', lessonId)
        .order('slide_number', { ascending: true });

      if (slidesError) throw slidesError;

      res.json({
        success: true,
        data: {
          ...lesson,
          slides: slides || [],
          slideCount: slides?.length || 0,
        },
      });
    } catch (error: any) {
      console.error('Get lesson details error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'FETCH_FAILED', message: error.message },
      });
    }
  }
);

// Catch POST to /lessons and handle file uploads OR return error
router.post('/', authMiddleware, instructorMiddleware, (req: Request, res: Response, next) => {
  // Check if this is a file upload request (multipart/form-data)
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    console.log('📨 [FALLBACK] File upload detected at / route, processing as upload');
  
    // Process the file upload using the same multer middleware as /upload-pdf
    upload.single('file')(req, res, (err) => {
      if (err) {
        console.error('❌ Multer error:', err);
        return res.status(400).json({
          success: false,
          error: { code: 'UPLOAD_ERROR', message: `File upload failed: ${err.message}` },
        });
      }

      console.log('✅ [FALLBACK] Multer processed successfully');
      const { title, moduleId, unitId, description } = req.body;
      const userId = (req as any).user?.id || 'anonymous';
      const lessonModuleId = moduleId || unitId;
      const file = (req as any).file;

      if (!supabase) {
        return sendSupabaseUnavailable(res);
      }

      if (!file) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_FILE', message: 'No file uploaded' },
        });
      }

      if (!title || !lessonModuleId) {
        fs.unlinkSync(file.path);
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_FIELDS', message: 'Title and moduleId/unitId are required' },
        });
      }

      // Validate that lessonModuleId is a valid UUID (v4 format)
      const uuidv4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidv4Regex.test(lessonModuleId)) {
        fs.unlinkSync(file.path);
        console.error(`Invalid UUID format for moduleId: "${lessonModuleId}"`);
        return res.status(400).json({
          success: false,
          error: { 
            code: 'INVALID_MODULE_ID', 
            message: `Invalid moduleId format. Expected UUID, got: "${lessonModuleId}". Please provide a valid UUID v4.` 
          },
        });
      }

      // Now call the same processing logic as /upload-pdf
      // Extract PDF text
      extractPdf(file.path).then(async (parsedPdf) => {
        const pdfText = parsedPdf.text;
        if (!pdfText || pdfText.length < 50) {
          fs.unlinkSync(file.path);
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_PDF', message: 'PDF appears to be empty or unreadable' },
          });
        }

        // Generate slides
        const slides = await generateSlides(pdfText, title, parsedPdf.pages);

        if (slides.length === 0) {
          fs.unlinkSync(file.path);
          return res.status(400).json({
            success: false,
            error: { code: 'SLIDE_GENERATION_FAILED', message: 'Failed to generate slides from PDF' },
          });
        }

        console.log('✅ Slides generated:', slides.length);

        const summary = await generateSummary(slides, pdfText);
        slides.push({
          slideNumber: slides.length + 1,
          title: 'Lesson Summary',
          content: summary,
          summary,
          keyPoints: ['Summary of the complete lesson content'],
          isSummary: true,
        });

        // Insert into database...
        // (Rest of the upload logic from /upload-pdf route)
        if (!supabase) {
          return sendSupabaseUnavailable(res);
        }

        const creatorYearLevel = (req as any).user?.year_level || 1;
        const { data, error } = await supabase
          .from('lessons')
          .insert({
            id: uuidv4(),
            module_id: lessonModuleId,
            title,
            content: description || summary,
            slides: slides,
            slide_count: slides.length,
            status: 'published',
            xp_reward: 10,
            order_index: 0,
            year_level: creatorYearLevel,
          })
          .select();

        if (error || !data || data.length === 0) {
          fs.unlinkSync(file.path);
          console.error('Database error:', error);
          return res.status(500).json({
            success: false,
            error: { code: 'DB_ERROR', message: `Failed to save lesson: ${error?.message || 'Unknown error'}` },
          });
        }

        const lesson = data[0];
        fs.unlinkSync(file.path);

        res.json({
          success: true,
          data: {
            lessonId: lesson.id,
            title: lesson.title,
            unitId: lesson.module_id,
            slideCount: lesson.slide_count,
            slides,
          },
        });
      }).catch((parseErr) => {
        if (file) fs.unlinkSync(file.path);
        console.error('PDF parsing error:', parseErr);
        res.status(500).json({
          success: false,
          error: { code: 'PARSE_ERROR', message: 'Failed to parse PDF' },
        });
      });
    });
  } else {
    // Not a file upload - return error
    console.error('❌ Direct POST to /api/lessons (without /upload-pdf) detected!');
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_ENDPOINT',
        message: 'POST /api/lessons is not a valid endpoint. Use POST /api/lessons/upload-pdf instead for file uploads.'
      }
    });
  }
});

export default router;
