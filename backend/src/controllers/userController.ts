import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { supabase } from '../config/supabase.js';

async function getInstructorOwnedModuleIds(instructorId: string): Promise<string[]> {
  const { data: courses, error: coursesError } = await supabase
    .from('courses')
    .select('id')
    .eq('instructor_id', instructorId);
  if (coursesError) throw coursesError;
  const courseIds = (courses ?? []).map((course) => course.id);
  if (courseIds.length === 0) return [];

  const { data: modules, error: modulesError } = await supabase
    .from('modules')
    .select('id')
    .in('course_id', courseIds);
  if (modulesError) throw modulesError;
  return (modules ?? []).map((module) => module.id);
}

export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        },
      });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, full_name, avatar_url, role, year_level, teaching_year_levels, section, teaching_sections, created_at, last_active')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    return res.json({
      success: true,
      data: user,
    });
  } catch (error: any) {
    console.error('Get profile error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: error.message,
      },
    });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { full_name, avatar_url, year_level, teaching_year_levels, teaching_sections } = req.body;

    console.log(`🔄 UPDATE PROFILE: userId=${userId}, year_level=${year_level}, teaching_year_levels=${JSON.stringify(teaching_year_levels)}`);

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        },
      });
    }

    // Get the current user to check if year_level is changing
    const { data: currentUser, error: getUserError } = await supabase
      .from('users')
      .select('year_level, role')
      .eq('id', userId)
      .single();

    if (getUserError || !currentUser) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    console.log(`  Current user - year_level=${currentUser.year_level}, role=${currentUser.role}`);

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (typeof full_name === 'string') updates.full_name = full_name;
    if (typeof avatar_url === 'string') updates.avatar_url = avatar_url;
    
    let oldYearLevel: number | null = null;
    let shouldArchive = false;

    if (year_level === null || year_level === undefined) {
      console.log(`  ⏭️  year_level not provided in request`);
    } else {
      const yl = Number(year_level);
      console.log(`  🔍 Validating year_level: received=${year_level}, parsed=${yl}`);
      if (!Number.isInteger(yl) || yl < 1 || yl > 3) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_YEAR_LEVEL', message: 'year_level must be 1, 2, or 3' },
        });
      }
      if (currentUser.year_level && currentUser.year_level !== yl) {
        oldYearLevel = currentUser.year_level;
        shouldArchive = true;
        console.log(`  🔄 SEMESTER CHANGE DETECTED: ${oldYearLevel} → ${yl}`);
      } else {
        console.log(`  ℹ️  No semester change: current=${currentUser.year_level}, new=${yl}`);
      }
      updates.year_level = yl;
    }
    
    if (teaching_year_levels !== undefined) {
      if (!Array.isArray(teaching_year_levels)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_TEACHING_YEARS', message: 'teaching_year_levels must be an array' },
        });
      }
      const cleaned: number[] = [];
      for (const v of teaching_year_levels) {
        const n = Number(v);
        if (!Number.isInteger(n) || n < 1 || n > 3) {
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_TEACHING_YEARS', message: 'Each teaching year must be 1, 2, or 3' },
          });
        }
        if (!cleaned.includes(n)) cleaned.push(n);
      }
      cleaned.sort((a, b) => a - b);
      updates.teaching_year_levels = cleaned;
    }
    
    if (teaching_sections !== undefined) {
      if (!Array.isArray(teaching_sections)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_TEACHING_SECTIONS', message: 'teaching_sections must be an array' },
        });
      }
      const cleanedSections: string[] = [];
      for (const v of teaching_sections) {
        const trimmed = typeof v === 'string' ? v.trim() : '';
        if (!trimmed || trimmed.length > 50) {
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_TEACHING_SECTIONS', message: 'Each section must be 1-50 characters' },
          });
        }
        if (!cleanedSections.includes(trimmed)) cleanedSections.push(trimmed);
      }
      updates.teaching_sections = cleanedSections;
    }

    // If semester is changing for a student or instructor, archive old semester content
    if (shouldArchive && oldYearLevel) {
      try {
        console.log(`📦 ARCHIVING: ${currentUser.role} ${userId} changing from semester ${oldYearLevel} to ${updates.year_level}`);

        if (currentUser.role === 'instructor') {
          // For instructors: Archive ALL unarchived content and clear student progress
          console.log(`  📝 Instructor mode: archiving ALL unarchived content for clean semester switch...`);

          const startTime = Date.now();
          const TIMEOUT_MS = 30000; // 30 second timeout

          // Step 1: Get instructor's courses
          const { data: courses } = await supabase
            .from('courses')
            .select('id')
            .eq('instructor_id', userId);

          if (courses && courses.length > 0) {
            const courseIds = courses.map(c => c.id);
            console.log(`  📝 Found ${courseIds.length} courses`);

            const { data: modules } = await supabase
              .from('modules')
              .select('id')
              .in('course_id', courseIds)
              .neq('status', 'archived');

            const moduleIds = modules?.map(m => m.id) || [];
            if (moduleIds.length === 0) {
              console.log('  ℹ️ No active modules found for these courses');
            }

            // Fetch content using module IDs, which are the actual parent IDs.
            const [
              { data: lessons },
              { data: assessments },
              { data: laboratories }
            ] = moduleIds.length > 0 ? await Promise.all([
              supabase.from('lessons').select('id').in('module_id', moduleIds).neq('status', 'archived'),
              supabase.from('assessments').select('id').in('module_id', moduleIds).neq('status', 'archived'),
              supabase.from('laboratories').select('id').in('unit_id', moduleIds).neq('status', 'archived'),
            ]) : [{ data: [] }, { data: [] }, { data: [] }];

            const lessonIds = lessons?.map(l => l.id) || [];
            const assessmentIds = assessments?.map(a => a.id) || [];
            const labIds = laboratories?.map(l => l.id) || [];

            console.log(`  📝 Archiving: ${moduleIds.length} modules, ${lessonIds.length} lessons, ${assessmentIds.length} assessments, ${labIds.length} labs`);

            // Archive all content in parallel
            await Promise.all([
              moduleIds.length > 0 ? supabase.from('modules').update({ status: 'archived' }).in('id', moduleIds) : Promise.resolve(),
              lessonIds.length > 0 ? supabase.from('lessons').update({ status: 'archived' }).in('id', lessonIds) : Promise.resolve(),
              assessmentIds.length > 0 ? supabase.from('assessments').update({ status: 'archived' }).in('id', assessmentIds) : Promise.resolve(),
              labIds.length > 0 ? supabase.from('laboratories').update({ status: 'archived' }).in('id', labIds) : Promise.resolve(),
            ]);

            // Clear student progress
            if (lessonIds.length > 0) {
              await supabase.from('lesson_progress').delete().in('lesson_id', lessonIds);
            }
            if (labIds.length > 0) {
              await supabase.from('laboratory_submissions').delete().in('laboratory_id', labIds);
            }
            if (assessmentIds.length > 0) {
              await supabase.from('assessment_submissions').delete().in('assessment_id', assessmentIds);
            }

            console.log(`  ✅ All content archived and progress cleared`);
          }
        } else {
          // For students: Archive their old semester content by year_level
          console.log(`  📝 Student mode: archiving student's ${oldYearLevel} semester content...`);

          // Get all content that matches the OLD year_level
          const [
            { data: oldLessons },
            { data: oldAssessments },
            { data: oldLaboratories }
          ] = await Promise.all([
            supabase.from('lessons').select('id').eq('year_level', oldYearLevel).neq('status', 'archived'),
            supabase.from('assessments').select('id').eq('year_level', oldYearLevel).neq('status', 'archived'),
            supabase.from('laboratories').select('id').eq('year_level', oldYearLevel).neq('status', 'archived'),
          ]);

          const oldLessonIds = oldLessons?.map(l => l.id) || [];
          const oldAssessmentIds = oldAssessments?.map(a => a.id) || [];
          const oldLabIds = oldLaboratories?.map(l => l.id) || [];

          console.log(`  📝 Archiving ${oldYearLevel} semester: ${oldLessonIds.length} lessons, ${oldAssessmentIds.length} assessments, ${oldLabIds.length} labs`);

          // Archive old content and reset lesson progress. Keep submissions linked
          // to the archived assessments and laboratories for historical review.
          await Promise.all([
            oldLessonIds.length > 0 ? supabase.from('lessons').update({ status: 'archived' }).in('id', oldLessonIds) : Promise.resolve(),
            oldAssessmentIds.length > 0 ? supabase.from('assessments').update({ status: 'archived' }).in('id', oldAssessmentIds) : Promise.resolve(),
            oldLabIds.length > 0 ? supabase.from('laboratories').update({ status: 'archived' }).in('id', oldLabIds) : Promise.resolve(),
            oldLessonIds.length > 0 ? supabase.from('lesson_progress').delete().in('lesson_id', oldLessonIds) : Promise.resolve(),
          ]);

          console.log(`  ✅ Student's ${oldYearLevel} semester archived; submissions preserved and lesson progress cleared`);
        }

        console.log(`📦 ARCHIVING COMPLETE for ${currentUser.role} ${userId}`);
      } catch (archiveError: any) {
        console.error('❌ Error during archiving:', archiveError.message);
        // Continue even if archiving fails - don't block user profile update
      }
    } else {
      console.log(`⏭️  SKIP ARCHIVING: shouldArchive=${shouldArchive}, oldYearLevel=${oldYearLevel}, role=${currentUser.role}`);
    }

    const { data: user, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select('id, email, full_name, avatar_url, role, year_level, teaching_year_levels, section, teaching_sections, created_at, last_active');

    if (error) {
      console.error(`❌ Database update error:`, error);
      throw error;
    }

    console.log(`✅ PROFILE UPDATED: year_level=${user[0]?.year_level}`);

    return res.json({
      success: true,
      data: user[0],
    });
  } catch (error: any) {
    console.error('Update profile error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_FAILED',
        message: error.message,
      },
    });
  }
};

