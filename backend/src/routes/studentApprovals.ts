import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { instructorMiddleware } from '../middleware/admin.js';
import { supabase } from '../config/supabase.js';

const router = Router();

router.use(authMiddleware, instructorMiddleware);

// List all students assigned to the instructor's section and teaching years.
router.get('/students', async (req: AuthRequest, res: Response) => {
  try {
    const section = req.user?.section;
    const teachingYearLevels = req.user?.teaching_year_levels || [];

    if (!section || teachingYearLevels.length === 0) {
      return res.json({ success: true, data: [] });
    }

    if (!supabase) {
      return res.status(503).json({
        success: false,
        error: { code: 'DB_UNAVAILABLE', message: 'Database is unavailable.' },
      });
    }

    const { data, error } = await supabase
      .from('users')
      .select('id, email, full_name, avatar_url, created_at, year_level, section, student_approved')
      .eq('role', 'student')
      .eq('section', section)
      .in('year_level', teachingYearLevels)
      .order('year_level', { ascending: true })
      .order('full_name', { ascending: true });

    if (error) throw error;
    return res.json({ success: true, data: data || [] });
  } catch (error: any) {
    console.error('Get all students error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'STUDENTS_FAILED', message: error.message },
    });
  }
});

// List pending students for the instructor's own section + teaching year levels
router.get('/student-requests', async (req: AuthRequest, res: Response) => {
  try {
    const section = req.user?.section;
    const teachingYearLevels = req.user?.teaching_year_levels || [];

    if (!section || teachingYearLevels.length === 0) {
      return res.json({ success: true, data: [] });
    }

    if (!supabase) {
      return res.status(503).json({
        success: false,
        error: { code: 'DB_UNAVAILABLE', message: 'Database is unavailable.' },
      });
    }

    let query = supabase
      .from('users')
      .select('id, email, full_name, avatar_url, created_at, year_level, section, student_approved')
      .eq('role', 'student')
      .eq('section', section)
      .order('created_at', { ascending: true });

    if (req.query.includeAll !== 'true') {
      query = query.eq('student_approved', false);
    }
    query = query.in('year_level', teachingYearLevels);

    const { data, error } = await query;

    if (error) throw error;
    return res.json({ success: true, data: data || [] });
  } catch (error: any) {
    console.error('Get student requests error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'STUDENT_REQUESTS_FAILED', message: error.message },
    });
  }
});

// Approve a single student, scoped to the instructor's own section + teaching year levels
router.patch('/student-requests/:id/approve', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const section = req.user?.section;
    const teachingYearLevels = req.user?.teaching_year_levels || [];

    if (!supabase) {
      return res.status(503).json({
        success: false,
        error: { code: 'DB_UNAVAILABLE', message: 'Database is unavailable.' },
      });
    }

    if (!section || teachingYearLevels.length === 0) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Your instructor account has no section/year level assigned.' },
      });
    }

    const { data, error } = await supabase
      .from('users')
      .update({ student_approved: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('role', 'student')
      .eq('section', section)
      .in('year_level', teachingYearLevels)
      .select('id, email, full_name, avatar_url, created_at, year_level, section, student_approved')
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        error: { code: 'STUDENT_NOT_FOUND', message: 'Student request not found for your section' },
      });
    }

    return res.json({ success: true, data });
  } catch (error: any) {
    console.error('Approve student error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'APPROVE_STUDENT_FAILED', message: error.message },
    });
  }
});

export default router;
