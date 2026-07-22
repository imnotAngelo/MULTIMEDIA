import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createUser, findUserByEmail, setAuthUsersFile } from '../src/lib/userStore.ts';

test('stores users in the fallback auth store and reads them by email', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-store-'));
  const tempFile = path.join(tempDir, 'users.json');
  setAuthUsersFile(tempFile);

  const createdUser = createUser({
    id: 'user-1',
    email: 'student@example.com',
    password_hash: 'hashed-password',
    full_name: 'Student One',
    role: 'student',
    avatar_url: 'https://example.com/avatar.png',
    xp_total: 0,
    streak_days: 0,
  });

  const foundUser = findUserByEmail('Student@Example.com');

  assert.ok(foundUser);
  assert.equal(foundUser?.id, createdUser.id);
  assert.equal(foundUser?.role, 'student');
});
