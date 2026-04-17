import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { supabase } from '../config/supabase.js';

export const getCourses = async (req: AuthRequest, res: Response) => {
  try {
    const { search, instructor_id, page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const limitNum = Math.min(parseInt(limit as string) || 10, 50);
    const offset = (pageNum - 1) * limitNum;

    let query = supabase
      .from('courses')
      .select('*, instructor:instructor_id(id, full_name), modules(id)', { count: 'exact' });

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    if (instructor_id) {
      query = query.eq('instructor_id', instructor_id);
    }

    const { data: courses, count, error } = await query
      .eq('status', 'published')
      .range(offset, offset + limitNum - 1);

    if (error) throw error;

    return res.json({
      success: true,
      data: {
        courses: courses || [],
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limitNum),
        },
      },
    });
  } catch (error: any) {
    console.error('Get courses error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_FAILED',
        message: error.message,
      },
    });
  }
};

export const getCourseById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const { data: course, error } = await supabase
      .from('courses')
      .select(`
        *,
        instructor:instructor_id(id, full_name),
        modules(
          id,
          title,
          description,
          order,
          lessons(id, title, order)
        )
      `)
      .eq('id', id)
      .single();

    if (error || !course) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'COURSE_NOT_FOUND',
          message: 'Course not found',
        },
      });
    }

    return res.json({
      success: true,
      data: course,
    });
  } catch (error: any) {
    console.error('Get course error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_FAILED',
        message: error.message,
      },
    });
  }
};

export const getLessons = async (req: AuthRequest, res: Response) => {
  try {
    const { courseId, moduleId, page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const limitNum = Math.min(parseInt(limit as string) || 10, 50);
    const offset = (pageNum - 1) * limitNum;

    let query = supabase
      .from('lessons')
      .select('*, module:module_id(id, title)', { count: 'exact' });

    if (moduleId) {
      query = query.eq('module_id', moduleId);
    }

    const { data: lessons, count, error } = await query
      .range(offset, offset + limitNum - 1)
      .order('order', { ascending: true });

    if (error) throw error;

    return res.json({
      success: true,
      data: {
        lessons: lessons || [],
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limitNum),
        },
      },
    });
  } catch (error: any) {
    console.error('Get lessons error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_FAILED',
        message: error.message,
      },
    });
  }
};
