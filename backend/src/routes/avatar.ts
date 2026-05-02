import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { supabase } from '../config/supabase.js';

const router = Router();

const AVATARS_DIR = path.join(process.cwd(), 'uploads', 'avatars');
if (!fs.existsSync(AVATARS_DIR)) {
  fs.mkdirSync(AVATARS_DIR, { recursive: true });
}

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, AVATARS_DIR),
  filename: (req, file, cb) => {
    const userId = (req as AuthRequest).user?.id ?? 'anon';
    const ext = (path.extname(file.originalname) || '').toLowerCase().slice(0, 8);
    const rand = crypto.randomBytes(6).toString('hex');
    cb(null, `${userId}-${Date.now()}-${rand}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, WEBP, or GIF images are allowed.'));
    }
    cb(null, true);
  },
});

/**
 * POST /api/users/avatar
 * Multipart form upload, field name: "avatar".
 * Saves file under /uploads/avatars/<file>, updates users.avatar_url, returns
 * the new public URL.
 */
router.post(
  '/',
  authMiddleware,
  (req, res, next) => {
    upload.single('avatar')(req, res, (err: any) => {
      if (err) {
        return res.status(400).json({
          success: false,
          error: { code: 'UPLOAD_FAILED', message: err.message || 'Upload failed' },
        });
      }
      next();
    });
  },
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
        });
      }
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_FILE', message: 'No file uploaded' },
        });
      }

      const publicUrl = `/uploads/avatars/${req.file.filename}`;

      // Look up the previous avatar so we can delete it if it's a local file we own.
      const { data: existing } = await supabase
        .from('users')
        .select('avatar_url')
        .eq('id', userId)
        .single();

      const { data: user, error } = await supabase
        .from('users')
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select(
          'id, email, full_name, avatar_url, role, xp_total, streak_days, year_level, teaching_year_levels, created_at, last_active'
        )
        .single();

      if (error) throw error;

      // Best-effort: remove the previous local avatar to avoid disk bloat.
      const prev = existing?.avatar_url;
      if (prev && typeof prev === 'string' && prev.startsWith('/uploads/avatars/')) {
        const prevPath = path.join(process.cwd(), prev.replace(/^\//, ''));
        fs.unlink(prevPath, () => {
          /* ignore */
        });
      }

      return res.json({
        success: true,
        data: { avatar_url: publicUrl, user },
      });
    } catch (err: any) {
      console.error('Avatar upload error:', err);
      return res.status(500).json({
        success: false,
        error: { code: 'AVATAR_UPDATE_FAILED', message: err?.message || 'Failed to update avatar' },
      });
    }
  }
);

export default router;