export const getProgress = async (req: AuthRequest, res: Response) => {
  try {
    const requestedId = req.params.id;
    const userId = requestedId || req.user?.id;

    if (requestedId && requestedId !== req.user?.id && req.user?.role !== 'instructor' && req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You can only view your own progress' },
      });
    }

    let ownedModuleIds: string[] | null = null;
    if (requestedId && requestedId !== req.user?.id && req.user?.role === 'instructor') {
      ownedModuleIds = await getInstructorOwnedModuleIds(req.user.id);
      if (ownedModuleIds.length === 0) {
        return res.json({ success: true, data: { overall_progress: 0, total_lessons: 0, completed_lessons: 0, modules_progress: [] } });
      }
    }

    let progressQuery = supabase
      .from('user_progress')
      .select(`
        *,
        modules:module_id(id, title, lessons(id))
      `)
      .eq('user_id', userId);
    if (ownedModuleIds) progressQuery = progressQuery.in('module_id', ownedModuleIds);
    const { data: progress, error } = await progressQuery;

    if (error) throw error;

    const completed = progress?.filter((p) => p.completed).length || 0;
    const total = progress?.length || 0;

    return res.json({
      success: true,
      data: {
        overall_progress: total > 0 ? Math.round((completed / total) * 100) : 0,
        total_lessons: total,
        completed_lessons: completed,
        modules_progress: progress || [],
      },
    });
  } catch (error: any) {
    console.error('Get progress error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_FAILED',
        message: error.message,
      },
    });
  }
};

