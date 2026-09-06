-- Required by semester archiving for laboratory records.
ALTER TABLE laboratories
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published';
ALTER TABLE laboratories
  ADD COLUMN IF NOT EXISTS archived_year_level SMALLINT;

ALTER TABLE modules
  ADD COLUMN IF NOT EXISTS archived_year_level SMALLINT;

ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS archived_year_level SMALLINT;