ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS video_url TEXT;

ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS graphic_url TEXT;

ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS pdf_url TEXT;

ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS original_format TEXT;

NOTIFY pgrst, 'reload schema';
