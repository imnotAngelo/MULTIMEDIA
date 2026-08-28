-- Lets instructors target a unit/lesson/laboratory/quiz to specific sections and year levels.
-- Empty arrays (the default) mean "visible to all of the instructor's sections/year levels" (unchanged behavior).
-- Run on Supabase: https://supabase.com/dashboard/project/ciopmrwvmgqsbapyljih/sql/new

ALTER TABLE modules
  ADD COLUMN IF NOT EXISTS target_sections TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE modules
  ADD COLUMN IF NOT EXISTS target_year_levels SMALLINT[] NOT NULL DEFAULT '{}';

ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS target_sections TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS target_year_levels SMALLINT[] NOT NULL DEFAULT '{}';

ALTER TABLE laboratories
  ADD COLUMN IF NOT EXISTS target_sections TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE laboratories
  ADD COLUMN IF NOT EXISTS target_year_levels SMALLINT[] NOT NULL DEFAULT '{}';

ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS target_sections TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS target_year_levels SMALLINT[] NOT NULL DEFAULT '{}';

NOTIFY pgrst, 'reload schema';
