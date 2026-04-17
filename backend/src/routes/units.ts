import { Router } from 'express';
import { optionalAuthMiddleware } from '../middleware/auth.js';
import { supabase } from '../config/supabase.js';
import {
  createUnit,
  getUnits,
  getUnitLessons,
  updateLessonSlides,
  deleteUnit,
} from '../controllers/unitsController.js';

const router = Router();

// Create a new unit (optional auth for now)
router.post('/', optionalAuthMiddleware, createUnit);

// Get all units
router.get('/', getUnits);

// DEBUG: Get ALL lessons in database (no filtering)
router.get('/debug/all-lessons', async (req, res) => {
  try {
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
router.post('/debug/fix-orphaned-lessons', async (req, res) => {
  try {
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
router.get('/:unitId/lessons', getUnitLessons);

// Update lesson slides (optional auth)
router.put('/lessons/:lessonId/slides', optionalAuthMiddleware, updateLessonSlides);

// Delete a unit (optional auth)
router.delete('/:unitId', optionalAuthMiddleware, deleteUnit);

export default router;
