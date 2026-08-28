-- Adds teaching_sections to users for instructors.
-- Stores which sections they teach (e.g. {A,B,C}), mirroring teaching_year_levels.
-- Run on Supabase: https://supabase.com/dashboard/project/ciopmrwvmgqsbapyljih/sql/new

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS teaching_sections TEXT[] NOT NULL DEFAULT '{}';

NOTIFY pgrst, 'reload schema';
