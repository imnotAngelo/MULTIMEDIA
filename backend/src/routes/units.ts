import { Router } from 'express';
import multer from 'multer';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';
import { instructorMiddleware } from '../middleware/admin.js';
import { supabase } from '../config/supabase.js';

const ALLOWED_VIDEO_MIME = new Set([
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
]);

const videoStorage = multer.memoryStorage();

const videoUpload = multer({
  storage: videoStorage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB max
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_VIDEO_MIME.has(file.mimetype)) {
      return cb(new Error('Only MP4, WebM, OGG, MOV, AVI, and MKV video formats are allowed.'));
    }
    cb(null, true);
  },
});
import {
  createUnit,
  getUnits,
  getUnitLessons,
  updateLessonSlides,
  deleteUnit,
  unarchiveUnit,
  unarchiveLesson,
  updateLessonMetadata,
} from '../controllers/unitsController.js';

const router = Router();

// Upload lesson video file
router.post('/lessons/:lessonId/upload-video', authMiddleware, instructorMiddleware, (req, res, next) => {
  videoUpload.single('video')(req, res, (err: any) => {
    if (err) {
      return res.status(400).json({
        success: false,
        error: { code: 'VIDEO_UPLOAD_FAILED', message: err.message || 'Video upload failed' },
      });
    }
    next();
  });
}, async (req: any, res: any) => {
  try {
    const { lessonId } = req.params;

    if (!lessonId) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_ID', message: 'Lesson ID is required' },
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_FILE', message: 'No video file uploaded' },
      });
    }

    if (!supabase) {
      return res.status(503).json({
        success: false,
        error: { code: 'SUPABASE_UNAVAILABLE', message: 'Supabase is not configured' },
      });
    }

    // Generate unique video filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 10);
    const extension = req.file.mimetype === 'video/quicktime' ? '.mov' : 
                     req.file.mimetype === 'video/x-msvideo' ? '.avi' :
                     req.file.mimetype === 'video/x-matroska' ? '.mkv' :
                     req.file.mimetype === 'video/webm' ? '.webm' :
                     req.file.mimetype === 'video/ogg' ? '.ogg' : '.mp4';
    const videoFileName = `lesson-${lessonId}-${timestamp}-${randomId}${extension}`;
    const videoPath = `lesson-videos/${videoFileName}`;

    console.log(`📹 Uploading video: ${videoPath}, size: ${req.file.size} bytes`);

    // Upload to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from('lesson-videos')
      .upload(videoPath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const { data: publicData } = supabase.storage
      .from('lesson-videos')
      .getPublicUrl(videoPath);

    const videoUrl = publicData?.publicUrl || `https://ciopmrwvmgqsbapyljih.supabase.co/storage/v1/object/public/lesson-videos/${videoPath}`;

    // Update lesson with video URL
    const { data: lesson, error: updateError } = await supabase
      .from('lessons')
      .update({ video_url: videoUrl, updated_at: new Date().toISOString() })
      .eq('id', lessonId)
      .select('id, title, video_url')
      .single();

    if (updateError) throw updateError;

    console.log('✅ Video uploaded and lesson updated:', { lessonId, videoUrl });

    return res.json({
      success: true,
      message: 'Video uploaded successfully',
      data: {
        lessonId,
        video_url: videoUrl,
        lesson,
      },
    });
  } catch (error: any) {
    console.error('❌ Video upload error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'VIDEO_UPLOAD_ERROR',
        message: error.message,
      },
    });
  }
});



// Create a new unit (optional auth for now)
router.post('/', authMiddleware, instructorMiddleware, createUnit);

// Get all units
router.get('/', optionalAuthMiddleware, getUnits);

