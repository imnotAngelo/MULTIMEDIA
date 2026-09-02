-- Required by semester archiving for laboratory records.
ALTER TABLE laboratories
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published';