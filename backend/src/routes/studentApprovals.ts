import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { instructorMiddleware } from '../middleware/admin.js';
import { supabase } from '../config/supabase.js';

const router = Router();

router.use(authMiddleware, instructorMiddleware);

async function getInstructorScope(instructorId: string) {
  const { data: instructor, error } = await supabase
    .from('users')
    .select('role, section, teaching_sections, teaching_year_levels')
    .eq('id', instructorId)
    .maybeSingle();
  if (error) throw error;
  if (!instructor || instructor.role !== 'instructor') return null;

  return {
    sections: Array.isArray(instructor.teaching_sections) && instructor.teaching_sections.length
      ? instructor.teaching_sections
      : (instructor.section ? [instructor.section] : []),
    yearLevels: Array.isArray(instructor.teaching_year_levels)
      ? instructor.teaching_year_levels.map(Number).filter(Number.isInteger)
      : [],
  };
}

function normalizeSection(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function belongsToInstructorSection(section: unknown, teachingSections: string[]) {
  const normalizedStudentSection = normalizeSection(section);
  return teachingSections.some((teachingSection) => normalizeSection(teachingSection) === normalizedStudentSection);
}

// List students waiting for assignment in the instructor's handled sections.
router.get('/students', async (req: AuthRequest, res: Response) => {
  try {
    const scope = await getInstructorScope(req.user!.id);
    if (!scope) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Instructor account not found' } });
    const { sections: teachingSections, yearLevels: teachingYearLevels } = scope;

    if (teachingSections.length === 0 || teachingYearLevels.length === 0) {
      return res.json({ success: true, data: [] });
    }

    if (!supabase) {
      return res.status(503).json({
        success: false,
        error: { code: 'DB_UNAVAILABLE', message: 'Database is unavailable.' },
      });
    }

    const { data: students, error } = await supabase
      .from('users')
      .select('id, email, full_name, avatar_url, created_at, year_level, section, student_approved, approved_by_instructor_id')
      .eq('role', 'student')
      .in('year_level', teachingYearLevels)
      .is('approved_by_instructor_id', null)
      .eq('student_approved', false)
      .order('year_level', { ascending: true })
      .order('full_name', { ascending: true });

    if (error) throw error;
    const data = (students || []).filter((student) => belongsToInstructorSection(student.section, teachingSections));
    return res.json({ success: true, data });
  } catch (error: any) {
    console.error('Get all students error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'STUDENTS_FAILED', message: error.message },
    });
  }
});

// List pending students for the instructor's own sections + teaching year levels
router.get('/student-requests', async (req: AuthRequest, res: Response) => {
  try {
    const scope = await getInstructorScope(req.user!.id);
    if (!scope) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Instructor account not found' } });
    const { sections: teachingSections, yearLevels: teachingYearLevels } = scope;

    if (teachingSections.length === 0 || teachingYearLevels.length === 0) {
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
      .select('id, email, full_name, avatar_url, created_at, year_level, section, student_approved, approved_by_instructor_id')
      .eq('role', 'student')
      .order('created_at', { ascending: true });

    if (req.query.includeAll !== 'true') {
      query = query.eq('student_approved', false);
      query = query.is('approved_by_instructor_id', null);
    } else {
      query = query.or(`approved_by_instructor_id.eq.${req.user!.id},and(approved_by_instructor_id.is.null,student_approved.eq.false)`);
    }
    query = query.in('year_level', teachingYearLevels);

    const { data: students, error } = await query;

    if (error) throw error;
    const data = (students || []).filter((student) => belongsToInstructorSection(student.section, teachingSections));
    return res.json({ success: true, data });
  } catch (error: any) {
    console.error('Get student requests error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'STUDENT_REQUESTS_FAILED', message: error.message },
    });
  }
});

// Approve a single student, scoped to the instructor's own sections + teaching year levels
router.patch('/student-requests/:id/approve', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const scope = await getInstructorScope(req.user!.id);
    if (!scope) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Instructor account not found' } });
    const { sections: teachingSections, yearLevels: teachingYearLevels } = scope;

    if (!supabase) {
      return res.status(503).json({
        success: false,
        error: { code: 'DB_UNAVAILABLE', message: 'Database is unavailable.' },
      });
    }

    if (teachingSections.length === 0 || teachingYearLevels.length === 0) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Your instructor account has no section/year level assigned.' },
      });
    }

    const { data: student, error: studentError } = await supabase
      .from('users')
      .select('id, email, full_name, avatar_url, created_at, year_level, section, student_approved, approved_by_instructor_id')
      .eq('id', id)
      .eq('role', 'student')
      .in('year_level', teachingYearLevels)
      .maybeSingle();

    if (studentError || !student || !belongsToInstructorSection(student.section, teachingSections)) {
      return res.status(404).json({
        success: false,
        error: { code: 'STUDENT_NOT_FOUND', message: 'Student request not found for your section' },
      });
    }

    const { data, error } = await supabase
      .from('users')
      .update({ student_approved: true, approved_by_instructor_id: req.user!.id, updated_at: new Date().toISOString() })
      .eq('id', student.id)
      .select('id, email, full_name, avatar_url, created_at, year_level, section, student_approved, approved_by_instructor_id')
      .single();

    if (error || !data) throw error || new Error('Student approval update returned no data');

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