// DEBUG: Get ALL lessons in database (no filtering)
router.get('/debug/all-lessons', authMiddleware, instructorMiddleware, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({
        success: false,
        error: 'Supabase is unavailable',
      });
    }

    const { data: lessons, error } = await supabase
      .from('lessons')
      .select('id, title, module_id, status, slide_count, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const { data: modules } = await supabase
      .from('modules')
      .select('id, title')
      .order('created_at', { ascending: false });

    // Analyze lessons by status and module_id
    const analysis = {
      totalLessons: lessons?.length || 0,
      totalModules: modules?.length || 0,
      lessonsWithoutModule: lessons?.filter(l => !l.module_id).length || 0,
      lessonsByStatus: {
        published: lessons?.filter(l => l.status === 'published').length || 0,
        draft: lessons?.filter(l => l.status === 'draft').length || 0,
        archived: lessons?.filter(l => l.status === 'archived').length || 0,
        other: lessons?.filter(l => !['published', 'draft', 'archived'].includes(l.status)).length || 0,
      },
      lessonModuleMapping: (lessons || []).reduce((acc, lesson) => {
        const key = lesson.module_id || 'NO_MODULE_ID';
        if (!acc[key]) acc[key] = [];
        acc[key].push({
          id: lesson.id,
          title: lesson.title,
          status: lesson.status,
          slide_count: lesson.slide_count,
        });
        return acc;
      }, {} as Record<string, any>),
    };

    res.json({
      success: true,
      analysis,
      debug: {
        totalLessons: lessons?.length || 0,
        totalModules: modules?.length || 0,
        lessons: lessons || [],
        modules: modules || [],
      },
    });
  } catch (error: any) {
    console.error('DEBUG error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// FIX: Link all orphaned lessons to a unit
router.post('/debug/fix-orphaned-lessons', authMiddleware, instructorMiddleware, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({
        success: false,
        error: 'Supabase is unavailable',
      });
    }

    // Get all orphaned lessons (no module_id)
    const { data: orphanedLessons, error: fetchError } = await supabase
      .from('lessons')
      .select('id, title')
      .is('module_id', null);

    if (fetchError) throw fetchError;

    if (!orphanedLessons || orphanedLessons.length === 0) {
      return res.json({
        success: true,
        message: 'No orphaned lessons found',
        fixed: 0,
      });
    }

    // Get or create default unit
    let defaultUnit: any;
    const { data: existingUnits } = await supabase
      .from('modules')
      .select('id')
      .eq('title', 'Default Unit')
      .single();

    if (existingUnits) {
      defaultUnit = existingUnits;
    } else {
      // Create default unit
      const { data: newUnit, error: createError } = await supabase
        .from('modules')
        .insert({
          title: 'Default Unit',
          description: 'Auto-created unit for existing lessons',
          order_index: 1,
        })
        .select('id')
        .single();

      if (createError) throw createError;
      defaultUnit = newUnit;
    }

    // Update all orphaned lessons with the default unit
    const { data: updated, error: updateError } = await supabase
      .from('lessons')
      .update({ module_id: defaultUnit.id })
      .is('module_id', null)
      .select('id');

    if (updateError) throw updateError;

    console.log(`✅ Fixed ${updated?.length || 0} orphaned lessons by linking to module ${defaultUnit.id}`);

    res.json({
      success: true,
      message: `Successfully linked ${updated?.length || 0} lessons to unit "${defaultUnit.id}"`,
      fixed: updated?.length || 0,
      unitId: defaultUnit.id,
      affectedLessons: orphanedLessons.map(l => l.title),
    });
  } catch (error: any) {
    console.error('FIX error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get lessons for a unit
router.get('/:unitId/lessons', optionalAuthMiddleware, getUnitLessons);

// Update lesson slides (optional auth)
router.put('/lessons/:lessonId/slides', authMiddleware, instructorMiddleware, updateLessonSlides);

// Update lesson metadata (video URL, app link, app name)
router.put('/lessons/:lessonId/metadata', authMiddleware, instructorMiddleware, updateLessonMetadata);

// Delete a unit (optional auth)
router.delete('/:unitId', authMiddleware, instructorMiddleware, deleteUnit);

// Unarchive a unit (restore from archive)
router.post('/:unitId/unarchive', authMiddleware, instructorMiddleware, unarchiveUnit);

// Unarchive a lesson (restore from archive)
router.post('/lessons/:lessonId/unarchive', authMiddleware, instructorMiddleware, unarchiveLesson);

export default router;