export const getAchievements = async (req: AuthRequest, res: Response) => {
  try {
    const requestedId = req.params.id;
    const userId = requestedId || req.user?.id;

    if (requestedId && requestedId !== req.user?.id && req.user?.role !== 'instructor' && req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You can only view your own achievements' },
      });
    }

    if (requestedId && requestedId !== req.user?.id && req.user?.role === 'instructor') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Instructor access to student achievements is not available' },
      });
    }

    const { data: achievements, error } = await supabase
      .from('user_achievements')
      .select('achievements(*), earned_at')
      .eq('user_id', userId);

    if (error) throw error;

    const totalXp = achievements?.reduce((sum, a: any) => sum + (a.achievements?.xp_reward || 0), 0) || 0;

    return res.json({
      success: true,
      data: {
        achievements: achievements || [],
        total_xp_from_achievements: totalXp,
      },
    });
  } catch (error: any) {
    console.error('Get achievements error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_FAILED',
        message: error.message,
      },
    });
  }
};

/**
 * GET /api/users/students
 * Instructor-only. Returns all users with role='student' plus an "active" count.
 * A student is "active" if last_active is within the last 30 days.
 */
export const getStudents = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'instructor') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Instructor role required' },
      });
    }

    const { data: instructor, error: instructorError } = await supabase
      .from('users')
      .select('role, section, teaching_sections, teaching_year_levels')
      .eq('id', req.user.id)
      .maybeSingle();
    if (instructorError) throw instructorError;
    if (!instructor || instructor.role !== 'instructor') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Instructor account not found' },
      });
    }

    const teachingSections = Array.isArray(instructor.teaching_sections) && instructor.teaching_sections.length
      ? instructor.teaching_sections
      : (instructor.section ? [instructor.section] : []);
    const teachingYearLevels = Array.isArray(instructor.teaching_year_levels)
      ? instructor.teaching_year_levels.map(Number).filter(Number.isInteger)
      : [];
    if (teachingSections.length === 0 || teachingYearLevels.length === 0) {
      return res.json({ success: true, data: { total: 0, active: 0, students: [] } });
    }

    const { data: students, error } = await supabase
      .from('users')
      .select('id, email, full_name, avatar_url, last_active, created_at, year_level, section, student_approved, approved_by_instructor_id')
      .eq('role', 'student')
      .in('year_level', teachingYearLevels)
      .order('last_active', { ascending: false, nullsFirst: false });

    if (error) throw error;

    const now = Date.now();
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    const normalizedTeachingSections = teachingSections.map((section) => String(section).trim().toLowerCase());
    const list = (students ?? []).filter((student) =>
      normalizedTeachingSections.includes(String(student.section ?? '').trim().toLowerCase())
    );
    const activeList = list.filter((s) => {
      if (!s.last_active) return false;
      const t = new Date(s.last_active).getTime();
      return Number.isFinite(t) && now - t <= THIRTY_DAYS;
    });

    return res.json({
      success: true,
      data: {
        total: list.length,
        active: activeList.length,
        students: list,
      },
    });
  } catch (error: any) {
    console.error('Get students error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'FETCH_FAILED', message: error.message },
    });
  }
};

