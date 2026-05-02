-- Adds teaching_year_levels to users for instructors.
-- Stores which year levels they teach (e.g. {1,2} = 1st and 2nd year).
-- Run on Supabase: https://supabase.com/dashboard/project/ciopmrwvmgqsbapyljih/sql/new

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS teaching_year_levels SMALLINT[] NOT NULL DEFAULT '{}';

-- Validate every element is 1..4
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_teaching_year_levels_valid;
ALTER TABLE users
  ADD CONSTRAINT users_teaching_year_levels_valid
  CHECK (
    teaching_year_levels <@ ARRAY[1,2,3,4]::smallint[]
  );

NOTIFY pgrst, 'reload schema';
