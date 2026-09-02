import express, { Router } from 'express';
import { randomUUID } from 'node:crypto';
import {
  getLaboratoryProgress,
  updatePhaseProgress,
  getPhaseProgressDetails,
  getLabStatistics,
  completeLaboratory,
} from '../controllers/laboratoryProgressController.js';
import { authMiddleware } from '../middleware/auth.js';
import { supabase } from '../config/supabase.js';
import { matchesContentTarget } from '../lib/contentTargeting.js';
import { instructorMiddleware } from '../middleware/admin.js';

const router: Router = express.Router();

// Require authentication for all laboratory progress endpoints
router.use(authMiddleware);

const laboratoryColumns = 'id, instructor_id, title, description, platform, platform_url, unit_id, unit_name, lesson_id, lesson_title, due_date, points, created_at, target_sections, target_year_levels';

const toLaboratory = (row: any) => ({
  id: row.id,
  title: row.title ?? '',
  description: row.description ?? '',
  platform: row.platform ?? 'Other',
  platformUrl: row.platform_url ?? '',
  unitId: row.unit_id ?? '',
  unitName: row.unit_name ?? '',
  lessonId: row.lesson_id ?? '',
  lessonTitle: row.lesson_title ?? '',
  dueDate: row.due_date ?? '',
  points: row.points ?? 100,
  targetSections: row.target_sections ?? [],
  targetYearLevels: row.target_year_levels ?? [],
  createdAt: row.created_at,
});

// List laboratories saved in Supabase for the current instructor/student view.
router.post('/metadata', instructorMiddleware, async (req: any, res) => {
  try {
    const { data, error } = await supabase
      .from('laboratories')
      .select(laboratoryColumns)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const rows = data ?? [];
    const visibleRows = req.user?.role === 'student'
      ? rows.filter((row: any) => matchesContentTarget(row.target_sections, row.target_year_levels, req.user.section, req.user.year_level))
      : rows;
    return res.json({ success: true, data: visibleRows.map(toLaboratory) });
  } catch (error: any) {
    console.error('❌ List laboratories error:', error);
    return res.status(500).json({ success: false, error: { code: 'LIST_FAILED', message: error.message } });
  }
});

// Create or update a laboratory's instructor-managed metadata.
router.post('/metadata', async (req: any, res) => {
  try {
    const instructorId = req.user?.id;
    const { id, title, description, platform, platformUrl, unitId, unitName, lessonId, lessonTitle, dueDate, points, targetSections, targetYearLevels } = req.body ?? {};
    if (!instructorId || !title?.trim() || !platformUrl?.trim()) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'Title and platform link are required' } });
    }

    const cleanedTargetSections = Array.isArray(targetSections)
      ? [...new Set(targetSections.map((s: any) => String(s).trim()).filter(Boolean))]
      : [];
    const cleanedTargetYearLevels = Array.isArray(targetYearLevels)
      ? [...new Set(targetYearLevels.map((y: any) => Number(y)).filter((y: number) => Number.isInteger(y) && y >= 1 && y <= 3))]
      : [];

    let resolvedUnitName = unitName || null;
    let resolvedLessonTitle = lessonTitle || null;

    if (unitId) {
      const { data: unit, error: unitError } = await supabase
        .from('modules')
        .select('id, title')
        .eq('id', unitId)
        .single();

      if (unitError || !unit) {
        return res.status(404).json({ success: false, error: { code: 'UNIT_NOT_FOUND', message: 'Unit not found' } });
      }
      resolvedUnitName = unit.title;
    }

    if (lessonId) {
      if (!unitId) {
        return res.status(400).json({ success: false, error: { code: 'MISSING_UNIT', message: 'Choose a unit before linking a lesson' } });
      }

      const { data: lesson, error: lessonError } = await supabase
        .from('lessons')
        .select('id, title, module_id')
        .eq('id', lessonId)
        .single();

      if (lessonError || !lesson) {
        return res.status(404).json({ success: false, error: { code: 'LESSON_NOT_FOUND', message: 'Lesson not found' } });
      }
      if (lesson.module_id !== unitId) {
        return res.status(400).json({ success: false, error: { code: 'LESSON_UNIT_MISMATCH', message: 'Lesson does not belong to the selected unit' } });
      }
      resolvedLessonTitle = lesson.title;
    }

    const row = {
      id: id || randomUUID(),
      instructor_id: instructorId,
      title: title.trim(),
      description: typeof description === 'string' ? description.trim() : '',
      platform: platform || 'Other',
      platform_url: platformUrl.trim(),
      unit_id: unitId || null,
      unit_name: resolvedUnitName,
      lesson_id: lessonId || null,
      lesson_title: resolvedLessonTitle,
      due_date: dueDate || null,
      points: Number.isFinite(Number(points)) ? Number(points) : 100,
      target_sections: cleanedTargetSections,
      target_year_levels: cleanedTargetYearLevels,
    };

    if (id) {
      const { data: existing, error: existingError } = await supabase
        .from('laboratories')
        .select('instructor_id')
        .eq('id', id)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing && existing.instructor_id !== instructorId) {
        return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You do not own this laboratory.' } });
      }
    }

    const { data, error } = await supabase
      .from('laboratories')
      .upsert(row, { onConflict: 'id' })
      .select(laboratoryColumns)
      .single();
    if (error) throw error;
    return res.status(id ? 200 : 201).json({ success: true, data: toLaboratory(data) });
  } catch (error: any) {
    console.error('❌ Save laboratory error:', error);
    return res.status(500).json({ success: false, error: { code: 'SAVE_FAILED', message: error.message } });
  }
});