/**
 * GET /api/users/section-students
 * Returns the number of students in the authenticated student's section and year.
 */
/**
 * GET /api/users/submissions/stats
 * Instructor-only. Returns total submission counts across all students,
 * combining canva/laboratory link submissions and file submissions.
 */
export const getSubmissionStats = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'instructor') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Instructor role required' },
      });
    }

    const { data: ownedLabs, error: labsError } = await supabase
      .from('laboratories')
      .select('id')
      .eq('instructor_id', req.user.id);
    if (labsError) throw labsError;
    const ownedLabIds = (ownedLabs ?? []).map((lab) => lab.id);

    if (ownedLabIds.length === 0) {
      return res.json({ success: true, data: { total: 0, canva: 0, files: 0 } });
    }

    const [canvaResult, fileResult] = await Promise.all([
      supabase
        .from('canva_submissions')
        .select('id', { count: 'exact', head: true })
        .in('laboratory_id', ownedLabIds),
      supabase
        .from('lab_file_submissions')
        .select('id', { count: 'exact', head: true })
        .in('lab_id', ownedLabIds),
    ]);

    const canvaCount = canvaResult.error ? 0 : canvaResult.count ?? 0;
    const fileCount = fileResult.error ? 0 : fileResult.count ?? 0;

    if (canvaResult.error) {
      console.warn('canva_submissions count error:', canvaResult.error.message);
    }
    if (fileResult.error) {
      console.warn('lab_file_submissions count error:', fileResult.error.message);
    }

    return res.json({
      success: true,
      data: {
        total: canvaCount + fileCount,
        canva: canvaCount,
        files: fileCount,
      },
    });
  } catch (error: any) {
    console.error('Get submission stats error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'FETCH_FAILED', message: error.message },
    });
  }
};

