import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { supabase } from '../config/supabase.js';

const router = Router();

function isSupabaseUnavailableError(error: any): boolean {
  return !error || !supabase || error?.code === 'PGRST116' || error?.message?.includes('does not exist') || error?.message?.includes('relation') || error?.message?.includes('not found');
}

function logNotificationFallback(reason: string, details?: unknown) {
  console.warn(`[notifications] ${reason}`, details ?? '');
}

// --- Multer setup for announcement attachments ---
const announcementUploadsDir = path.join(process.cwd(), 'uploads', 'announcements');
if (!fs.existsSync(announcementUploadsDir)) {
  fs.mkdirSync(announcementUploadsDir, { recursive: true });
}

const announcementStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, announcementUploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const announcementUpload = multer({
  storage: announcementStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

/**
 * GET /api/notifications
 * Returns the last 50 notifications for the authenticated user.
 */
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    if (!supabase) {
      logNotificationFallback('Supabase is not configured; returning an empty notification list.');
      return res.json([]);
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      if (isSupabaseUnavailableError(error)) {
        logNotificationFallback('Notifications table is unavailable; returning an empty notification list.', error.message);
        return res.json([]);
      }
      throw error;
    }

    res.json(data ?? []);
  } catch (err: any) {
    logNotificationFallback('Failed to load notifications; returning an empty notification list.', err?.message);
    res.json([]);
  }
});

/**
 * GET /api/notifications/announcements
 * Shared announcement feed used by the Messages group chat.
 */
router.get('/announcements', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    if (!supabase) return res.json([]);

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('type', 'announcement')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw error;

    // Broadcasts are stored once per student, so show one copy in the group feed.
    const unique = new Map<string, any>();
    for (const item of data ?? []) {
      const key = `${item.sender_id}:${item.created_at}:${item.title}:${item.message}`;
      if (!unique.has(key)) unique.set(key, item);
    }

    res.json([...unique.values()].map((item: any) => ({
      ...item,
      context_type: item.context_type ?? null,
      context_id: item.context_id ?? null,
      context_name: item.context_name ?? null,
    })));
  } catch (err: any) {
    if (isSupabaseUnavailableError(err)) {
      logNotificationFallback('Announcement table is unavailable; returning an empty feed.', err?.message);
      return res.json([]);
    }
    console.error('Error loading announcement feed:', err);
    res.status(500).json({ error: err?.message || 'Failed to load announcements' });
  }
});

/**
 * POST /api/notifications
 * Instructor broadcasts a notification to all students (or a specific role).
 * Body: { type, title, message, recipientRole?, attachmentUrl?, attachmentName? }
 */
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const senderId = req.user?.id;
    if (!senderId) return res.status(401).json({ error: 'Unauthorized' });

    const { type, title, message, recipientRole = 'student', attachmentUrl, attachmentName } = req.body ?? {};
    if (!type || !title || !message) {
      return res.status(400).json({ error: 'type, title, and message are required' });
    }

    if (!supabase) {
      logNotificationFallback('Supabase is not configured; skipping notification creation.');
      return res.json({ sent: 0, skipped: true });
    }

    // Fetch all target recipients
    const { data: recipients, error: rErr } = await supabase
      .from('users')
      .select('id')
      .eq('role', recipientRole);

    if (rErr) throw rErr;

    const rows = (recipients ?? []).map((r: any) => ({
      recipient_id: r.id,
      sender_id: senderId,
      type,
      title,
      message,
      attachment_url: attachmentUrl ?? null,
      attachment_name: attachmentName ?? null,
    }));

    if (rows.length === 0) return res.json({ sent: 0 });

    const { error: insErr } = await supabase.from('notifications').insert(rows);
    if (insErr) {
      if (isSupabaseUnavailableError(insErr)) {
        logNotificationFallback('Could not create notification because the notifications table is unavailable.', insErr.message);
        return res.json({ sent: 0, skipped: true });
      }
      throw insErr;
    }

    res.json({ sent: rows.length });
  } catch (err: any) {
    logNotificationFallback('Error creating notification; returning a no-op response.', err?.message);
    res.json({ sent: 0, skipped: true });
  }
});

