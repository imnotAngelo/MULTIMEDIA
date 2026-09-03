-- Run once in the Supabase SQL Editor.
-- Adds score breakdown fields used when saving quiz submissions.
ALTER TABLE assessment_submissions ADD COLUMN IF NOT EXISTS possible_points NUMERIC;
ALTER TABLE assessment_submissions ADD COLUMN IF NOT EXISTS earned_points NUMERIC;
NOTIFY pgrst, 'reload schema';