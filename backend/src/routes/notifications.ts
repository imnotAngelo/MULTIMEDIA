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
 * Only returns announcements addressed to the current user (their own section/year).
 */
router.get('/announcements', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!supabase) return res.json([]);
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('type', 'announcement')
      .eq('recipient_id', userId)
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
 * GET /api/notifications/sent-announcements
 * Returns announcements created by the authenticated instructor.
 */
router.get('/sent-announcements', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!supabase) return res.json([]);
    const senderId = req.user?.id;
    if (!senderId) return res.status(401).json({ error: 'Unauthorized' });

    const { data: sender, error: senderError } = await supabase
      .from('users')
      .select('role')
      .eq('id', senderId)
      .maybeSingle();
    if (senderError) throw senderError;
    if (!sender || sender.role !== 'instructor') return res.status(403).json({ error: 'Instructor access required' });

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('type', 'announcement')
      .eq('sender_id', senderId)
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) throw error;

    const unique = new Map<string, any>();
    for (const item of data ?? []) {
      const key = `${item.created_at}:${item.title}:${item.message}`;
      if (!unique.has(key)) unique.set(key, item);
    }

    res.json([...unique.values()].map((item: any) => ({
      id: item.id,
      title: item.title,
      message: item.message,
      createdAt: item.created_at,
      attachmentUrl: item.attachment_url ?? null,
      attachmentName: item.attachment_name ?? null,
    })));
  } catch (err: any) {
    if (isSupabaseUnavailableError(err)) return res.json([]);
    console.error('Error loading sent announcements:', err);
    res.status(500).json({ error: err?.message || 'Failed to load sent announcements' });
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

        // Read current assignments instead of relying on values from an older JWT.
        const { data: sender, error: senderError } = await supabase
          .from('users')
          .select('id, role, section, year_level, teaching_sections, teaching_year_levels')
          .eq('id', senderId)
          .maybeSingle();
        if (senderError) throw senderError;
        if (!sender || sender.role !== 'instructor') {
          return res.status(403).json({ error: 'Only instructors can send announcements.' });
        }

        // Only broadcast to students in the instructor's own sections and taught year levels.
        const teachingSections = (Array.isArray(sender.teaching_sections) && sender.teaching_sections.length
          ? sender.teaching_sections
          : (sender.section ? [sender.section] : []))
          .map((section: unknown) => String(section).trim().toLowerCase())
          .filter(Boolean);
        const teachingYearLevels = (Array.isArray(sender.teaching_year_levels) && sender.teaching_year_levels.length
          ? sender.teaching_year_levels
          : (sender.year_level !== null && sender.year_level !== undefined ? [sender.year_level] : []))
          .map((year: unknown) => Number(year))
          .filter(Number.isInteger);

        if (teachingSections.length === 0 || teachingYearLevels.length === 0) {
          return res.status(403).json({ error: 'Your instructor account has no section/year level assigned.' });
        }

        const { data: students, error: rErr } = await supabase
          .from('users')
          .select('id, section, year_level')
          .eq('role', 'student');
        if (rErr) throw rErr;

        const recipients = (students ?? []).filter((student: any) =>
          teachingSections.includes(String(student.section ?? '').trim().toLowerCase())
          && teachingYearLevels.includes(Number(student.year_level))
        );

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

        if (rows.length === 0) {
          return res.status(409).json({
            error: 'No students match your assigned sections and year levels.',
            sent: 0,
            attachmentUrl,
            attachmentName,
          });
        }

        let { error: insErr } = await supabase.from('notifications').insert(rows);
        if (insErr && /column|context_type|does not exist/i.test(insErr.message || '')) {
          const legacyRows = rows.map(({ context_type, context_id, context_name, ...row }: any) => row);
          const retry = await supabase.from('notifications').insert(legacyRows);
          insErr = retry.error;
        }
        if (insErr) {
          if (isSupabaseUnavailableError(insErr)) {
            throw new Error(`Announcements could not be saved. Run the notifications migration in Supabase. ${insErr.message}`);
          }
          throw insErr;
        }

        res.json({ sent: rows.length, attachmentUrl, attachmentName });
      } catch (err: any) {
        logNotificationFallback('Error creating announcement.', err?.message);
        res.status(503).json({
          success: false,
          error: { code: 'ANNOUNCEMENT_FAILED', message: err?.message || 'Announcement could not be saved.' },
        });
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
