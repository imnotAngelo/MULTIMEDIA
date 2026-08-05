import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createUser, listUsers, setAuthUsersFile, updateUser } from '../src/lib/userStore.ts';

test('updates a pending instructor to instructor role in the fallback auth store', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-store-'));
  const tempFile = path.join(tempDir, 'auth-users.json');
  setAuthUsersFile(tempFile);

  createUser({
    id: 'pending-user-1',
    email: 'pending@example.com',
    password_hash: 'hash',
    full_name: 'Pending Instructor',
    role: 'pending_instructor',
    xp_total: 0,
    streak_days: 0,
  });

  const pendingUser = listUsers().find((user) => user.email === 'pending@example.com');
  assert.ok(pendingUser);

  const updatedUser = updateUser(pendingUser.id, { role: 'instructor' });

  assert.ok(updatedUser);
  assert.equal(updatedUser.role, 'instructor');
  assert.ok(listUsers().some((user) => user.role === 'instructor'));
});
