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
      .select('id, email, full_name, avatar_url, role, xp_total, streak_days, year_level, teaching_year_levels, created_at, last_active')
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
    const { full_name, avatar_url, year_level, teaching_year_levels } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        },
      });
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (typeof full_name === 'string') updates.full_name = full_name;
    if (typeof avatar_url === 'string') updates.avatar_url = avatar_url;
    if (year_level === null || year_level === undefined) {
      // skip
    } else {
      const yl = Number(year_level);
      if (!Number.isInteger(yl) || yl < 1 || yl > 4) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_YEAR_LEVEL', message: 'year_level must be 1, 2, 3, or 4' },
        });
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
        if (!Number.isInteger(n) || n < 1 || n > 4) {
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_TEACHING_YEARS', message: 'Each teaching year must be 1, 2, 3, or 4' },
          });
        }
        if (!cleaned.includes(n)) cleaned.push(n);
      }
      cleaned.sort((a, b) => a - b);
      updates.teaching_year_levels = cleaned;
    }

    const { data: user, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select('id, email, full_name, avatar_url, role, xp_total, streak_days, year_level, teaching_year_levels, created_at, last_active');

    if (error) throw error;

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
    const userId = req.params.id || req.user?.id;

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
    const userId = req.params.id || req.user?.id;

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
