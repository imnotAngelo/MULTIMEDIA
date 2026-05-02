-- Adds year_level to users (1=1st year, 2=2nd, 3=3rd, 4=4th). NULL = not set.
-- Run on Supabase: https://supabase.com/dashboard/project/ciopmrwvmgqsbapyljih/sql/new

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS year_level SMALLINT
    CHECK (year_level IS NULL OR year_level BETWEEN 1 AND 4);

NOTIFY pgrst, 'reload schema';
