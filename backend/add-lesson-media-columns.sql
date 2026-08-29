ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS video_url TEXT;

ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS graphic_url TEXT;

NOTIFY pgrst, 'reload schema';
