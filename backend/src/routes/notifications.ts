import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { supabase } from '../config/supabase.js';

const router = Router();

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

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json(data ?? []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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
    if (insErr) throw insErr;

    res.json({ sent: rows.length });
  } catch (err: any) {
    console.error('Error creating notification:', err);
    res.status(500).json({ error: err.message });
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

        const { title, message } = req.body ?? {};
        if (!title || !message) {
          return res.status(400).json({ error: 'title and message are required' });
        }

        let attachmentUrl: string | null = null;
        let attachmentName: string | null = null;
        if (req.file) {
          attachmentUrl = `/uploads/announcements/${req.file.filename}`;
          attachmentName = req.file.originalname;
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
        }));

        if (rows.length === 0) return res.json({ sent: 0, attachmentUrl, attachmentName });

        const { error: insErr } = await supabase.from('notifications').insert(rows);
        if (insErr) throw insErr;

        res.json({ sent: rows.length, attachmentUrl, attachmentName });
      } catch (err: any) {
        console.error('Error creating announcement:', err);
        res.status(500).json({ error: err.message });
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

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('recipient_id', userId)
      .eq('read', false);

    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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

    const { id } = req.params;
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .eq('recipient_id', userId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
