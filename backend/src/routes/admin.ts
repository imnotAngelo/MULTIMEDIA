import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { adminMiddleware } from '../middleware/admin.js';
import { supabase } from '../config/supabase.js';
import { listUsersByRole } from '../lib/userStore.js';

const router = Router();

function isTransientDatabaseError(error: any) {
  const message = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return message.includes('fetch failed') || message.includes('enotfound') || message.includes('network');
}

router.use(authMiddleware, adminMiddleware);

router.get('/instructor-requests', async (_req: AuthRequest, res: Response) => {
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, full_name, role, avatar_url, created_at, instructor_approved')
        .eq('role', 'instructor')
        .eq('instructor_approved', false)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return res.json({ success: true, data: data || [] });
    }

    return res.json({
      success: true,
      data: listUsersByRole('instructor').filter((user) => user.instructor_approved === false),
    });
  } catch (error: any) {
    if (isTransientDatabaseError(error)) {
      return res.json({
        success: true,
        data: listUsersByRole('instructor').filter((user) => user.instructor_approved === false),
      });
    }
    console.error('Get instructor requests error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INSTRUCTOR_REQUESTS_FAILED', message: error.message },
    });
  }
});

router.patch('/instructor-requests/:id/approve', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (supabase) {
      const { data, error } = await supabase
        .from('users')
        .update({ instructor_approved: true, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('role', 'instructor')
        .select('id, email, full_name, role, avatar_url, created_at, instructor_approved')
        .single();

      if (error || !data) {
        return res.status(404).json({
          success: false,
          error: { code: 'INSTRUCTOR_NOT_FOUND', message: 'Instructor request not found' },
        });
      }
      return res.json({ success: true, data });
    }

    return res.status(503).json({
      success: false,
      error: {
        code: 'DB_UNAVAILABLE',
        message: 'Instructor approval could not be saved because Supabase is unavailable.',
      },
    });
  } catch (error: any) {
    console.error('Approve instructor error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'APPROVE_INSTRUCTOR_FAILED', message: error.message },
    });
  }
});

export default router;