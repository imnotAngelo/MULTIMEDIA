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

const router: Router = express.Router();

// Require authentication for all laboratory progress endpoints
router.use(authMiddleware);

const laboratoryColumns = 'id, instructor_id, title, description, platform, platform_url, unit_id, unit_name, due_date, points, created_at';

const toLaboratory = (row: any) => ({
  id: row.id,
  title: row.title ?? '',
  description: row.description ?? '',
  platform: row.platform ?? 'Other',
  platformUrl: row.platform_url ?? '',
  unitId: row.unit_id ?? '',
  unitName: row.unit_name ?? '',
  dueDate: row.due_date ?? '',
  points: row.points ?? 100,
  createdAt: row.created_at,
});

// List laboratories saved in Supabase for the current instructor/student view.
router.get('/', async (req: any, res) => {
  try {
    const { data, error } = await supabase
      .from('laboratories')
      .select(laboratoryColumns)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res.json({ success: true, data: (data ?? []).map(toLaboratory) });
  } catch (error: any) {
    console.error('❌ List laboratories error:', error);
    return res.status(500).json({ success: false, error: { code: 'LIST_FAILED', message: error.message } });
  }
});

// Create or update a laboratory's instructor-managed metadata.
router.post('/metadata', async (req: any, res) => {
  try {
    const instructorId = req.user?.id;
    const { id, title, description, platform, platformUrl, unitId, unitName, dueDate, points } = req.body ?? {};
    if (!instructorId || !title?.trim() || !platformUrl?.trim()) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'Title and platform link are required' } });
    }

    const row = {
      id: id || randomUUID(),
      instructor_id: instructorId,
      title: title.trim(),
      description: typeof description === 'string' ? description.trim() : '',
      platform: platform || 'Other',
      platform_url: platformUrl.trim(),
      unit_id: unitId || null,
      unit_name: unitName || null,
      due_date: dueDate || null,
      points: Number.isFinite(Number(points)) ? Number(points) : 100,
    };

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
    const labRow: any = {
      id: unitId,
      instructor_id: userId,
    };

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