router.delete('/:id', async (req: any, res) => {
  try {
    const { error } = await supabase
      .from('laboratories')
      .delete()
      .eq('id', req.params.id)
      .eq('instructor_id', req.user?.id);
    if (error) throw error;
    return res.json({ success: true });
  } catch (error: any) {
    console.error('❌ Delete laboratory error:', error);
    return res.status(500).json({ success: false, error: { code: 'DELETE_FAILED', message: error.message } });
  }
});

/**
 * Create (or claim) a laboratory for a unit.
 *
 * IMPORTANT: This codebase uses unit IDs as laboratory IDs in several places
 * (e.g. submissions review). So we create a `laboratories` row whose `id` is
 * the unitId, and set `instructor_id` to the current user.
 */
router.post('/create-from-unit', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const { unitId } = req.body ?? {};

    if (!userId) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Login required' } });
    }
    if (!unitId) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'unitId is required' } });
    }

    // Verify unit exists
    const { data: unit, error: unitError } = await supabase
      .from('modules')
      .select('id, title')
      .eq('id', unitId)
      .single();
    if (unitError || !unit) {
      return res.status(404).json({ success: false, error: { code: 'UNIT_NOT_FOUND', message: 'Unit not found' } });
    }

    // Require at least 1 published lesson for "submitted"
    const { count: lessonCount, error: lessonsError } = await supabase
      .from('lessons')
      .select('id', { count: 'exact', head: true })
      .eq('module_id', unitId)
      .eq('status', 'published');
    if (lessonsError) throw lessonsError;
    if (!lessonCount || lessonCount < 1) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_LESSONS', message: 'This unit has no published lessons yet. Upload at least one lesson first.' },
      });
    }

    // Upsert minimal columns that we know exist.
    const creatorYearLevel = req.user?.year_level || 1;
    const labRow: any = {
      id: unitId,
      instructor_id: userId,
      year_level: creatorYearLevel,
    };

    const { data: existingLab, error: existingLabError } = await supabase
      .from('laboratories')
      .select('instructor_id')
      .eq('id', unitId)
      .maybeSingle();
    if (existingLabError) throw existingLabError;
    if (existingLab && existingLab.instructor_id !== userId) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'This laboratory belongs to another instructor.' } });
    }

    const { data: created, error: createError } = await supabase
      .from('laboratories')
      .upsert(labRow, { onConflict: 'id' })
      .select('*')
      .single();

    if (createError) throw createError;

    return res.json({
      success: true,
      data: {
        laboratoryId: created?.id ?? unitId,
        unitId,
        unitTitle: unit.title,
        lessonCount,
      },
    });
  } catch (error: any) {
    console.error('❌ Create laboratory error:', error);
    return res.status(500).json({ success: false, error: { code: 'CREATE_FAILED', message: error.message } });
  }
});

/**
 * Check if a laboratory row exists for a unit.
 */
router.get('/exists/:unitId', async (req: any, res) => {
  try {
    const { unitId } = req.params;
    const userId = req.user?.id;

    if (!unitId) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'unitId is required' } });
    }

    const { data: lab, error } = await supabase
      .from('laboratories')
      .select('id, instructor_id')
      .eq('id', unitId)
      .single();

    if (error && error.code === 'PGRST116') {
      return res.json({ success: true, data: { exists: false } });
    }
    if (error) throw error;

    return res.json({
      success: true,
      data: {
        exists: true,
        laboratoryId: lab.id,
        instructorId: lab.instructor_id,
        isOwner: !!userId && lab.instructor_id === userId,
      },
    });
  } catch (error: any) {
    console.error('❌ Laboratory exists check error:', error);
    return res.status(500).json({ success: false, error: { code: 'CHECK_FAILED', message: error.message } });
  }
});

// Get user's overall laboratory statistics (must come before :unitId routes)
router.get('/stats', getLabStatistics);

// Mark a laboratory as completed
router.post('/complete', completeLaboratory);

// Update phase progress (create or update)
router.post('/phase-progress', updatePhaseProgress);

// Get laboratory progress for a specific unit
router.get('/:unitId/progress', getLaboratoryProgress);

// Get detailed phase progress for a unit
router.get('/:unitId/phase-details', getPhaseProgressDetails);

export default router;
