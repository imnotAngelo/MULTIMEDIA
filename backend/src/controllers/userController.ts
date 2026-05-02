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
