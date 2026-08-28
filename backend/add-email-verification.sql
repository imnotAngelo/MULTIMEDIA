-- Adds email verification support to users.
-- Existing rows default to TRUE (already considered verified); new signups are inserted with FALSE.
-- Run on Supabase: https://supabase.com/dashboard/project/ciopmrwvmgqsbapyljih/sql/new

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verification_token TEXT;
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_email_verification_token ON users(email_verification_token);

NOTIFY pgrst, 'reload schema';
