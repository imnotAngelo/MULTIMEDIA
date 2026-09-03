-- Run once in the Supabase SQL Editor.
-- Records which instructor accepted/handles each student.
ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_by_instructor_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_approved_by_instructor ON users(approved_by_instructor_id);
NOTIFY pgrst, 'reload schema';
