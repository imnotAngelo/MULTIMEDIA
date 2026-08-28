-- Adds a short numeric verification code as an alternative to the email link.
-- Run on Supabase: https://supabase.com/dashboard/project/ciopmrwvmgqsbapyljih/sql/new

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verification_code TEXT;

NOTIFY pgrst, 'reload schema';