/**
 * POST /api/notifications/announcement
 * Instructor posts an announcement with an optional file attachment.
 * Accepts multipart/form-data: file (optional), title, message
 */
router.post(
  '/announcement',
  authMiddleware,
  (req: AuthRequest, res: Response) => {
    announcementUpload.single('file')(req, res, async (err) => {
      if (err) {
        console.error('Multer error:', err);
        return res.status(400).json({ error: err.message });
      }
      try {
        const senderId = req.user?.id;
        if (!senderId) return res.status(401).json({ error: 'Unauthorized' });

        const { title, message, contextType, contextId, contextName } = req.body ?? {};
        if (!title || !message) {
          return res.status(400).json({ error: 'title and message are required' });
        }

        let attachmentUrl: string | null = null;
        let attachmentName: string | null = null;
        if (req.file) {
          attachmentUrl = `/uploads/announcements/${req.file.filename}`;
          attachmentName = req.file.originalname;
        }

        if (!supabase) {
          logNotificationFallback('Supabase is not configured; skipping announcement creation.');
          return res.json({ sent: 0, skipped: true, attachmentUrl, attachmentName });
        }

        // Fetch all students
        const { data: recipients, error: rErr } = await supabase
          .from('users')
          .select('id')
          .eq('role', 'student');
        if (rErr) throw rErr;

        const rows = (recipients ?? []).map((r: any) => ({
          recipient_id: r.id,
          sender_id: senderId,
          type: 'announcement',
          title,
          message,
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
          context_type: contextType || null,
          context_id: contextId || null,
          context_name: contextName || null,
        }));

        if (rows.length === 0) return res.json({ sent: 0, attachmentUrl, attachmentName });

        let { error: insErr } = await supabase.from('notifications').insert(rows);
        if (insErr && /column|context_type|does not exist/i.test(insErr.message || '')) {
          const legacyRows = rows.map(({ context_type, context_id, context_name, ...row }: any) => row);
          const retry = await supabase.from('notifications').insert(legacyRows);
          insErr = retry.error;
        }
        if (insErr) {
          if (isSupabaseUnavailableError(insErr)) {
            logNotificationFallback('Could not create announcement because the notifications table is unavailable.', insErr.message);
            return res.json({ sent: 0, skipped: true, attachmentUrl, attachmentName });
          }
          throw insErr;
        }

        res.json({ sent: rows.length, attachmentUrl, attachmentName });
      } catch (err: any) {
        logNotificationFallback('Error creating announcement; returning a no-op response.', err?.message);
        res.json({ sent: 0, skipped: true });
      }
    });
  }
);

/**
 * PATCH /api/notifications/read-all
 * Mark all unread notifications for the current user as read.
 */
router.patch('/read-all', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    if (!supabase) {
      logNotificationFallback('Supabase is not configured; skipping mark-all-read operation.');
      return res.json({ success: true, skipped: true });
    }

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('recipient_id', userId)
      .eq('read', false);

    if (error) {
      if (isSupabaseUnavailableError(error)) {
        logNotificationFallback('Could not mark notifications as read because the notifications table is unavailable.', error.message);
        return res.json({ success: true, skipped: true });
      }
      throw error;
    }
    res.json({ success: true });
  } catch (err: any) {
    logNotificationFallback('Failed to mark notifications as read; returning a no-op response.', err?.message);
    res.json({ success: true, skipped: true });
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read.
 */
router.patch('/:id/read', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    if (!supabase) {
      logNotificationFallback('Supabase is not configured; skipping mark-one-read operation.');
      return res.json({ success: true, skipped: true });
    }

    const { id } = req.params;
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .eq('recipient_id', userId);

    if (error) {
      if (isSupabaseUnavailableError(error)) {
        logNotificationFallback('Could not mark the notification as read because the notifications table is unavailable.', error.message);
        return res.json({ success: true, skipped: true });
      }
      throw error;
    }
    res.json({ success: true });
  } catch (err: any) {
    logNotificationFallback('Failed to mark the notification as read; returning a no-op response.', err?.message);
    res.json({ success: true, skipped: true });
  }
});

export default router;
