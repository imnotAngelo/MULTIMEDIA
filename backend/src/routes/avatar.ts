import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { supabase } from '../config/supabase.js';
import { buildAvatarStoragePath, extractStorageObjectPath } from '../lib/avatarStorage.js';

const router = Router();

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const storage = multer.memoryStorage();

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

      if (!supabase) {
        return res.status(503).json({
          success: false,
          error: { code: 'SUPABASE_UNAVAILABLE', message: 'Supabase is not configured' },
        });
      }

      const filePath = buildAvatarStoragePath(userId, req.file.originalname);
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = publicData?.publicUrl || `https://ciopmrwvmgqsbapyljih.supabase.co/storage/v1/object/public/avatars/${filePath}`;

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
          'id, email, full_name, avatar_url, role, year_level, teaching_year_levels, created_at, last_active'
        )
        .single();

      if (error) throw error;

      const prev = existing?.avatar_url;
      if (prev && typeof prev === 'string') {
        const previousObjectPath = extractStorageObjectPath(prev);
        if (previousObjectPath && previousObjectPath !== filePath) {
          await supabase.storage.from('avatars').remove([previousObjectPath]).catch(() => undefined);
        }
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