/**
 * POST /api/users/lesson-progress
 * Body: { lessonId: string, completed?: boolean }
 * Marks a lesson as completed (or un-completed) for the authenticated student.
 */
export const upsertLessonProgress = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });
    }
    const { lessonId, completed = true } = req.body ?? {};
    if (!lessonId) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'lessonId is required' },
      });
    }

    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('lesson_progress')
      .upsert(
        {
          student_id: userId,
          lesson_id: lessonId,
          completed: !!completed,
          completed_at: completed ? nowIso : null,
          updated_at: nowIso,
        },
        { onConflict: 'student_id,lesson_id' }
      )
      .select()
      .single();

    if (error) throw error;
    return res.json({ success: true, data });
  } catch (error: any) {
    console.error('Upsert lesson progress error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SAVE_FAILED', message: error.message },
    });
  }
};

/**
 * GET /api/users/lesson-progress/me
 * Returns the authenticated student's completed lesson IDs.
 */
export const getMyLessonProgress = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });
    }
    const { data, error } = await supabase
      .from('lesson_progress')
      .select('lesson_id, completed, completed_at')
      .eq('student_id', userId)
      .eq('completed', true);

    if (error) throw error;
    const list = data ?? [];
    return res.json({
      success: true,
      data: {
        total: list.length,
        lessonIds: list.map((r) => r.lesson_id),
        items: list,
      },
    });
  } catch (error: any) {
    console.error('Get my lesson progress error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'FETCH_FAILED', message: error.message },
    });
  }
};

/**
 * GET /api/users/lesson-progress/stats
 * Instructor-only. Returns total completion count across all students,
 * plus distinct lessons that have at least one completion.
 */
export const getLessonProgressStats = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'instructor') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Instructor role required' },
      });
    }

    const moduleIds = await getInstructorOwnedModuleIds(req.user.id);
    if (moduleIds.length === 0) {
      return res.json({ success: true, data: { totalCompletions: 0, distinctLessonsCompleted: 0, distinctStudentsWithCompletions: 0 } });
    }

    const { data: ownedLessons, error: lessonsError } = await supabase
      .from('lessons')
      .select('id')
      .in('module_id', moduleIds);
    if (lessonsError) throw lessonsError;
    const lessonIds = (ownedLessons ?? []).map((lesson) => lesson.id);
    if (lessonIds.length === 0) {
      return res.json({ success: true, data: { totalCompletions: 0, distinctLessonsCompleted: 0, distinctStudentsWithCompletions: 0 } });
    }

    const [totalRes, rowsRes] = await Promise.all([
      supabase
        .from('lesson_progress')
        .select('id', { count: 'exact', head: true })
        .eq('completed', true)
        .in('lesson_id', lessonIds),
      supabase
        .from('lesson_progress')
        .select('lesson_id, student_id')
        .eq('completed', true)
        .in('lesson_id', lessonIds),
    ]);

    if (totalRes.error) {
      console.warn('lesson_progress count error:', totalRes.error.message);
    }
    if (rowsRes.error) {
      console.warn('lesson_progress rows error:', rowsRes.error.message);
    }

    const rows = rowsRes.data ?? [];
    const distinctLessons = new Set(rows.map((r) => r.lesson_id)).size;
    const distinctStudents = new Set(rows.map((r) => r.student_id)).size;

    return res.json({
      success: true,
      data: {
        totalCompletions: totalRes.count ?? rows.length,
        distinctLessonsCompleted: distinctLessons,
        distinctStudentsWithCompletions: distinctStudents,
      },
    });
  } catch (error: any) {
    console.error('Lesson progress stats error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'FETCH_FAILED', message: error.message },
    });
  }
};

