import { Router, Request, Response } from 'express';
import { supabase } from '../config/supabase.js';
import { optionalAuthMiddleware } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'node:url';
import pdfParser from 'pdf-parse';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const routeDir = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(routeDir, '..', '..');
const uploadDir = path.join(backendRoot, 'uploads');

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
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

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
  optionalAuthMiddleware,
  (req: Request, res: Response, next) => {
    console.log('✅ [UPLOAD_ROUTE_MATCHED] /upload-pdf route matched!');
    console.log('Content-Type:', req.headers['content-type']);
    console.log('req.body before multer:', req.body);
    console.log('req.file before multer:', req.file);
    
    upload.single('file')(req, res, (err) => {
      if (err) {
        console.error('❌ Multer error:', err);
        return res.status(400).json({
          success: false,
          error: { code: 'UPLOAD_ERROR', message: `File upload failed: ${err.message}` },
        });
      }
      console.log('✅ Multer processed successfully');
      console.log('req.body after multer:', req.body);
      console.log('req.file after multer:', req.file ? { name: req.file.filename, size: req.file.size } : null);
      next();
    });
  },
  async (req: Request, res: Response) => {
    try {
      const { title, moduleId, unitId } = req.body;
      const userId = (req as any).user?.id || 'anonymous'; // Use 'anonymous' if no auth
      const lessonModuleId = moduleId || unitId; // Accept both moduleId and unitId

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_FILE', message: 'No file uploaded' },
        });
      }

      if (!title || !lessonModuleId) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_FIELDS', message: 'Title and moduleId/unitId are required' },
        });
      }

      // Validate that lessonModuleId is a valid UUID (v4 format)
      const uuidv4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidv4Regex.test(lessonModuleId)) {
        fs.unlinkSync(req.file.path);
        console.error(`Invalid UUID format for moduleId: "${lessonModuleId}"`);
        return res.status(400).json({
          success: false,
          error: { 
            code: 'INVALID_MODULE_ID', 
            message: `Invalid moduleId format. Expected UUID, got: "${lessonModuleId}". Please provide a valid UUID v4.` 
          },
        });
      }

      // Extract PDF text
      let pdfText = '';
      let parsedPdfPages: string[] = [];
      let extractionError: any = null;
      try {
        const parsedPdf = await extractPdf(req.file.path);
        pdfText = parsedPdf.text;
        parsedPdfPages = parsedPdf.pages;
      } catch (error) {
        extractionError = error;
        console.error('❌ PDF text extraction failed:', {
          file: req.file?.originalname,
          size: req.file?.size,
          error: String(error)
        });
      }

      if (!pdfText || pdfText.trim().length < 20) {
        const fileInfo = req.file?.originalname || 'lesson.pdf';
        const notExtractedMsg = extractionError 
          ? `\n\n⚠️ **Automatic text extraction failed:**\n${String(extractionError)}\n\nPlease manually create slides or contact support.`
          : '\n\n⚠️ **PDF was uploaded but contains no readable text.** This may be a scanned document, image-only PDF, or password-protected file.';
        
        pdfText = `# ${title}\n\nFile: ${fileInfo}\nModule: ${lessonModuleId}${notExtractedMsg}`;
        console.warn(`📄 Using fallback content for lesson "${title}" - file uploaded but not extracted`);
      }

      // Generate slides
      const slides = await generateSlides(pdfText, title, parsedPdfPages);

      if (slides.length === 0) {
        slides.push({
          slideNumber: 1,
          title: title,
          content: `Lesson content for ${title}`,
          summary: `Lesson content for ${title}`,
          keyPoints: [title],
        });
      }

      console.log('✅ Slides generated:', slides.length);
      console.log('🎬 Slide data:', JSON.stringify(slides.slice(0, 1), null, 2)); // Log first slide structure

      // Generate summary from the slides (only covers discussed topics)
      const summary = await generateSummary(slides, pdfText);
      slides.push({
        slideNumber: slides.length + 1,
        title: 'Lesson Summary',
        content: summary,
        summary,
        keyPoints: ['Summary of the complete lesson content'],
        isSummary: true,
      });

      // Store file
      const fileName = `lesson-${Date.now()}.pdf`;
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      fs.renameSync(req.file.path, path.join(uploadDir, fileName));

      const lessonId = uuidv4();
      const lessonData = {
        id: lessonId,
        moduleId: lessonModuleId,
        title,
        content: summary,
        slides,
        slideCount: slides.length,
        status: 'published',
      };

      let savedLesson: any = null;

      if (supabase) {
        try {
          console.log('🔍 Verifying module exists:', lessonModuleId);
          const { data: moduleExists, error: moduleError } = await supabase
            .from('modules')
            .select('id')
            .eq('id', lessonModuleId)
            .single();

          if (moduleError || !moduleExists) {
            return res.status(404).json({
              success: false,
              error: { code: 'MODULE_NOT_FOUND', message: 'Unit not found in Supabase.' },
            });
          } else {
            console.log('✅ Module verified:', moduleExists.id);
            console.log('💾 Saving lesson to database:', lessonData);

            const { data: persistedLesson, error: dbError } = await supabase
              .from('lessons')
              .insert({
                id: lessonId,
                module_id: lessonModuleId,
                title,
                content: summary,
                slides,
                slide_count: slides.length,
                xp_reward: 25,
                order_index: 1,
                status: 'published',
              })
              .select('id, title, slides, slide_count')
              .single();

            if (dbError) {
              throw dbError;
            } else {
              savedLesson = persistedLesson;
            }
          }
        } catch (dbError: any) {
          console.error('⚠️ Supabase lesson save failed:', dbError.message);
          return res.status(503).json({
            success: false,
            error: { code: 'DB_UNAVAILABLE', message: 'Lesson could not be saved to Supabase.' },
          });
        }
      }

      if (!savedLesson) {
        return res.status(503).json({
          success: false,
          error: {
            code: 'DB_UNAVAILABLE',
            message: 'Lesson could not be saved because Supabase is unavailable or the unit does not exist there.',
          },
        });
      }

      const responsePayload = {
        lesson: {
          id: lessonId,
          title: title,
          moduleId: lessonModuleId,
          slides: slides.length,
          summary,
        },
        lessonId: lessonId,
        slideCount: slides.length,
        slides: slides,
        message: 'Lesson created successfully with auto-generated slides',
      };
      
      console.log('📤 Sending response with slides:', responsePayload.slides.length);

      res.status(201).json({
        success: true,
        data: responsePayload,
      });
    } catch (error: any) {
      // Clean up uploaded file on error
      if ((req as any).file) {
        try {
          if (fs.existsSync((req as any).file.path)) {
            fs.unlinkSync((req as any).file.path);
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

    if (!supabase) {
      return sendSupabaseUnavailable(res);
    }

    const { data: lessons, error } = await supabase
      .from('lessons')
      .select('id, title, content, slides, slide_count, created_at, status')
      .eq('module_id', unitId)
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.json({
      success: true,
      data: (lessons || []).map((lesson: any) => ({
        id: lesson.id,
        title: lesson.title,
        content: lesson.content,
        slides: Array.isArray(lesson.slides) ? lesson.slides : [],
        slideCount: lesson.slide_count || 0,
        createdAt: lesson.created_at,
        unitId,
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

// Get slides for a lesson
router.get('/:lessonId/slides', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { lessonId } = req.params;

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
              .select('id, title, content, slides')
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

      // Build comprehensive content from lesson summary + slides
      let fullContent = '';
      if (lesson.content) {
        fullContent += lesson.content + '\n\n';
      }
      if (lesson.slides && Array.isArray(lesson.slides)) {
        lesson.slides.forEach((slide: any) => {
          if (slide.title) fullContent += `Topic: ${slide.title}\n`;
          if (slide.content) fullContent += `${slide.content}\n`;
          if (slide.keyPoints && Array.isArray(slide.keyPoints)) {
            slide.keyPoints.forEach((kp: string) => {
              fullContent += `- ${kp}\n`;
            });
          }
          if (slide.summary) fullContent += `Summary: ${slide.summary}\n`;
          fullContent += '\n';
        });
      }

      if (!fullContent || fullContent.trim().length < 50) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_CONTENT', message: 'Lesson has insufficient content to generate questions' },
        });
      }

      console.log('📚 Lesson content length:', fullContent.length, 'chars');

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable is not set');
      }

      const numQuestions = Math.min(Math.max(numberOfQuestions, 2), 10);
      const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
      const prompt = `You are a quiz generator. Based ONLY on the lesson content below, generate exactly ${numQuestions} quiz questions.

LESSON CONTENT:
${fullContent.substring(0, 5000)}

RULES:
- Questions MUST be answerable from the lesson content above
- Include a mix of multiple-choice and short-answer questions
- For multiple-choice: provide exactly 4 options with 1 correct answer
- Make incorrect options plausible but clearly wrong based on the content
- Questions should test understanding of key concepts, not just memorization
- Do NOT reference the lesson title or slide names in questions
- Ask about the actual concepts, facts, and ideas taught

Return ONLY a JSON object with this shape:
{"questions":[{"id":"1","text":"Question text?","type":"multiple-choice","points":2,"options":["A","B","C","D"],"correctAnswer":"A"}]}`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
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
      });

      const responseBody: any = await response.json();
      if (!response.ok) {
        const message = responseBody?.error?.message || `Gemini request failed with status ${response.status}`;
        const error: any = new Error(message);
        error.code = responseBody?.error?.status || responseBody?.error?.code;
        throw error;
      }

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
      const questions = parsed.questions || [];

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
router.post('/', optionalAuthMiddleware, (req: Request, res: Response, next) => {
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
