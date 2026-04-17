import { Router, Request, Response } from 'express';
import { supabase } from '../config/supabase.js';
import { optionalAuthMiddleware } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import pdfParser from 'pdf-parse';
import Groq from 'groq-sdk';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

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

// Helper: Initialize Groq client
function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY environment variable is not set');
  }
  return new Groq({ apiKey });
}

// Helper: Extract text from PDF
async function extractPdfText(filePath: string): Promise<string> {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParser(dataBuffer);
    return data.text;
  } catch (error) {
    throw new Error(`Failed to parse PDF: ${error}`);
  }
}

// Helper: Generate slides from PDF text
async function generateSlides(pdfText: string, title: string): Promise<any[]> {
  try {
    const client = getGroqClient();
    
    // Use more of the PDF text to ensure comprehensive understanding
    // Use up to 12,000 characters or the entire PDF if smaller
    const pdfContextLength = Math.min(12000, pdfText.length);
    const pdfContext = pdfText.substring(0, pdfContextLength);
    
    // If PDF is shorter than 500 chars, it might be invalid
    if (pdfContext.trim().length < 100) {
      throw new Error('PDF content is too short to generate meaningful slides');
    }
    
    const response = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `You are an expert instructor. Convert the EXACT content from this PDF into comprehensive presentation slides.

LESSON TITLE: "${title}"

PDF CONTENT TO CONVERT:
${pdfContext}

CRITICAL INSTRUCTIONS:
- Create slides that DIRECTLY reflect the PDF content provided
- Do NOT generate generic or unrelated content
- Extract key topics, concepts, and information from the PDF
- Create exactly 6-8 slides based on the PDF material
- Each slide MUST be tied to specific content from the PDF above

Please create detailed slides in JSON format with this structure:
{
  "slides": [
    {
      "slideNumber": 1,
      "title": "Slide Title (directly from PDF content)",
      "content": "Detailed explanation (3-4 sentences) derived DIRECTLY from the PDF content above",
      "summary": "One-sentence summary of this specific slide's content from the PDF",
      "keyPoints": ["point directly from PDF", "another point from PDF", "third point from PDF", "fourth point from PDF"]
    }
  ]
}

REQUIREMENTS:
- Each slide title and content MUST be based on the PDF material provided
- Key points must be specific facts or concepts from the PDF
- Content should be 150-300 words per slide
- Key points must be informative and specific, not generic
- Build logical progression through the actual PDF topics
- If the PDF discusses topics A, B, and C, structure slides around those exact topics`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      try {
        // Extract JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { slides: [] };
        return parsed.slides || [];
      } catch (e) {
        console.error('Failed to parse slides JSON:', e);
        return [];
      }
    }

    return [];
  } catch (error) {
    throw new Error(`Failed to generate slides: ${error}`);
  }
}