export const getLeaderboard = async (req: AuthRequest, res: Response) => {
  try {
    const { period = 'all-time', limit = 10 } = req.query;
    const parsedLimit = Math.min(parseInt(limit as string) || 10, 100);

    const { data: leaderboard, error } = await supabase
      .from('users')
      .select('id, full_name, avatar_url, last_active')
      .order('last_active', { ascending: false, nullsFirst: false })
      .limit(parsedLimit);

    if (error) throw error;

    const userRank =
      leaderboard?.findIndex((u) => u.id === req.user?.id) || -1;

    return res.json({
      success: true,
      data: {
        leaderboard: leaderboard?.map((u, idx) => ({
          rank: idx + 1,
          user_id: u.id,
          full_name: u.full_name,
          avatar_url: u.avatar_url,
          achievement_count: 0,
        })) || [],
        user_rank: userRank > -1 ? userRank + 1 : -1,
      },
    });
  } catch (error: any) {
    console.error('Get leaderboard error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_FAILED',
        message: error.message,
      },
    });
  }
};

/**
 * Update instructor's semester/year level and clear all student progress
 * Resets lesson progress while preserving laboratory and quiz submissions
 * linked to the archived content.
 */
export const updateSemesterAndClearProgress = async (req: AuthRequest, res: Response) => {
  const startTime = Date.now();
  const TIMEOUT_MS = 30000; // 30 second timeout
  
  try {
    const instructorId = req.user?.id;
    const { teaching_year_levels, teaching_sections } = req.body;
    const selectedSemester = Array.isArray(teaching_year_levels) ? Number(teaching_year_levels[0]) : NaN;

    if (!instructorId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        },
      });
    }

    // Verify user is an instructor
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', instructorId)
      .single();

    if (userError || !user || user.role !== 'instructor') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only instructors can update semester',
        },
      });
    }

    console.log(`\n🔄 SEMESTER UPDATE: Instructor ${instructorId}`);
    console.log(`   New teaching_year_levels: ${JSON.stringify(teaching_year_levels)}`);
    console.log(`   New teaching_sections: ${JSON.stringify(teaching_sections)}`);

    const results: any = {
      timestamp: new Date().toISOString(),
      instructor_id: instructorId,
      steps: [],
      archived: {
        units: 0,
        lessons: 0,
        laboratories: 0,
        assessments: 0,
      },
      cleared: {
        lesson_progress: 0,
        lab_submissions: 0,
        assessment_submissions: 0,
      },
    };

    // Helper function to check timeout
    const checkTimeout = () => {
      if (Date.now() - startTime > TIMEOUT_MS) {
        throw new Error('Semester update operation timed out after 30 seconds');
      }
    };

    // Step 1: Update instructor's teaching years and sections
    console.log(`\n📝 Step 1: Updating instructor profile...`);
    checkTimeout();
    const { error: updateError } = await supabase
      .from('users')
      .update({
        ...(Number.isInteger(selectedSemester) ? { year_level: selectedSemester } : {}),
        teaching_year_levels: teaching_year_levels || [],
        teaching_sections: teaching_sections || [],
        updated_at: new Date().toISOString(),
      })
      .eq('id', instructorId);

    if (updateError) {
      console.error(`   ❌ ERROR: ${updateError.message}`);
      return res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: `Failed to update instructor profile: ${updateError.message}`,
        },
      });
    }
    console.log(`   ✅ Instructor profile updated`);
    results.steps.push({ name: 'Update instructor profile', status: 'success' });

    // Step 2: Get all modules created by this instructor
    console.log(`\n📝 Step 2: Fetching instructor's modules...`);
    checkTimeout();
    const { data: courses, error: coursesError } = await supabase
      .from('courses')
      .select('id')
      .eq('instructor_id', instructorId);

    if (coursesError) {
      console.error(`   ❌ ERROR: ${coursesError.message}`);
      return res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: `Failed to fetch courses: ${coursesError.message}`,
        },
      });
    }

    const courseIds = courses?.map(c => c.id) || [];
    const { data: modules, error: modulesError } = courseIds.length > 0
      ? await supabase
        .from('modules')
        .select('id')
        .in('course_id', courseIds)
        .neq('status', 'archived')
      : { data: [], error: null };

    if (modulesError) {
      throw new Error(`Failed to fetch modules: ${modulesError.message}`);
    }

    const moduleIds = modules?.map(m => m.id) || [];
    let archiveModuleIds = moduleIds;

    // Older records may have been created through the shared/default course,
    // so they are visible in the dashboard but not linked to this instructor's
    // course row. Archive those visible active modules as a compatibility fallback.
    if (archiveModuleIds.length === 0) {
      const { data: visibleModules, error: visibleModulesError } = await supabase
        .from('modules')
        .select('id')
        .neq('status', 'archived');

      if (visibleModulesError) {
        throw new Error(`Failed to find active modules: ${visibleModulesError.message}`);
      }

      archiveModuleIds = visibleModules?.map(m => m.id) || [];
      console.warn(`   ⚠️ No modules linked to instructor courses; using ${archiveModuleIds.length} active shared modules`);
    }
    console.log(`   ✅ Found ${courseIds.length} courses and ${archiveModuleIds.length} active modules`);
    results.steps.push({ name: 'Fetch instructor modules', count: archiveModuleIds.length, status: 'success' });

    const { data: ownedAssessments, error: ownedAssessmentsError } = await supabase
      .from('assessments')
      .select('id')
      .eq('created_by', instructorId)
      .neq('status', 'archived');

    if (ownedAssessmentsError) {
      throw new Error(`Failed to fetch instructor assessments: ${ownedAssessmentsError.message}`);
    }

    if (archiveModuleIds.length === 0 && !ownedAssessments?.length) {
      return res.json({
        success: true,
        message: 'Semester updated successfully (no content to archive)',
        data: results,
      });
    }

    // Step 3: Fetch all lessons and assessments in one go
    console.log(`\n📝 Step 3: Fetching instructor's content (lessons, labs, assessments)...`);
    checkTimeout();
    const [
      { data: lessons, error: lessonsError },
      { data: labs, error: labsError },
      { data: assessments, error: assessError }
    ] = await Promise.all([
      archiveModuleIds.length > 0
        ? supabase.from('lessons').select('id').in('module_id', archiveModuleIds)
        : Promise.resolve({ data: [], error: null }),
      archiveModuleIds.length > 0
        ? supabase.from('laboratories').select('id').in('unit_id', archiveModuleIds)
        : Promise.resolve({ data: [], error: null }),
      archiveModuleIds.length > 0
        ? supabase.from('assessments').select('id').in('module_id', archiveModuleIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const lessonIds = lessons?.map(l => l.id) || [];
    const labIds = labs?.map(l => l.id) || [];
    const assessmentIds = [...new Set([
      ...(assessments?.map(a => a.id) || []),
      ...(ownedAssessments?.map(a => a.id) || []),
    ])];

    console.log(`   ✅ Found ${lessonIds.length} lessons, ${labIds.length} labs, ${assessmentIds.length} assessments`);
    results.steps.push({ 
      name: 'Fetch content', 
      lessons: lessonIds.length,
      labs: labIds.length,
      assessments: assessmentIds.length,
      status: 'success' 
    });

    // Step 4-10: PARALLEL archive all content and clear all progress at once
    console.log(`\n📝 Step 4-10: Archiving all content and clearing progress in parallel...`);
    checkTimeout();
    
    const archiveAndClearPromises: Promise<any>[] = [];

    // Archive operations
    if (archiveModuleIds.length > 0) {
      archiveAndClearPromises.push(
        supabase.from('modules').update({ status: 'archived' }).in('id', archiveModuleIds)
          .then(res => ({ type: 'archive_units', result: res }))
      );
    }

    if (lessonIds.length > 0) {
      archiveAndClearPromises.push(
        supabase.from('lessons').update({ status: 'archived' }).in('id', lessonIds)
          .then(res => ({ type: 'archive_lessons', result: res }))
      );
    }

    if (labIds.length > 0) {
      archiveAndClearPromises.push(
        supabase.from('laboratories').update({ status: 'archived' }).in('id', labIds)
          .then(res => ({ type: 'archive_labs', result: res }))
      );
    }

    if (assessmentIds.length > 0) {
      archiveAndClearPromises.push(
        supabase.from('assessments').update({ status: 'archived' }).in('id', assessmentIds)
          .then(res => ({ type: 'archive_assessments', result: res }))
      );
    }

    // Clear lesson progress only. Keep lab and quiz submissions linked to
    // archived content so the previous semester remains reviewable.
    if (lessonIds.length > 0) {
      archiveAndClearPromises.push(
        supabase.from('lesson_progress').delete().in('lesson_id', lessonIds)
          .then(res => ({ type: 'clear_lesson_progress', result: res }))
      );
    }

    // Execute all operations in parallel
    const allResults = await Promise.all(archiveAndClearPromises);

    // Process results
    for (const res of allResults) {
      checkTimeout();
      const { type, result } = res;
      const { error, count } = result;

      if (error) {
        if (type === 'archive_labs' && /status.*column|column.*status|schema cache/i.test(error.message || '')) {
          throw new Error('Laboratory archiving is not configured. Run backend/setup-archiving.sql in Supabase, then try again.');
        }
        throw new Error(`${type} failed: ${error.message}`);
      } else {
        const finalCount = count || 0;
        console.log(`   ✅ ${type}: ${finalCount} items processed`);
        
        if (type === 'archive_units') results.archived.units = finalCount;
        else if (type === 'archive_lessons') results.archived.lessons = finalCount;
        else if (type === 'archive_labs') results.archived.laboratories = finalCount;
        else if (type === 'archive_assessments') results.archived.assessments = finalCount;
        else if (type === 'clear_lesson_progress') results.cleared.lesson_progress = finalCount;
      }
    }

    results.steps.push({ name: 'Archive and clear all (parallel)', status: 'success' });

    const { data: remainingActiveModules, error: verifyError } = await supabase
      .from('modules')
      .select('id')
      .in('id', archiveModuleIds)
      .neq('status', 'archived');

    if (verifyError) {
      throw new Error(`Could not verify archived modules: ${verifyError.message}`);
    }

    if ((remainingActiveModules?.length || 0) > 0) {
      throw new Error(`Archive verification failed: ${remainingActiveModules!.length} module(s) remain active`);
    }

    const { data: remainingActiveAssessments, error: assessmentVerifyError } = assessmentIds.length > 0
      ? await supabase
        .from('assessments')
        .select('id')
        .in('id', assessmentIds)
        .neq('status', 'archived')
      : { data: [], error: null };

    if (assessmentVerifyError) {
      throw new Error(`Could not verify archived quizzes: ${assessmentVerifyError.message}`);
    }

    if ((remainingActiveAssessments?.length || 0) > 0) {
      throw new Error(`Quiz archive verification failed: ${remainingActiveAssessments!.length} quiz(zes) remain active`);
    }

    console.log(`\n✅ SEMESTER UPDATE COMPLETE (${Date.now() - startTime}ms)`);
    console.log(`   📦 Archived: ${results.archived.units} units, ${results.archived.lessons} lessons, ${results.archived.laboratories} labs, ${results.archived.assessments} assessments`);
    console.log(`   🗑️  Cleared: ${results.cleared.lesson_progress} lesson progress; lab and quiz submissions preserved`);

    return res.json({
      success: true,
      message: 'Semester updated and all content archived successfully',
      data: results,
    });
  } catch (error: any) {
    console.error('❌ Semester update error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: error.message || 'Semester update failed',
      },
    });
  }
};
