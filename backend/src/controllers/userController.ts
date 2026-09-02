import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { supabase } from '../config/supabase.js';

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
      .select('id, email, full_name, avatar_url, role, xp_total, streak_days, year_level, teaching_year_levels, section, teaching_sections, created_at, last_active')
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
          // For instructors: Archive ALL unarchived content (clean semester start)
          console.log(`  📝 Instructor mode: archiving ALL unarchived content for clean semester switch...`);

          // Step 1: Get instructor's courses
          const { data: courses } = await supabase
            .from('courses')
            .select('id')
            .eq('instructor_id', userId);

          if (courses && courses.length > 0) {
            const courseIds = courses.map(c => c.id);
            console.log(`  📝 Found ${courseIds.length} courses`);

            // Step 2: Get ALL unarchived modules for these courses
            const { data: modules } = await supabase
              .from('modules')
              .select('id')
              .in('course_id', courseIds)
              .neq('status', 'archived');

            if (modules && modules.length > 0) {
              const moduleIds = modules.map(m => m.id);
              
              // Archive all modules
              await supabase
                .from('modules')
                .update({ status: 'archived' })
                .in('id', moduleIds);
              console.log(`  ✅ Archived ${moduleIds.length} modules`);

              // Step 3: Archive all lessons in these modules
              await supabase
                .from('lessons')
                .update({ status: 'archived' })
                .in('module_id', moduleIds)
                .neq('status', 'archived');
              console.log(`  ✅ Archived lessons`);

              // Step 4: Archive all assessments in these modules
              await supabase
                .from('assessments')
                .update({ status: 'archived' })
                .in('module_id', moduleIds)
                .neq('status', 'archived');
              console.log(`  ✅ Archived assessments`);

              // Step 5: Archive all laboratories in these modules
              await supabase
                .from('laboratories')
                .update({ status: 'archived' })
                .in('unit_id', moduleIds)
                .neq('status', 'archived');
              console.log(`  ✅ Archived laboratories`);
            }
          }
        } else {
          // For students: Archive all their unarchived content (complete fresh start)
          console.log(`  📝 Student mode: archiving ALL unarchived content...`);

          // Archive all lessons
          await supabase
            .from('lessons')
            .update({ status: 'archived' })
            .neq('status', 'archived');

          // Archive all assessments
          await supabase
            .from('assessments')
            .update({ status: 'archived' })
            .neq('status', 'archived');

          // Archive all laboratories
          await supabase
            .from('laboratories')
            .update({ status: 'archived' })
            .neq('status', 'archived');

          console.log(`  ✅ Archived all student content`);
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
      .select('id, email, full_name, avatar_url, role, xp_total, streak_days, year_level, teaching_year_levels, section, teaching_sections, created_at, last_active');

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

    const { data: progress, error } = await supabase
      .from('user_progress')
      .select(`
        *,
        modules:module_id(id, title, lessons(id))
      `)
      .eq('user_id', userId);

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

    const { data: students, error } = await supabase
      .from('users')
      .select('id, email, full_name, avatar_url, xp_total, streak_days, last_active, created_at')
      .eq('role', 'student')
      .order('last_active', { ascending: false, nullsFirst: false });

    if (error) throw error;

    const now = Date.now();
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    const list = students ?? [];
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

    const [canvaResult, fileResult] = await Promise.all([
      supabase
        .from('canva_submissions')
        .select('id', { count: 'exact', head: true }),
      supabase
        .from('lab_file_submissions')
        .select('id', { count: 'exact', head: true }),
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

    const [totalRes, rowsRes] = await Promise.all([
      supabase
        .from('lesson_progress')
        .select('id', { count: 'exact', head: true })
        .eq('completed', true),
      supabase
        .from('lesson_progress')
        .select('lesson_id, student_id')
        .eq('completed', true),
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
      .select('id, full_name, avatar_url, xp_total, streak_days')
      .order('xp_total', { ascending: false })
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
          xp_total: u.xp_total,
          achievement_count: 0,
          streak_days: u.streak_days,
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