// Helper: Generate summary from slides (only covers topics that will be discussed)
async function generateSummary(slides: any[], pdfText?: string): Promise<string> {
  try {
    const client = getGroqClient();

    // Build a comprehensive text representation of the slide content
    const slidesText = slides
      .map((s) => {
        let slideContent = `Topic: ${s.title}\n${s.content}`;
        if (s.keyPoints && Array.isArray(s.keyPoints)) {
          slideContent += '\nKey Points: ' + s.keyPoints.join('; ');
        }
        if (s.summary) {
          slideContent += `\nSummary: ${s.summary}`;
        }
        return slideContent;
      })
      .join('\n\n');

    const response = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `Write a clear, concise 3-4 sentence lesson summary based on these presentation slides. The summary should capture the main topics, concepts, and learning outcomes covered in the lesson.\n\nLesson Slides:\n${slidesText.substring(0, 3000)}`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    return typeof content === 'string' && content.trim() 
      ? content.trim() 
      : 'Comprehensive lesson content synthesized from presentation slides.';
  } catch (error) {
    console.error('Failed to generate summary:', error);
    return 'Lesson content processed from slides.';
  }
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
      const pdfText = await extractPdfText(req.file.path);

      if (!pdfText || pdfText.length < 50) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_PDF', message: 'PDF appears to be empty or unreadable' },
        });
      }

      // Generate slides
      const slides = await generateSlides(pdfText, title);

      if (slides.length === 0) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          error: { code: 'SLIDE_GENERATION_FAILED', message: 'Failed to generate slides from PDF' },
        });
      }

      console.log('✅ Slides generated:', slides.length);
      console.log('🎬 Slide data:', JSON.stringify(slides.slice(0, 1), null, 2)); // Log first slide structure

      // Generate summary from the slides (only covers discussed topics)
      const summary = await generateSummary(slides, pdfText);

      // Store file
      const fileName = `lesson-${Date.now()}.pdf`;
      const uploadDir = './uploads';
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      fs.renameSync(req.file.path, path.join(uploadDir, fileName));

      // Verify module exists first
      console.log('🔍 Verifying module exists:', lessonModuleId);
      const { data: moduleExists, error: moduleError } = await supabase
        .from('modules')
        .select('id')
        .eq('id', lessonModuleId)
        .single();

      if (moduleError || !moduleExists) {
        console.error('❌ Module not found:', lessonModuleId, moduleError?.message);
        throw new Error(`Module/Unit with ID "${lessonModuleId}" not found. Please ensure the unit was created first.`);
      }
      console.log('✅ Module verified:', moduleExists.id);

      // Save lesson to database
      const lessonId = uuidv4();
      const lessonData = {
        id: lessonId,
        module_id: lessonModuleId,
        title,
        content: summary,
        slides: slides,
        slide_count: slides.length,
        xp_reward: 25,
        order_index: 1,
        status: 'published',
      };

      console.log('💾 Saving lesson to database:', lessonData);

      const { data: savedLesson, error: dbError } = await supabase
        .from('lessons')
        .insert(lessonData)
        .select('id, title, slides, slide_count')
        .single();

      if (dbError) {
        console.error('❌ Database save error:', dbError);
        throw new Error(`Failed to save lesson to database: ${dbError.message}`);
      }
      console.log('✅ Lesson saved to database:', savedLesson);

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
          fs.unlinkSync((req as any).file.path);
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

// Get slides for a lesson
router.get('/:lessonId/slides', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { lessonId } = req.params;

    console.log('📡 Fetching slides for lesson:', lessonId);

    // First, try to get slides from the lesson_slides table
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
      const { data: lesson, error: lessonError } = await supabase
        .from('lessons')
        .select('id, title, content, slides')
        .eq('id', lessonId)
        .single();

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

      // Use Groq AI to generate questions
      const client = getGroqClient();
      const numQuestions = Math.min(Math.max(numberOfQuestions, 2), 10);

      const response = await client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: `You are a quiz generator. Based ONLY on the lesson content below, generate exactly ${numQuestions} quiz questions.

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

Return ONLY valid JSON in this exact format:
{
  "questions": [
    {
      "id": "1",
      "text": "Question text here?",
      "type": "multiple-choice",
      "points": 2,
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option A"
    },
    {
      "id": "2",
      "text": "Explain question here?",
      "type": "short-answer",
      "points": 3,
      "options": [],
      "correctAnswer": ""
    }
  ]
}`,
          },
        ],
      });

      const aiContent = response.choices[0]?.message?.content;
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

      // If Groq fails, return a clear error
      if (error.message?.includes('GROQ_API_KEY')) {
        return res.status(500).json({
          success: false,
          error: { code: 'AI_NOT_CONFIGURED', message: 'AI service is not configured. Please set GROQ_API_KEY.' },
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
      extractPdfText(file.path).then(async (pdfText) => {
        if (!pdfText || pdfText.length < 50) {
          fs.unlinkSync(file.path);
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_PDF', message: 'PDF appears to be empty or unreadable' },
          });
        }

        // Generate slides
        const slides = await generateSlides(pdfText, title);

        if (slides.length === 0) {
          fs.unlinkSync(file.path);
          return res.status(400).json({
            success: false,
            error: { code: 'SLIDE_GENERATION_FAILED', message: 'Failed to generate slides from PDF' },
          });
        }

        console.log('✅ Slides generated:', slides.length);

        // Insert into database...
        // (Rest of the upload logic from /upload-pdf route)
        const { data, error } = await supabase
          .from('lessons')
          .insert({
            id: uuidv4(),
            module_id: lessonModuleId,
            title,
            content: description || `PDF lesson - ${slides.length} slides generated automatically`,
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
