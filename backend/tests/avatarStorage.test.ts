import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAvatarStoragePath, extractStorageObjectPath } from '../src/lib/avatarStorage.ts';

test('builds a user-specific avatar storage path for Supabase', () => {
  const storagePath = buildAvatarStoragePath('user-123', 'photo.png');

  assert.match(storagePath, /^user-123\//);
  assert.match(storagePath, /\.png$/i);
  assert.ok(storagePath.length > 'user-123/'.length);
});

test('extracts the object path from a Supabase public URL', () => {
  const objectPath = extractStorageObjectPath(
    'https://example.supabase.co/storage/v1/object/public/avatars/user-123/photo.png'
  );

  assert.equal(objectPath, 'user-123/photo.png');
});
