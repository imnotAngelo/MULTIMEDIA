import crypto from 'crypto';
import path from 'path';

export function buildAvatarStoragePath(userId: string, originalName: string): string {
  const ext = path.extname(originalName || 'avatar.png').toLowerCase() || '.png';
  const safeUserId = (userId || 'anon').replace(/[^a-zA-Z0-9_-]+/g, '-');
  const uniqueToken = crypto.randomBytes(6).toString('hex');
  const timestamp = Date.now();
  return `${safeUserId}/${timestamp}-${uniqueToken}${ext}`;
}

export function extractStorageObjectPath(publicUrl: string): string {
  try {
    const url = new URL(publicUrl);
    const match = url.pathname.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/i);
    return match ? decodeURIComponent(match[1]) : '';
  } catch {
    return '';
  }
}
