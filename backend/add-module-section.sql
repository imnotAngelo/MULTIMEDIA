-- Adds optional section metadata to modules.
-- Run in the Supabase SQL Editor, then reload the backend.

ALTER TABLE modules
  ADD COLUMN IF NOT EXISTS section TEXT;

ALTER TABLE modules
  ADD COLUMN IF NOT EXISTS year_level SMALLINT
    CHECK (year_level IS NULL OR year_level BETWEEN 1 AND 4);

NOTIFY pgrst, 'reload schema';